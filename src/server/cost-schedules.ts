import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {transaction,withConnection,lockBook} from './db';
import {Failure} from './access';
import {entry} from './model';
import {insertEntry} from './ledger';
import {costProjects} from './cost-projects';
import {costScheduleSchema,scheduledCostPlan,costScheduleProgress} from '@/lib/cost-schedule';
import {advancePeriod} from '@/lib/period';

const uuid=z.string().uuid();
export async function costSchedules(user:string,method:string,path:string[],body:any,params:URLSearchParams){
 return transaction(async c=>{
  const accessible=`(s.owner_id=$1 OR EXISTS(SELECT 1 FROM cost_schedule_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=s.family_id WHERE m.schedule_id=s.id AND m.user_id=$1))`;
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
  async function bookAccess(book:string,person:string){if(!(await c.query("SELECT 1 FROM members WHERE book_id=$1 AND user_id=$2 AND role<>'viewer'",[book,person])).rowCount)throw new Failure('请选择本人可编辑的账本',403);}
  async function membersValid(s:any){
   const ids=s.rule.shares.map((p:any)=>p.userId);
   if(ids.length>1&&(!s.family_id||(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=ANY($2::uuid[])',[s.family_id,ids])).rowCount!==ids.length))throw new Failure('参与人已不在同一家庭，请暂停并重新建立计划');
  }
  if(method==='GET'&&!path[1]){
   const offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
   const rows=(await c.query(`SELECT s.*,to_char(s.next_date,'YYYY-MM-DD') AS next_date,count(*) OVER()::int AS total FROM cost_schedules s WHERE ${accessible} ORDER BY s.paused,s.next_date,s.id LIMIT 20 OFFSET $2`,[user,offset])).rows;
   for(const s of rows){s.members=(await c.query('SELECT m.user_id,m.accepted,u.name,CASE WHEN m.user_id=$2 THEN m.book_id ELSE NULL END AS book_id FROM cost_schedule_members m JOIN users u ON u.id=m.user_id WHERE schedule_id=$1',[s.id,user])).rows;const processed=Number((await c.query('SELECT count(*) AS n FROM cost_schedule_occurrences WHERE schedule_id=$1',[s.id])).rows[0].n);Object.assign(s,costScheduleProgress(s.rule,processed));s.due=!s.completed&&!s.paused&&s.next_date<=today;}
   return rows;
  }
  if(method==='POST'&&!path[1]){
   const rule=costScheduleSchema.parse(body.rule),id=uuid.parse(body.id),book=uuid.parse(body.bookId);
   scheduledCostPlan(rule,rule.firstDate,randomUUID());
   if(!rule.shares.some(s=>s.userId===user))throw new Failure('参与人须包含付款人');
   await membersValid({rule,family_id:rule.familyId});await bookAccess(book,user);
   const old=(await c.query('SELECT owner_id,rule FROM cost_schedules WHERE id=$1',[id])).rows[0];
   if(old){if(old.owner_id===user&&isDeepStrictEqual(old.rule,rule))return {id};throw new Failure('计划编号已使用',409);}
   await c.query('INSERT INTO cost_schedules(id,owner_id,family_id,rule,next_date) VALUES($1,$2,$3,$4,$5)',[id,user,rule.familyId,JSON.stringify(rule),rule.firstDate]);
   for(const p of rule.shares)await c.query('INSERT INTO cost_schedule_members VALUES($1,$2,$3,$4)',[id,p.userId,p.userId===user,p.userId===user?book:null]);
   return {id};
  }
  const id=uuid.parse(path[1]);
  const s=(await c.query(`SELECT s.*,to_char(next_date,'YYYY-MM-DD') AS next_date FROM cost_schedules s WHERE s.id=$2 AND ${accessible} FOR UPDATE OF s`,[user,id])).rows[0];
  if(!s)throw new Failure('周期计划不存在或无权访问',404);
  if(method==='GET'&&path[2]==='history'){
   const offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
   return (await c.query('SELECT to_char(due_date,\'YYYY-MM-DD\') AS due_date,project_id,skipped,count(*) OVER()::int AS total FROM cost_schedule_occurrences WHERE schedule_id=$1 ORDER BY due_date DESC LIMIT 20 OFFSET $2',[id,offset])).rows;
  }
  if(method!=='POST')throw new Failure('操作不存在',404);
  if(path[2]==='confirm'||path[2]==='skip'){
   if(user!==s.owner_id)throw new Failure('请由付款人确认',403);
   const done=(await c.query('SELECT project_id,skipped FROM cost_schedule_occurrences WHERE schedule_id=$1 AND due_date=$2',[id,body.dueDate])).rows[0];
   if(done)return {alreadyProcessed:true,...done};
  }
  if(z.number().int().parse(body.version)!==s.version)throw new Failure('计划已变化，请刷新后重试',409);
  if(path[2]==='respond'){
   await membersValid(s);const accepted=z.boolean().parse(body.accept),book=accepted?uuid.parse(body.bookId):null;
   if(book)await bookAccess(book,user);
   await c.query('UPDATE cost_schedule_members SET accepted=$3,book_id=$4 WHERE schedule_id=$1 AND user_id=$2',[id,user,accepted,book]);
   await c.query('UPDATE cost_schedules SET version=version+1 WHERE id=$1',[id]);return {ok:true};
  }
  if(user!==s.owner_id)throw new Failure('请由计划创建人操作',403);
  const processed=Number((await c.query('SELECT count(*) AS n FROM cost_schedule_occurrences WHERE schedule_id=$1',[id])).rows[0].n);
  if(path[2]==='edit'){
   const rule=costScheduleSchema.parse(body.rule),book=uuid.parse(body.bookId);
   scheduledCostPlan(rule,rule.firstDate,randomUUID());
   if(!rule.shares.some(p=>p.userId===user))throw new Failure('参与人须包含付款人');
   await membersValid({rule,family_id:rule.familyId});await bookAccess(book,user);
   if(processed&&(rule.firstDate!==s.rule.firstDate||rule.months!==s.rule.months))throw new Failure('已有账期记录，首次日期和周期不可修改；请另建计划');
   if(rule.totalCycles!=null&&rule.totalCycles<processed)throw new Failure('总期数不能少于已处理账期数');
   const changed=rule.familyId!==s.rule.familyId||rule.category!==s.rule.category||rule.firstDate!==s.rule.firstDate||rule.months!==s.rule.months||!isDeepStrictEqual(rule.shares,s.rule.shares)||((rule.totalCycles??Infinity)>(s.rule.totalCycles??Infinity));
   await c.query('UPDATE cost_schedules SET rule=$2,family_id=$3,next_date=$4,version=version+1 WHERE id=$1',[id,JSON.stringify(rule),rule.familyId,processed?s.next_date:rule.firstDate]);
   await c.query('DELETE FROM cost_schedule_members WHERE schedule_id=$1 AND NOT(user_id=ANY($2::uuid[]))',[id,rule.shares.map(p=>p.userId)]);
   for(const p of rule.shares)await c.query(`INSERT INTO cost_schedule_members(schedule_id,user_id,accepted,book_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(schedule_id,user_id) DO UPDATE SET accepted=CASE WHEN $3 THEN true WHEN $5 THEN false ELSE cost_schedule_members.accepted END,book_id=CASE WHEN $3 THEN $4 ELSE cost_schedule_members.book_id END`,[id,p.userId,p.userId===user,p.userId===user?book:null,changed]);
   return {id,requiresAcceptance:changed};
  }
  if(path[2]==='pause'){await c.query('UPDATE cost_schedules SET paused=$2,version=version+1 WHERE id=$1',[id,z.boolean().parse(body.paused)]);return {ok:true};}
  if(!['confirm','skip'].includes(path[2]))throw new Failure('操作不存在',404);
  if(costScheduleProgress(s.rule,processed).completed)throw new Failure('计划已完成全部账期');
  if(s.paused||s.next_date!==body.dueDate||s.next_date>today)throw new Failure('账期未到、已暂停或已改变');
  const next=advancePeriod(s.next_date,'month',s.rule.months,Number(s.rule.firstDate.slice(8)));
  let projectId:string|null=null;
  if(path[2]==='confirm'){
   await membersValid(s);
   const members=(await c.query('SELECT * FROM cost_schedule_members WHERE schedule_id=$1',[id])).rows;
   if(members.some(m=>!m.accepted||!m.book_id))throw new Failure('请所有参与人先接受分担并选择归属账本');
   for(const m of members)await bookAccess(m.book_id,m.user_id);
   const paymentBook=uuid.parse(body.bookId);await bookAccess(paymentBook,user);await lockBook(c,paymentBook);
   let transactionId=body.transactionId?uuid.parse(body.transactionId):randomUUID();
   const plan=scheduledCostPlan(s.rule,s.next_date,transactionId),amount=plan.sources[0].amount;
   if(body.transactionId){
    const existing=(await c.query("SELECT id,amount FROM transactions WHERE id=$1 AND book_id=$2 AND kind='expense' AND NOT deleted",[transactionId,paymentBook])).rows[0];
    if(!existing||Number(existing.amount)!==amount)throw new Failure('请选择金额与本期一致的原付款；金额变更请暂停后重建计划');
   }else{
    if(!body.paidDate||body.paidDate>today)throw new Failure('请填写实际付款日期，不能晚于今天');
    const item=entry.parse({id:transactionId,kind:'expense',title:s.rule.title,category:s.rule.category,amount,date:body.paidDate,accountId:body.accountId,note:body.note||''});
    if(!(await c.query('SELECT 1 FROM accounts WHERE id=$1 AND owner_id=$2 AND NOT archived',[item.accountId,user])).rowCount)throw new Failure('请选择本人实际付款钱包');
    await insertEntry(c,paymentBook,user,item);
   }
   // The payment, attribution, cycle advance and deduplication marker commit together.
   const result=await withConnection(c,()=>costProjects(user,'POST',['cost-projects'],{plan},new URLSearchParams()));
   projectId=(result as {id:string}).id;
   await c.query('UPDATE cost_projects SET active_plan=proposed_plan,proposed_plan=NULL WHERE id=$1',[projectId]);
   for(const m of members)await c.query('UPDATE cost_project_members SET accepted_version=1,display_book_id=$3 WHERE project_id=$1 AND user_id=$2',[projectId,m.user_id,m.book_id]);
  }
  await c.query('INSERT INTO cost_schedule_occurrences VALUES($1,$2,$3,$4)',[id,s.next_date,projectId,path[2]==='skip']);
  await c.query('UPDATE cost_schedules SET next_date=$2,version=version+1 WHERE id=$1',[id,next]);
  return {project_id:projectId,nextDate:next};
 });
}
