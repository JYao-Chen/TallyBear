import {z} from 'zod';
import {lockBook} from './db';
import {Failure} from './access';
import {selectedGroup,moveInTransaction,withReceiptTransaction} from './move-entry';
import {reuseInTransaction} from './reuse';

export async function organize(book:string,user:string,body:unknown){
 const b=z.object({ids:z.array(z.string().uuid()).min(1),operation:z.enum(['move','copy','delete']),targetBook:z.string().uuid().optional(),versions:z.record(z.number().int())}).parse(body);
 if(b.operation!=='delete'&&(!b.targetBook||b.targetBook===book))throw new Failure('请选择另一本账本');
 return withReceiptTransaction(async(c,copied)=>{
  const target=b.operation==='delete'?undefined:b.targetBook;
  for(const id of [...new Set([book,...(target?[target]:[])])].sort())await lockBook(c,id);
  for(const id of [book,...(target?[target]:[])]){const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[id,user])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('没有账本的记账权限',403);}
  const rows=await selectedGroup(c,book,b.ids);
  if(rows.length!==Object.keys(b.versions).length||rows.some(r=>r.version!==b.versions[r.id]))throw new Failure('记录已变化，请重新打开整理窗口',409);
  if(b.operation==='move')return moveInTransaction(c,book,user,target!,rows,copied);
  if(b.operation==='delete'){
   // Serialize balance-changing removals with account reconciliation.
   const accounts=[...new Set(rows.flatMap(r=>[r.account_id,r.target_id].filter(Boolean)))].sort();
   await c.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accounts]);
   const r=await c.query('UPDATE transactions SET deleted=true,version=version+1 WHERE id=ANY($1::uuid[]) AND NOT deleted',[rows.map(r=>r.id)]);
   return {ok:true,deleted:r.rowCount};
  }
  let added=0,skipped=0;
  for(const r of rows.filter(r=>!r.deleted)){
   const result=await reuseInTransaction(c,book,user,r.id,r.version,target!,copied);
   if(result.alreadyExists)skipped++;else added++;
  }
  return {ok:true,added,skipped};
 });
}
