import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction} from './db';
import {accountAccess} from './accounts';
import {Failure} from './access';
const uuid=z.string().uuid();
async function preview(c:PoolClient,user:string,id:string){
 const source=(await c.query('SELECT * FROM transactions WHERE id=$1',[id])).rows[0];if(!source||source.deleted)throw new Failure('流水已删除或不存在',404);
 const rows=(await c.query('SELECT id,book_id,account_id,target_id,version FROM transactions WHERE COALESCE(event_id,id)=$1 AND NOT deleted ORDER BY id',[source.event_id||source.id])).rows;
 const wallets=[...new Set(rows.flatMap(r=>[r.account_id,r.target_id].filter(Boolean)))];
 if((await c.query(`SELECT 1 FROM accounts a WHERE a.id=ANY($1::uuid[]) AND NOT ${accountAccess('$2')}`,[wallets,user])).rowCount)throw new Failure('删除整笔流水需要拥有涉及钱包的管理权限',403);
 // A book appearance can be removed independently; removing actual wallet flow must remove every appearance.
 const ids=rows.map(r=>r.id);let reason='';
 if((await c.query('SELECT 1 FROM transactions WHERE refund_of=ANY($1::uuid[]) AND NOT deleted',[ids])).rowCount)reason='这笔消费关联了退款，请先处理退款记录';
 else if((await c.query('SELECT 1 FROM cost_source_claims WHERE transaction_id=ANY($1::uuid[])',[ids])).rowCount)reason='这笔流水用于费用分摊，请先在费用项目中解除关联';
 else if((await c.query("SELECT 1 FROM family_movements WHERE expense_id=ANY($1::uuid[]) AND status<>'cancelled'",[ids])).rowCount)reason='这笔消费关联了家庭结算，请先处理结算记录';
 return {rows,version:source.version,canDelete:!reason,reason};
}
export async function walletEntryDelete(user:string,method:string,input:unknown){
 const body=z.object({id:uuid,expected:z.object({version:z.number().int(),copies:z.number().int().positive()}).optional()}).parse(input);
 return transaction(async c=>{
  const event=(await c.query('SELECT COALESCE(event_id,id) AS event FROM transactions WHERE id=$1',[body.id])).rows[0];if(!event)throw new Failure('流水不存在',404);
  const books=(await c.query('SELECT DISTINCT book_id FROM transactions WHERE COALESCE(event_id,id)=$1 ORDER BY book_id',[event.event])).rows;
  for(const book of books)await c.query('SELECT id FROM books WHERE id=$1 FOR UPDATE',[book.book_id]);
  const data=await preview(c,user,body.id);
  const expected={version:data.version,copies:data.rows.length};
  if(method==='GET')return {canDelete:data.canDelete,reason:data.reason,copies:data.rows.length,expected};
  if(method!=='DELETE')throw new Failure('操作不存在',404);
  if(!data.canDelete)throw new Failure(data.reason);
  if(!body.expected||body.expected.version!==expected.version||body.expected.copies!==expected.copies)throw new Failure('流水已变化，请重新打开详情后再删除',409);
  await c.query('UPDATE transactions SET deleted=true,version=version+1,updated_at=now() WHERE id=ANY($1::uuid[])',[data.rows.map(r=>r.id)]);
  return {ok:true,removed:data.rows.length};
 });
}
