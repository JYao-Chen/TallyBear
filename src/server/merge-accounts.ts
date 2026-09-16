import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {transaction,lockBook} from './db';
import {accountAccess,accountBalance} from './accounts';
import {Failure} from './access';
const money=z.number().int().min(-100000000000).max(100000000000);
export async function mergeAccounts(user:string,body:unknown){
 const b=z.object({id:z.string().uuid(),targetId:z.string().uuid(),version:z.number().int(),targetVersion:z.number().int(),expectedBalance:money,expectedTargetBalance:money,balance:money}).parse(body);
 if(b.id===b.targetId)throw new Failure('请选择另一个钱包');
 return transaction(async c=>{
  const ids=[b.id,b.targetId].sort();const books=(await c.query('SELECT DISTINCT book_id FROM transactions WHERE account_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[]) ORDER BY book_id',[ids])).rows;
  for(const book of books)await lockBook(c,book.book_id);
  await c.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
  const rows=(await c.query(`SELECT a.*,${accountBalance} AS balance FROM accounts a WHERE a.id=ANY($1::uuid[]) AND ${accountAccess('$2')}`,[ids,user])).rows;
  const source=rows.find(a=>a.id===b.id),target=rows.find(a=>a.id===b.targetId);
  if(!source||!target)throw new Failure('没有这些钱包的管理权限',403);
  if(source.owner_id!==target.owner_id||source.family_id!==target.family_id)throw new Failure('只能合并同一个人或同一个家庭的钱包');
  if(source.version!==b.version||target.version!==b.targetVersion||source.balance!==b.expectedBalance||target.balance!==b.expectedTargetBalance)throw new Failure('钱包余额或信息已变化，请刷新后重新合并',409);
  if((await c.query('SELECT 1 FROM transactions WHERE (account_id=$1 AND target_id=$2) OR (account_id=$2 AND target_id=$1)',ids)).rowCount)throw new Failure('两个钱包之间有转账，请先处理这些转账后再合并');
  if((await c.query('SELECT 1 FROM installment_plans WHERE account_id=ANY($1::uuid[])',[ids])).rowCount)throw new Failure('钱包有关联分期，请先处理分期计划后再合并');
  if((await c.query('SELECT 1 FROM family_movements WHERE source_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[])',[ids])).rowCount)throw new Failure('钱包存在家庭资金往来，请保留原钱包；不再使用时可归档');
  await c.query('UPDATE transactions SET account_id=$2,version=version+1 WHERE account_id=$1',[b.id,b.targetId]);
  await c.query('UPDATE transactions SET target_id=$2,version=version+1 WHERE target_id=$1',[b.id,b.targetId]);
  await c.query('UPDATE account_adjustments SET account_id=$2 WHERE account_id=$1',[b.id,b.targetId]);
  for(const table of ['entry_drafts','entry_templates','bill_schedules'])await c.query(`UPDATE ${table} SET value=replace(value::text,$1,$2)::jsonb,version=version+1 WHERE strpos(value::text,$1)>0`,[b.id,b.targetId]);
  await c.query('UPDATE accounts SET opening=opening+$2,version=version+1 WHERE id=$1',[b.targetId,source.opening]);
  const total=(await c.query(`SELECT ${accountBalance} AS balance FROM accounts a WHERE a.id=$1`,[b.targetId])).rows[0].balance;
  const adjustment=b.balance-total;
  if(adjustment)await c.query('INSERT INTO account_adjustments(id,account_id,amount,note,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.targetId,adjustment,'合并钱包时核对余额',user]);
  await c.query('DELETE FROM accounts WHERE id=$1',[b.id]);
  return {ok:true,id:b.targetId,balance:b.balance};
 });
}
