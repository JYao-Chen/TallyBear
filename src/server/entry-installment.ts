import type {PoolClient} from 'pg';
import {entryInstallment} from '@/lib/entry-installment';
import {Failure} from './access';
export async function attachEntryInstallment(c:PoolClient,book:string,user:string,id:string,value:unknown){
 if(value==null)return;
 const plan=entryInstallment.parse(value);
 if(plan.fees==null||!plan.terms||!/^\d{4}-\d{2}-\d{2}$/.test(plan.firstDate))throw new Failure('请补充分期期数、首次还款日期和总手续费');
 const t=(await c.query('SELECT title,payee,event_id FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted',[id,book])).rows[0];
 if(!t)throw new Failure('分期原消费不存在');
 if(t.event_id&&(await c.query('SELECT id FROM installment_plans WHERE event_id=$1',[t.event_id])).rowCount)throw new Failure('这笔消费已有分期，请在原分期计划中调整，不能重复建立');
 const {changeInstallment}=await import('./installments');
 await changeInstallment(user,{operation:'create',requestId:id,book,transactionId:id,name:(t.title||t.payee||'消费分期').slice(0,80),...plan},c);
}
