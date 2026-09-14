import {randomUUID} from 'node:crypto';
import {copyFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {Failure} from './access';
import {checkCategory} from './categories';
import {receiptDirectory} from './receipts';

async function group(c:Pick<PoolClient,'query'>,book:string,id:string){
 const selected=(await c.query('SELECT id,refund_of,deleted FROM transactions WHERE book_id=$1 AND id=$2',[book,id])).rows[0];
 if(!selected||selected.deleted)throw new Failure('记录不存在或已删除',404);
 const root=selected.refund_of||id;
 return (await c.query('SELECT t.*,a.name AS account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.book_id=$1 AND (t.id=$2 OR t.refund_of=$2) ORDER BY t.created_at,t.id',[book,root])).rows;
}
export async function movePreview(book:string,id:string){
 z.string().uuid().parse(id);const rows=await group(db,book,id);
 const ids=[...new Set(rows.flatMap(r=>[r.account_id,r.target_id].filter(Boolean)))];
 const accounts=(await db.query('SELECT * FROM accounts WHERE book_id=$1 AND id=ANY($2::uuid[])',[book,ids])).rows;
 return {records:rows.map(r=>({id:r.id,version:r.version,title:r.title||r.payee||r.category,deleted:r.deleted})),accounts};
}
export async function moveEntry(book:string,user:string,body:unknown){
 const b=z.object({id:z.string().uuid(),targetBook:z.string().uuid(),versions:z.record(z.number().int()),accounts:z.record(z.string().uuid())}).parse(body);
 if(book===b.targetBook)throw new Failure('请选择另一本账本');
 const copied:string[]=[];
 try{return await transaction(async c=>{
  for(const id of [book,b.targetBook].sort())await lockBook(c,id);
  for(const id of [book,b.targetBook]){const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[id,user])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('需要拥有两个账本的记账权限',403);}
  const rows=await group(c,book,b.id);
  if(rows.length!==Object.keys(b.versions).length||rows.some(r=>b.versions[r.id]!==r.version))throw new Failure('记录已变化，请重新打开移动窗口',409);
  const sourceAccounts=[...new Set(rows.flatMap(r=>[r.account_id,r.target_id].filter(Boolean)))];
  for(const id of sourceAccounts){const dest=b.accounts[id];if(!dest||!(await c.query('SELECT 1 FROM accounts WHERE id=$1 AND book_id=$2 AND NOT archived',[dest,b.targetBook])).rowCount)throw new Failure('请为每个资金账户选择目标账户');}
  for(const r of rows){if(r.kind==='transfer'&&b.accounts[r.account_id]===b.accounts[r.target_id])throw new Failure('转出与转入账户必须不同');await checkCategory(c,b.targetBook,r.category);
   if((await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND ((external_id IS NOT NULL AND external_id=$2) OR (event_id IS NOT NULL AND event_id=$3))',[b.targetBook,r.external_id,r.event_id])).rowCount)throw new Failure('目标账本已有相同流水或关联记录，请先核对');
  }
  const ids=rows.map(r=>r.id);
  // A voucher may belong to several orders. Give the destination its own file
  // so moving one order cannot expose other books or remove their attachments.
  const files=(await c.query('SELECT f.* FROM receipt_files f JOIN transaction_receipts r ON r.file_id=f.id WHERE r.transaction_id=ANY($1::uuid[]) FOR UPDATE OF f',[ids])).rows;
  for(const f of new Map(files.map(f=>[f.id,f])).values()){
   const id=randomUUID();copied.push(id);await copyFile(path.join(receiptDirectory(),f.id),path.join(receiptDirectory(),id));
   await c.query('INSERT INTO receipt_files(id,book_id,user_id,name,mime,temporary) VALUES($1,$2,$3,$4,$5,false)',[id,b.targetBook,user,f.name,f.mime]);
   await c.query('UPDATE transaction_receipts SET file_id=$1 WHERE file_id=$2 AND transaction_id=ANY($3::uuid[])',[id,f.id,ids]);
   await c.query('UPDATE receipt_files SET temporary=true,created_at=now() WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=$1)',[f.id]);
  }
  for(const r of rows)await c.query('UPDATE transactions SET book_id=$1,account_id=$2,target_id=$3,version=version+1 WHERE id=$4',[b.targetBook,b.accounts[r.account_id],r.target_id?b.accounts[r.target_id]:null,r.id]);
  return {ok:true,moved:rows.filter(r=>!r.deleted).length,book:b.targetBook};
 });}catch(e){await Promise.all(copied.map(id=>unlink(path.join(receiptDirectory(),id)).catch(()=>{})));throw e;}
}
