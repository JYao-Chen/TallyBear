import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {Failure} from './access';
import type {Entry} from './ledger';
export const accountMetadata={type:z.enum(['wechat','alipay','bank','cash','credit','investment','other']).optional(),holder:z.string().trim().max(60).optional(),institution:z.string().trim().max(60).optional(),suffix:z.string().regex(/^([0-9]{4})?$/,'尾号填写4位数字或留空').optional()};
const amount=z.number().int().min(-100000000000).max(100000000000);
export const accountAccess=(userParam:string)=>`(a.owner_id=${userParam} OR EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=${userParam}))`;
// A reused transaction has several book appearances, but only one asset movement.
export const accountBalance=`(a.opening+COALESCE((SELECT sum(flow) FROM (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) CASE WHEN t.kind IN ('income','refund') THEN t.amount ELSE -t.amount END AS flow FROM transactions t WHERE t.account_id=a.id AND NOT t.deleted ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id) outgoing),0)+COALESCE((SELECT sum(amount) FROM (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.amount FROM transactions t WHERE t.target_id=a.id AND NOT t.deleted ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id) incoming),0)+COALESCE((SELECT sum(j.amount) FROM account_adjustments j WHERE j.account_id=a.id),0))::float8`;
const identity=`a.id,a.name,a.type,a.holder,a.institution,a.suffix,a.ownership,a.archived,a.version,a.owner_id,a.family_id,COALESCE(f.name,u.name) AS owner_name`;
export async function listAssets(user:string){return (await db.query(`SELECT ${identity},a.opening::float8 AS opening,${accountBalance} AS balance,true AS usable FROM accounts a LEFT JOIN users u ON u.id=a.owner_id LEFT JOIN families f ON f.id=a.family_id WHERE ${accountAccess('$1')} ORDER BY a.archived,a.family_id NULLS FIRST,a.name,a.id`,[user])).rows;}
// Book viewers may see payment-source labels, never another person's full balance.
export async function listAccounts(book:string,user:string){return (await db.query(`SELECT ${identity},${accountAccess('$2')} AS usable,CASE WHEN ${accountAccess('$2')} THEN a.opening::float8 END AS opening,CASE WHEN ${accountAccess('$2')} THEN ${accountBalance} END AS balance FROM accounts a LEFT JOIN users u ON u.id=a.owner_id LEFT JOIN families f ON f.id=a.family_id WHERE ${accountAccess('$2')} OR EXISTS(SELECT 1 FROM transactions t WHERE t.book_id=$1 AND (t.account_id=a.id OR t.target_id=a.id)) ORDER BY a.archived,a.name,a.id`,[book,user])).rows;}
async function familyAccess(c:PoolClient,user:string,family:string){if(!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[family,user])).rowCount)throw new Failure('只有家庭成员可以管理家庭资产',403);}
export async function createAccount(user:string,body:unknown){const b=z.object({name:z.string().trim().min(1).max(80),opening:amount.default(0),familyId:z.string().uuid().nullable().default(null),...accountMetadata}).parse(body);return transaction(async c=>{if(b.familyId)await familyAccess(c,user,b.familyId);const id=randomUUID();await c.query('INSERT INTO accounts(id,owner_id,family_id,name,opening,type,holder,institution,suffix,ownership) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,b.familyId?null:user,b.familyId,b.name,b.opening,b.type||'other',b.holder||'',b.institution||'',b.suffix||'',b.familyId?'shared':'personal']);return {id};});}
export async function changeAccount(user:string,body:unknown){
 const b=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('edit'),id:z.string().uuid(),version:z.number().int(),name:z.string().trim().min(1).max(80),opening:amount,...accountMetadata}),
  z.object({operation:z.literal('delete'),id:z.string().uuid(),version:z.number().int(),expectedBalance:amount}),
  z.object({operation:z.literal('archive'),id:z.string().uuid(),version:z.number().int(),archived:z.boolean()}),
  z.object({operation:z.literal('reconcile'),id:z.string().uuid(),version:z.number().int(),balance:amount,expectedBalance:amount,note:z.string().trim().min(1).max(500)})
 ]).parse(body);
 return transaction(async c=>{await c.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[b.id]);const a=(await c.query(`SELECT a.*,${accountBalance} AS balance FROM accounts a WHERE a.id=$1 AND ${accountAccess('$2')}`,[b.id,user])).rows[0];if(!a)throw new Failure('没有此资产的管理权限',403);if(a.version!==b.version)throw new Failure('账户已发生变化，请刷新后重试',409);
  if(b.operation==='delete'){
   if(a.balance!==b.expectedBalance)throw new Failure('当前余额已变化，请刷新后重试',409);
   const referenced=(await c.query("SELECT EXISTS(SELECT 1 FROM transactions WHERE account_id=$1 OR target_id=$1) OR EXISTS(SELECT 1 FROM account_adjustments WHERE account_id=$1) OR EXISTS(SELECT 1 FROM entry_templates WHERE value->>'accountId'=$1::text OR value->>'targetId'=$1::text) OR EXISTS(SELECT 1 FROM bill_schedules WHERE value->>'accountId'=$1::text OR value->>'targetId'=$1::text) AS used",[b.id])).rows[0].used;
   if(referenced)throw new Failure('这个钱包有历史流水或计划，请先合并到其他钱包，或选择归档保留历史');
   await c.query("UPDATE entry_drafts SET value=replace(value::text,$1,'')::jsonb,version=version+1 WHERE strpos(value::text,$1)>0",[b.id]);
   await c.query('DELETE FROM accounts WHERE id=$1',[b.id]);return {ok:true};
  }
  if(b.operation==='edit'&&b.type&&b.type!=='credit'&&(await c.query('SELECT 1 FROM installment_plans WHERE account_id=$1',[b.id])).rowCount)throw new Failure('这个账户有关联分期，请保留负债账户类型');
  if(b.operation==='edit')await c.query('UPDATE accounts SET name=$1,opening=$2,type=COALESCE($4,type),holder=COALESCE($5,holder),institution=COALESCE($6,institution),suffix=COALESCE($7,suffix),version=version+1 WHERE id=$3',[b.name,b.opening,b.id,b.type,b.holder,b.institution,b.suffix]);
  if(b.operation==='archive')await c.query('UPDATE accounts SET archived=$1,version=version+1 WHERE id=$2',[b.archived,b.id]);
  let difference=0;if(b.operation==='reconcile'){if(a.balance!==b.expectedBalance)throw new Failure('期间有新的交易，当前余额已变化，请刷新后重新核对',409);difference=b.balance-a.balance;if(difference){await c.query('INSERT INTO account_adjustments(id,account_id,amount,note,created_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.id,difference,b.note,user]);await c.query('UPDATE accounts SET version=version+1 WHERE id=$1',[b.id]);}}
  return {ok:true,difference};
 });
}
export async function accountHistory(user:string,id:string){return transaction(async c=>{if(!(await c.query(`SELECT 1 FROM accounts a WHERE id=$1 AND ${accountAccess('$2')}`,[id,user])).rowCount)throw new Failure('没有此资产的管理权限',403);return (await c.query('SELECT j.id,j.amount::float8 AS amount,j.note,j.created_at,u.name AS creator FROM account_adjustments j JOIN users u ON u.id=j.created_by WHERE j.account_id=$1 ORDER BY j.created_at DESC LIMIT 100',[id])).rows;});}
export async function validateActiveAccounts(c:PoolClient,book:string,e:Entry,user:string,unchanged:string[]=[]){
 const ids=[e.accountId,...(e.kind==='transfer'&&e.targetId?[e.targetId]:[])];
 const rows=(await c.query(`SELECT a.id,a.archived,${accountAccess('$2')} AS usable FROM accounts a WHERE a.id=ANY($1::uuid[]) ORDER BY a.id FOR UPDATE OF a`,[[...new Set([...ids,...unchanged])],user])).rows;
 for(const id of ids){const a=rows.find(a=>a.id===id);if(!a)throw new Failure('资金账户不存在');if(!a.usable&&!unchanged.includes(id))throw new Failure('请选择自己的资产或已加入家庭的共同资产',403);if(a.archived&&!unchanged.includes(id))throw new Failure('这个账户已归档，请恢复账户或选择其他账户');}
}
export async function accountReport(user:string,params:URLSearchParams){
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
 const p=z.object({from:date,to:date}).parse(Object.fromEntries(params));if(p.to<p.from)throw new Failure('结束日期不能早于开始日期');
 const scope=params.get('scope')||'personal';if(scope!=='personal')z.string().uuid().parse(scope);
 const accounts=(await listAssets(user)).filter(a=>scope==='personal'?!!a.owner_id:a.family_id===scope);const ids=accounts.map(a=>a.id);
 const flows=(await db.query(`WITH unique_entries AS(SELECT DISTINCT ON(COALESCE(event_id,id)) * FROM transactions WHERE NOT deleted AND (account_id=ANY($1::uuid[]) OR target_id=ANY($1::uuid[])) ORDER BY COALESCE(event_id,id),created_at,id) SELECT account_id,target_id,kind,amount::float8 AS amount,category,payee FROM unique_entries WHERE date BETWEEN $2::date AND $3::date`,[ids,p.from,p.to])).rows;
 for(const a of accounts){Object.assign(a,{income:0,expense:0,refund:0,transferIn:0,transferOut:0});for(const t of flows){if(t.account_id===a.id)a[t.kind==='transfer'?'transferOut':t.kind]+=t.amount;if(t.target_id===a.id)a.transferIn+=t.amount;}}
 const sourceMap=new Map<string,any>();for(const t of flows){if(t.kind==='transfer')continue;const key=JSON.stringify([t.kind,t.category,t.payee]);const s=sourceMap.get(key)||{kind:t.kind,category:t.category,counterparty:t.payee||'未填写交易对方',amount:0,count:0};s.amount+=t.amount;s.count++;sourceMap.set(key,s);}
 const credits=new Set((await db.query("SELECT id FROM accounts WHERE type='credit'")).rows.map(a=>a.id));
 const cashPaid=flows.filter(t=>ids.includes(t.account_id)&&!credits.has(t.account_id)&&(t.kind==='expense'||t.kind==='transfer'&&credits.has(t.target_id))).reduce((n,t)=>n+t.amount,0);
 const debtPurchases=flows.filter(t=>ids.includes(t.account_id)&&credits.has(t.account_id)&&t.kind==='expense').reduce((n,t)=>n+t.amount,0);
 return {period:p,accounts,sources:[...sourceMap.values()].sort((a,b)=>b.amount-a.amount),ownershipGroups:[],summary:{cashPaid,debtPurchases,bankDeposits:accounts.filter(a=>a.type==='bank').reduce((n,a)=>n+Math.max(0,a.balance),0),walletAndCash:accounts.filter(a=>['wechat','alipay','cash'].includes(a.type)).reduce((n,a)=>n+Math.max(0,a.balance),0),assets:accounts.reduce((n,a)=>n+Math.max(0,a.balance),0),liabilities:accounts.reduce((n,a)=>n+Math.max(0,-a.balance),0),netAssets:accounts.reduce((n,a)=>n+a.balance,0),income:accounts.reduce((n,a)=>n+a.income,0),expense:accounts.reduce((n,a)=>n+a.expense,0),refund:accounts.reduce((n,a)=>n+a.refund,0)}};
}
