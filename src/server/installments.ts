import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {accountAccess} from './accounts';
import {Failure} from './access';
import {entry} from './model';
import {insertEntry} from './ledger';
import {installmentSchedule,remainingPrincipal,dueProgress,type InstallmentDue} from '@/lib/installments';
const money=z.number().int().nonnegative().max(100000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'日期无效');
const totals=`p.*,p.principal::float8 AS principal,p.schedule_base::float8 AS schedule_base,a.name AS account_name,a.owner_id,a.family_id,COALESCE(f.name,u.name) AS owner_name,
 COALESCE((SELECT sum(principal) FROM installment_payments WHERE plan_id=p.id AND NOT voided),0)::float8 AS paid,
 COALESCE((SELECT sum(fee) FROM installment_payments WHERE plan_id=p.id AND NOT voided),0)::float8 AS paid_fees,
 COALESCE((SELECT sum(amount) FROM (SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions original ON original.id=r.refund_of WHERE original.event_id=p.event_id AND r.account_id=p.account_id AND r.kind='refund' AND NOT r.deleted ORDER BY COALESCE(r.event_id,r.id)) x),0)::float8 AS refunded`;
async function writeBook(c:PoolClient,book:string,user:string){const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[book,user])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('没有此账本的记账权限',403);}
async function readPlans(user:string,c:{query:PoolClient['query']}=db,id?:string){return (await c.query(`SELECT ${totals} FROM installment_plans p JOIN accounts a ON a.id=p.account_id LEFT JOIN families f ON f.id=a.family_id LEFT JOIN users u ON u.id=a.owner_id WHERE ${accountAccess('$1')} AND ($2::uuid IS NULL OR p.id=$2) ORDER BY p.created_at DESC`,[user,id||null])).rows.map(p=>({...p,remaining:remainingPrincipal(p.principal,p.paid,p.refunded),dues:dueProgress(p.schedule,Math.max(0,p.paid+p.refunded-p.schedule_base))}));}
export async function listInstallments(user:string){const plans=await readPlans(user);const payments=(await db.query(`SELECT r.id,r.plan_id,r.principal::float8 AS principal,r.fee::float8 AS fee,to_char(r.date,'YYYY-MM-DD') AS date,r.voided,r.created_at FROM installment_payments r WHERE plan_id=ANY($1::uuid[]) ORDER BY r.date DESC,r.created_at DESC`,[plans.map(p=>p.id)])).rows;return {plans:plans.map(p=>({...p,payments:payments.filter(r=>r.plan_id===p.id)})),summary:{remaining:plans.reduce((n,p)=>n+p.remaining,0),paid:plans.reduce((n,p)=>n+p.paid,0),fees:plans.reduce((n,p)=>n+p.paid_fees,0)}};}
const terms={terms:z.number().int().min(1).max(600),firstDate:date,fees:money.default(0)};
export async function changeInstallment(user:string,body:unknown, connection?:PoolClient){
 const b=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('create'),requestId:z.string().uuid(),book:z.string().uuid(),name:z.string().trim().min(1).max(80),transactionId:z.string().uuid().optional(),purchase:z.unknown().optional(),...terms,allocate:z.boolean().default(false),allocationStart:date.optional(),allocationMonths:z.number().int().positive().max(1200).optional()}),
 z.object({operation:z.literal('schedule'),id:z.string().uuid(),version:z.number().int(),name:z.string().trim().min(1).max(80),...terms,schedule:z.array(z.object({date,principal:money,fee:money})).min(1).max(600).optional()}),
 z.object({operation:z.literal('pay'),id:z.string().uuid(),version:z.number().int(),requestId:z.string().uuid(),book:z.string().uuid(),accountId:z.string().uuid(),date,principal:money,fee:money,feeCategory:z.string().min(1).max(60).default('其他'),settle:z.boolean().default(false)}),
 z.object({operation:z.literal('void'),id:z.string().uuid(),version:z.number().int(),paymentId:z.string().uuid()}),
 z.object({operation:z.literal('delete'),id:z.string().uuid(),version:z.number().int()})
 ]).parse(body);
 return transaction(async c=>{
  if(b.operation==='create'){
   await lockBook(c,b.book);await writeBook(c,b.book,user);
   if((await c.query(`SELECT p.id FROM installment_plans p JOIN accounts a ON a.id=p.account_id WHERE p.id=$1 AND ${accountAccess('$2')}`,[b.requestId,user])).rowCount)return {ok:true,alreadyProcessed:true,id:b.requestId};
   let t:any;
   if(b.transactionId)t=(await c.query("SELECT *,amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE id=$1 AND book_id=$2 AND kind='expense' AND NOT deleted FOR UPDATE",[b.transactionId,b.book])).rows[0];
   else{const purchase=entry.parse({...b.purchase as object,id:randomUUID(),kind:'expense'});await insertEntry(c,b.book,user,purchase);t=(await c.query("SELECT *,amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE id=$1",[purchase.id])).rows[0];}
   if(!t)throw new Failure('请选择已有消费，或填写分期购买信息');
   const a=(await c.query(`SELECT a.* FROM accounts a WHERE id=$1 AND ${accountAccess('$2')} FOR UPDATE`,[t.account_id,user])).rows[0];
   if(!a||a.archived||a.type!=='credit')throw new Failure('请选择自己或家庭可管理的信用卡／白条／花呗负债账户');
   if(b.firstDate<t.date)throw new Failure('首次还款日不能早于购买日期');
   const event=t.event_id||randomUUID();
   if((await c.query('SELECT 1 FROM installment_plans WHERE event_id=$1',[event])).rowCount)throw new Failure('这笔消费已经有分期计划');
   await c.query('UPDATE transactions SET event_id=$1,version=version+1 WHERE id=$2',[event,t.id]);
   const id=b.requestId;const refunded=Number((await c.query("SELECT COALESCE(sum(amount),0) AS amount FROM (SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions o ON o.id=r.refund_of WHERE o.event_id=$1 AND r.account_id=$2 AND r.kind='refund' AND NOT r.deleted) x",[event,a.id])).rows[0].amount);
   const remaining=remainingPrincipal(t.amount,0,refunded);if(!remaining)throw new Failure('这笔消费已全额退回负债账户，无需建立分期');
   await c.query('INSERT INTO installment_plans(id,account_id,event_id,name,principal,schedule,schedule_base,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,a.id,event,b.name,t.amount,JSON.stringify(installmentSchedule(remaining,b.terms,b.firstDate,b.fees)),refunded,user]);
   if(b.allocate){if(!b.allocationStart||!b.allocationMonths)throw new Failure('请填写独立的费用分摊开始日期和月数');await c.query("INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,$2,$3,$2,'month',$3) ON CONFLICT(transaction_id) DO UPDATE SET start_month=$2,months=$3,start_date=$2,period_unit='month',period_count=$3",[t.id,b.allocationStart.slice(0,7)+'-01',b.allocationMonths]);}
   return {ok:true,id};
  }
  if(b.operation==='pay'){await lockBook(c,b.book);await writeBook(c,b.book,user);}
  await c.query('SELECT id FROM installment_plans WHERE id=$1 FOR UPDATE',[b.id]);
  await c.query('SELECT a.id FROM accounts a JOIN installment_plans p ON p.account_id=a.id WHERE p.id=$1 FOR UPDATE OF a',[b.id]);
  const p=(await readPlans(user,c,b.id))[0];if(!p)throw new Failure('没有这项分期的管理权限',403);
  if(b.operation==='pay'&&(await c.query('SELECT 1 FROM installment_payments WHERE id=$1 AND plan_id=$2',[b.requestId,p.id])).rowCount)return {ok:true,alreadyProcessed:true};
  if(p.version!==b.version)throw new Failure('分期已变化，请刷新后重试',409);
  if(b.operation==='delete'){if((await c.query('SELECT 1 FROM installment_payments WHERE plan_id=$1 AND NOT voided',[p.id])).rowCount)throw new Failure('请先撤销实际还款，再移除计划；原消费和分摊会保留');await c.query('DELETE FROM installment_payments WHERE plan_id=$1',[p.id]);await c.query('DELETE FROM installment_plans WHERE id=$1',[p.id]);return {ok:true};}
  if(b.operation==='schedule'){
   if(!p.remaining)throw new Failure('本金已结清，无需调整后续计划');const schedule:InstallmentDue[]=b.schedule||installmentSchedule(p.remaining,b.terms,b.firstDate,b.fees);
   if(schedule.reduce((n,r)=>n+r.principal,0)!==p.remaining)throw new Failure('后续各期本金之和必须等于剩余本金');
   if(schedule.some((r,i)=>i>0&&r.date<schedule[i-1].date))throw new Failure('还款日期需按先后顺序排列');
   await c.query('UPDATE installment_plans SET name=$1,schedule=$2,schedule_base=$3,version=version+1 WHERE id=$4',[b.name,JSON.stringify(schedule),p.paid+p.refunded,p.id]);return {ok:true};
  }
  if(b.operation==='void'){
   const payment=(await c.query('SELECT * FROM installment_payments WHERE id=$1 AND plan_id=$2 AND NOT voided',[b.paymentId,p.id])).rows[0];if(!payment)throw new Failure('还款已撤销或不存在');
   const tx=(await c.query('SELECT DISTINCT book_id FROM transactions WHERE event_id=ANY($1::uuid[]) AND NOT deleted',[[payment.principal_event,payment.fee_event].filter(Boolean)])).rows;
   for(const t of tx){await lockBook(c,t.book_id);await writeBook(c,t.book_id,user);}
   await c.query('UPDATE installment_payments SET voided=true WHERE id=$1',[payment.id]);
   await c.query('UPDATE transactions SET deleted=true,version=version+1 WHERE event_id=ANY($1::uuid[])',[[payment.principal_event,payment.fee_event].filter(Boolean)]);
   // Rebuild the future schedule from the newly reopened principal; keep every payment in history.
   const next=(await readPlans(user,c,p.id))[0];const first=p.schedule[0]?.date||new Date(payment.date).toISOString().slice(0,10);
   await c.query('UPDATE installment_plans SET schedule=$1,schedule_base=$2,version=version+1 WHERE id=$3',[JSON.stringify(next.remaining?installmentSchedule(next.remaining,Math.max(1,p.schedule.length),first,p.schedule.reduce((n:number,r:InstallmentDue)=>n+r.fee,0)):[]),next.paid+next.refunded,p.id]);return {ok:true};
  }
  if(b.principal+b.fee===0)throw new Failure('请填写实际还款本金或费用');if(b.principal>p.remaining)throw new Failure('还款本金超过剩余本金');if(b.settle&&b.principal!==p.remaining)throw new Failure('提前结清需要归还全部剩余本金，费用按实际账单填写');
  if(b.accountId===p.account_id)throw new Failure('付款钱包不能是当前负债账户');
  await lockBook(c,b.book);await writeBook(c,b.book,user);
  const purchaseDate=(await c.query("SELECT to_char(min(date),'YYYY-MM-DD') AS date FROM transactions WHERE event_id=$1",[p.event_id])).rows[0].date;const purchaseDay=purchaseDate;if(b.date<purchaseDay)throw new Failure('还款日期不能早于购买日期');
  const pe=b.principal?randomUUID():null,fe=b.fee?randomUUID():null;
  if(pe)await insertEntry(c,b.book,user,entry.parse({id:randomUUID(),kind:'transfer',accountId:b.accountId,targetId:p.account_id,amount:b.principal,date:b.date,title:p.name+' · 还本金',category:b.feeCategory}),pe);
  if(fe)await insertEntry(c,b.book,user,entry.parse({id:randomUUID(),kind:'expense',accountId:b.accountId,amount:b.fee,date:b.date,title:p.name+' · 利息与手续费',category:b.feeCategory}),fe);
  await c.query('INSERT INTO installment_payments(id,plan_id,principal,fee,date,principal_event,fee_event,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[b.requestId,p.id,b.principal,b.fee,b.date,pe,fe,user]);
  await c.query('UPDATE installment_plans SET version=version+1 WHERE id=$1',[p.id]);return {ok:true};
 },connection);
}
