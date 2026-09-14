import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {Failure} from './access';
import type {Entry} from './ledger';
export const accountMetadata={ownership:z.enum(['shared','personal','unspecified']).optional(),type:z.enum(['wechat','alipay','bank','cash','credit','investment','other']).optional(),holder:z.string().trim().max(60).optional(),institution:z.string().trim().max(60).optional(),suffix:z.string().regex(/^([0-9]{4})?$/,'尾号填写4位数字或留空').optional()};
const amount=z.number().int().min(-100000000000).max(100000000000);
export const accountBalance=`(a.opening+COALESCE((SELECT sum(CASE WHEN t.kind IN ('income','refund') THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.account_id=a.id AND NOT t.deleted),0)+COALESCE((SELECT sum(t.amount) FROM transactions t WHERE t.target_id=a.id AND NOT t.deleted),0)+COALESCE((SELECT sum(j.amount) FROM account_adjustments j WHERE j.account_id=a.id),0))::float8`;
export async function listAccounts(book:string){return (await db.query(`SELECT a.*,a.opening::float8 AS opening,${accountBalance} AS balance FROM accounts a WHERE a.book_id=$1 ORDER BY a.archived,a.name`,[book])).rows;}
export async function changeAccount(book:string,user:string,body:unknown){
 const b=z.discriminatedUnion('operation',[
  z.object({operation:z.literal('edit'),id:z.string().uuid(),version:z.number().int(),name:z.string().trim().min(1).max(80),opening:amount,...accountMetadata}),
  z.object({operation:z.literal('archive'),id:z.string().uuid(),version:z.number().int(),archived:z.boolean()}),
  z.object({operation:z.literal('reconcile'),id:z.string().uuid(),version:z.number().int(),balance:amount,expectedBalance:amount,note:z.string().trim().min(1).max(500)})
 ]).parse(body);
 return transaction(async c=>{await lockBook(c,book);const a=(await c.query(`SELECT a.*,${accountBalance} AS balance FROM accounts a WHERE a.book_id=$1 AND a.id=$2`,[book,b.id])).rows[0];if(!a)throw new Failure('账户不存在',404);if(a.version!==b.version)throw new Failure('账户已发生变化，请刷新后重试',409);
  if(b.operation==='edit'){await c.query('UPDATE accounts SET name=$1,opening=$2,type=COALESCE($5,type),holder=COALESCE($6,holder),institution=COALESCE($7,institution),suffix=COALESCE($8,suffix),ownership=COALESCE($9,ownership),version=version+1 WHERE id=$3 AND book_id=$4',[b.name,b.opening,b.id,book,b.type,b.holder,b.institution,b.suffix,b.ownership]);}
  if(b.operation==='archive'){await c.query('UPDATE accounts SET archived=$1,version=version+1 WHERE id=$2 AND book_id=$3',[b.archived,b.id,book]);}
  let difference=0;if(b.operation==='reconcile'){if(a.wallet_id)throw new Failure('已关联真实钱包，请在跨账本真实钱包中核对总余额');if(a.balance!==b.expectedBalance)throw new Failure('期间有新的交易，当前余额已变化，请刷新后重新核对',409);difference=b.balance-a.balance;if(difference){await c.query('INSERT INTO account_adjustments(id,book_id,account_id,amount,note,created_by) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),book,b.id,difference,b.note,user]);await c.query('UPDATE accounts SET version=version+1 WHERE id=$1',[b.id]);}}
  return {ok:true,difference};
 });
}
export async function validateActiveAccounts(c:PoolClient,book:string,e:Entry,unchanged:string[]=[]){
 const ids=[e.accountId,...(e.kind==='transfer'&&e.targetId?[e.targetId]:[])];
 const rows=(await c.query('SELECT id,archived FROM accounts WHERE book_id=$1 AND id=ANY($2::uuid[])',[book,ids])).rows;
 for(const id of ids){const account=rows.find(a=>a.id===id);if(!account)throw new Failure('账户不存在或不属于当前账本');if(account.archived&&!unchanged.includes(id))throw new Failure('这个账户已归档，请恢复账户或选择其他账户');}
}

export async function accountReport(book:string,params:URLSearchParams){
 const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
 const p=z.object({from:date,to:date}).parse(Object.fromEntries(params));if(p.to<p.from)throw new Failure('结束日期不能早于开始日期');
 const result=await db.query(`WITH flows AS (SELECT account_id AS id,kind,amount,false AS incoming FROM transactions WHERE book_id=$1 AND NOT deleted AND date BETWEEN $2::date AND $3::date UNION ALL SELECT target_id AS id,kind,amount,true AS incoming FROM transactions WHERE book_id=$1 AND NOT deleted AND kind='transfer' AND date BETWEEN $2::date AND $3::date), totals AS (SELECT id,COALESCE(sum(amount) FILTER(WHERE kind='income'),0)::float8 AS income,COALESCE(sum(amount) FILTER(WHERE kind='expense'),0)::float8 AS expense,COALESCE(sum(amount) FILTER(WHERE kind='refund'),0)::float8 AS refund,COALESCE(sum(amount) FILTER(WHERE kind='transfer' AND incoming),0)::float8 AS "transferIn",COALESCE(sum(amount) FILTER(WHERE kind='transfer' AND NOT incoming),0)::float8 AS "transferOut" FROM flows GROUP BY id) SELECT a.*,a.opening::float8 AS opening,${accountBalance} AS balance,COALESCE(t.income,0) AS income,COALESCE(t.expense,0) AS expense,COALESCE(t.refund,0) AS refund,COALESCE(t."transferIn",0) AS "transferIn",COALESCE(t."transferOut",0) AS "transferOut" FROM accounts a LEFT JOIN totals t ON t.id=a.id WHERE a.book_id=$1 ORDER BY a.archived,a.type,a.name`,[book,p.from,p.to]);
 const accounts=result.rows;
 const sources=(await db.query(`SELECT * FROM (SELECT kind,category,COALESCE(NULLIF(payee,''),'未填写交易对方') AS counterparty,sum(amount)::float8 AS amount,count(*)::int AS count,row_number() OVER(PARTITION BY kind ORDER BY sum(amount) DESC,category,COALESCE(NULLIF(payee,''),'未填写交易对方')) AS ranking FROM transactions WHERE book_id=$1 AND NOT deleted AND kind IN ('income','expense','refund') AND date BETWEEN $2::date AND $3::date GROUP BY kind,category,counterparty) s WHERE ranking<=20 ORDER BY kind,ranking`,[book,p.from,p.to])).rows;
 const ownershipGroups=['shared','personal','unspecified'].map(ownership=>{const group=accounts.filter(a=>a.ownership===ownership);return {ownership,count:group.length,netAssets:group.reduce((n,a)=>n+a.balance,0),expense:group.reduce((n,a)=>n+a.expense-a.refund,0)};});
 return {period:p,accounts,sources,ownershipGroups,summary:{bankDeposits:accounts.filter(a=>a.type==='bank').reduce((n,a)=>n+Math.max(0,a.balance),0),walletAndCash:accounts.filter(a=>['wechat','alipay','cash'].includes(a.type)).reduce((n,a)=>n+Math.max(0,a.balance),0),assets:accounts.reduce((n,a)=>n+Math.max(0,a.balance),0),liabilities:accounts.reduce((n,a)=>n+Math.max(0,-a.balance),0),netAssets:accounts.reduce((n,a)=>n+a.balance,0),income:accounts.reduce((n,a)=>n+a.income,0),expense:accounts.reduce((n,a)=>n+a.expense,0),refund:accounts.reduce((n,a)=>n+a.refund,0)}};
}
