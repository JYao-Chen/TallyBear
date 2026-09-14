import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction,lockBook} from './db';
import {entry} from './model';
import {insertEntry} from './ledger';
import {validateActiveAccounts} from './accounts';
import {checkCategory} from './categories';
import {Failure} from './access';
import {advancePeriod as calculatePeriod,type PeriodUnit} from '../lib/period';
const unitOf=(frequency:string)=>({daily:'day',weekly:'week',monthly:'month',yearly:'year'}[frequency] as PeriodUnit);
function advancePeriod(start:string,unit:PeriodUnit,count:number,anchor?:number){try{return calculatePeriod(start,unit,count,anchor);}catch(e){throw new Failure(e instanceof Error?e.message:'周期无效');}}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'日期无效');
export async function schedules(book:string,user:string,method:string,body:unknown){
 if(method==='GET')return (await db.query("SELECT id,name,value,frequency,interval_count,interval_months,amortize,to_char(next_date,'YYYY-MM-DD') AS next_date,paused,version FROM bill_schedules WHERE book_id=$1 AND user_id=$2 ORDER BY paused,next_date,name",[book,user])).rows;
 const b=z.object({id:z.string().uuid().optional(),version:z.number().int().optional(),operation:z.enum(['save','pause','confirm','skip','delete']).default('save'),name:z.string().trim().min(1).max(80).optional(),value:z.unknown().optional(),frequency:z.enum(['daily','weekly','monthly','yearly']).optional(),nextDate:date.optional(),dueDate:date.optional(),paidDate:date.optional(),amount:z.number().int().positive().max(100000000000).optional(),intervalCount:z.number().int().positive().safe().optional(),intervalMonths:z.number().int().min(1).optional(),startDate:date.optional(),amortize:z.boolean().default(false),startMonth:z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/).optional(),paused:z.boolean().optional()}).parse(body);
 return transaction(async c=>{await lockBook(c,book);const old=b.id?(await c.query("SELECT *,to_char(next_date,'YYYY-MM-DD') AS next_date FROM bill_schedules WHERE id=$1 AND book_id=$2 AND user_id=$3",[b.id,book,user])).rows[0]:null;if(b.id&&!old)throw new Failure('周期账单不存在',404);
  if(b.operation==='confirm'||b.operation==='skip'){
   if(!old||!b.dueDate)throw new Failure('请选择要处理的账期');const done=await c.query('SELECT transaction_id FROM schedule_occurrences WHERE schedule_id=$1 AND due_date=$2',[old.id,b.dueDate]);if(done.rowCount)return {ok:true,alreadyProcessed:true};
  }
  if(old&&old.version!==b.version)throw new Failure('周期账单已变化，请刷新后重试',409);
  if(b.operation==='save'){
   if(!b.name||!b.frequency||!b.nextDate)throw new Failure('请填写名称、周期和下一次日期');const item=entry.parse({...b.value as object,id:randomUUID(),date:b.nextDate});if(item.kind==='refund')throw new Failure('退款请关联原消费单独记账');await validateActiveAccounts(c,book,item);await checkCategory(c,book,item.category);
   if(b.amortize&&item.kind!=='expense')throw new Failure('费用分摊只适用于支出');const count=b.intervalCount||(b.frequency==='yearly'?Math.max(1,(b.intervalMonths||12)/12):b.intervalMonths||1);advancePeriod(b.nextDate,unitOf(b.frequency),count);const interval=b.frequency==='daily'||b.frequency==='weekly'?0:count*(b.frequency==='yearly'?12:1);
   const {title,kind,amount,accountId,targetId,payee,category,note,product}=item;const value=JSON.stringify({title,kind,amount,accountId,targetId,payee,category,note,product});const anchor=old&&old.next_date===b.nextDate?old.anchor_day:Number(b.nextDate.slice(8));
   if(old)await c.query('UPDATE bill_schedules SET name=$1,value=$2::jsonb,frequency=$3,next_date=$4,anchor_day=$5,interval_months=$7,amortize=$8,interval_count=$9,version=version+1 WHERE id=$6',[b.name,value,b.frequency,b.nextDate,anchor,old.id,interval,b.amortize,count]);else await c.query('INSERT INTO bill_schedules(id,book_id,user_id,name,value,frequency,next_date,anchor_day,interval_months,amortize,interval_count) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)',[randomUUID(),book,user,b.name,value,b.frequency,b.nextDate,anchor,interval,b.amortize,count]);return {ok:true};
  }
  if(!old)throw new Failure('请选择周期账单');
  if(b.operation==='delete'){await c.query('DELETE FROM bill_schedules WHERE id=$1',[old.id]);return {ok:true};}
  if(b.operation==='pause'){await c.query('UPDATE bill_schedules SET paused=$1,version=version+1 WHERE id=$2',[!!b.paused,old.id]);return {ok:true};}
  if(old.paused)throw new Failure('账单已暂停，请先恢复');if(old.next_date!==b.dueDate)throw new Failure('账期已改变，请刷新',409);
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});if(old.next_date>today)throw new Failure('本期还未到期，如需提前处理请先修改日期');
  let transactionId:string|null=null;if(b.operation==='confirm'){if(!b.paidDate||!b.amount)throw new Failure('请核对实际日期和金额');transactionId=randomUUID();const item=entry.parse({...old.value,id:transactionId,date:b.paidDate,amount:b.amount});await insertEntry(c,book,user,item);if(old.amortize){const unit=unitOf(old.frequency),start=unit==='day'||unit==='week'?(b.startDate||b.paidDate):(b.startMonth||b.paidDate.slice(0,7))+'-01';advancePeriod(start,unit,old.interval_count);await c.query('INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,$2,$3,$4,$5,$6)',[transactionId,start.slice(0,7)+'-01',Math.max(1,old.interval_months),start,unit,old.interval_count]);}}
  await c.query('INSERT INTO schedule_occurrences(schedule_id,due_date,transaction_id) VALUES($1,$2,$3)',[old.id,b.dueDate,transactionId]);const next=advancePeriod(old.next_date,unitOf(old.frequency),old.interval_count,old.anchor_day);await c.query('UPDATE bill_schedules SET next_date=$1,version=version+1 WHERE id=$2',[next,old.id]);return {ok:true,nextDate:next,transactionId};
 });
}
