import {randomUUID} from 'node:crypto';
import {copyFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {Failure} from './access';
import {checkCategory} from './categories';
import {receiptDirectory} from './receipts';

export async function group(c:Pick<PoolClient,'query'>,book:string,id:string){
 const selected=(await c.query('SELECT id,refund_of,deleted FROM transactions WHERE book_id=$1 AND id=$2',[book,id])).rows[0];
 if(!selected||selected.deleted)throw new Failure('记录不存在或已删除',404);
 const root=selected.refund_of||id;
 return (await c.query('SELECT t.*,a.name AS account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.book_id=$1 AND (t.id=$2 OR t.refund_of=$2) ORDER BY t.created_at,t.id',[book,root])).rows;
}
export async function selectedGroup(c:Pick<PoolClient,'query'>,book:string,ids:string[]){
 const rows=new Map<string,any>();for(const id of ids)for(const row of await group(c,book,id))rows.set(row.id,row);
 return [...rows.values()].sort((a,b)=>Number(!!a.refund_of)-Number(!!b.refund_of)||a.id.localeCompare(b.id));
}
export async function movePreview(book:string,id:string|string[]){
 const idsInput=z.array(z.string().uuid()).min(1).parse(Array.isArray(id)?id:[id]);const rows=await selectedGroup(db,book,idsInput);
 const ids=[...new Set(rows.flatMap(r=>[r.account_id,r.target_id].filter(Boolean)))];
 const accounts=(await db.query('SELECT id,name,type,ownership FROM accounts WHERE id=ANY($1::uuid[])',[ids])).rows;
 return {records:rows.map(r=>({id:r.id,version:r.version,kind:r.kind,title:r.title||r.payee||r.category,deleted:r.deleted})),accounts};
}
export async function moveInTransaction(c:PoolClient,book:string,user:string,targetBook:string,rows:any[],copied:string[]){
 for(const id of [book,targetBook]){const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[id,user])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('需要拥有两个账本的记账权限',403);}
 for(const r of rows){await checkCategory(c,user,r.category);
  if((await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND ((external_id IS NOT NULL AND external_id=$2) OR (event_id IS NOT NULL AND event_id=$3))',[targetBook,r.external_id,r.event_id])).rowCount)throw new Failure('目标账本已有相同流水或关联记录，请先核对');
 }
 const ids=rows.map(r=>r.id);
 const files=(await c.query('SELECT f.* FROM receipt_files f JOIN transaction_receipts r ON r.file_id=f.id WHERE r.transaction_id=ANY($1::uuid[]) FOR UPDATE OF f',[ids])).rows;
 for(const f of new Map(files.map(f=>[f.id,f])).values()){
  const id=randomUUID();copied.push(id);await copyFile(path.join(receiptDirectory(),f.id),path.join(receiptDirectory(),id));
  await c.query('INSERT INTO receipt_files(id,book_id,user_id,name,mime,temporary) VALUES($1,$2,$3,$4,$5,false)',[id,targetBook,user,f.name,f.mime]);
  await c.query('UPDATE transaction_receipts SET file_id=$1 WHERE file_id=$2 AND transaction_id=ANY($3::uuid[])',[id,f.id,ids]);
  await c.query('UPDATE receipt_files SET temporary=true,created_at=now() WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=$1)',[f.id]);
 }
 await c.query('UPDATE transactions SET book_id=$1,version=version+1 WHERE id=ANY($2::uuid[])',[targetBook,ids]);
 await c.query('UPDATE category_feedback SET book_id=$1 WHERE transaction_id=ANY($2::uuid[])',[targetBook,ids]);
 return {ok:true,moved:rows.filter(r=>!r.deleted).length,book:targetBook};
}
export async function withReceiptTransaction<T>(fn:(c:PoolClient,copied:string[])=>Promise<T>){
 const copied:string[]=[];try{return await transaction(c=>fn(c,copied));}catch(e){await Promise.all(copied.map(id=>unlink(path.join(receiptDirectory(),id)).catch(()=>{})));throw e;}
}
export async function moveEntry(book:string,user:string,body:unknown){
 const b=z.object({id:z.string().uuid(),targetBook:z.string().uuid(),versions:z.record(z.number().int())}).parse(body);
 if(book===b.targetBook)throw new Failure('请选择另一本账本');
 return withReceiptTransaction(async(c,copied)=>{
  for(const id of [book,b.targetBook].sort())await lockBook(c,id);
  const rows=await group(c,book,b.id);
  if(rows.length!==Object.keys(b.versions).length||rows.some(r=>b.versions[r.id]!==r.version))throw new Failure('记录已变化，请重新打开移动窗口',409);
  return moveInTransaction(c,book,user,b.targetBook,rows,copied);
 });
}
