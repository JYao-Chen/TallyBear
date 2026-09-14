import {checkVerification} from '@/lib/verification';
import {linkReceipts} from './receipts';
import {checkCategory} from './categories';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {entry} from './model';
import {validateActiveAccounts} from './accounts';
import {Failure} from './access';
export type Entry=z.infer<typeof entry>;
export {lockBook} from './db';
export async function validateRefund(c:PoolClient,book:string,e:Entry,eventId?:string){
 const own=(await c.query('SELECT event_id FROM transactions WHERE id=$1',[e.id])).rows[0];eventId??=own?.event_id;
 if(e.kind==='expense'&&eventId){const refunded=Number((await c.query("SELECT COALESCE(sum(amount),0) AS total FROM (SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions original ON original.id=r.refund_of WHERE original.event_id=$1 AND NOT r.deleted AND r.kind='refund' ORDER BY COALESCE(r.event_id,r.id)) x",[eventId])).rows[0].total);if(refunded>e.amount)throw new Failure('金额不能小于所有关联账本中的去重退款总额');}
 const linked=(await c.query('SELECT id FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted',[book,e.id])).rows;
 if(linked.length&&(e.kind!=='expense'))throw new Failure('这笔消费已有退款，不能改为其他类型');
 if(linked.length){const total=Number((await c.query('SELECT sum(amount) AS total FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted',[book,e.id])).rows[0].total);if(total>e.amount)throw new Failure('消费金额不能小于已关联退款总额');const dates=await c.query('SELECT id FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted AND date<$3::date',[book,e.id,e.date]);if(dates.rowCount)throw new Failure('消费日期不能晚于已关联退款');}
 if(e.kind!=='refund'){if(e.refundOf)throw new Failure('只有退款记录可以关联原消费');return;}
 if(!e.refundOf)return;
 const original=(await c.query("SELECT event_id,amount::float8 AS amount,category,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE id=$1 AND book_id=$2 AND kind='expense' AND NOT deleted",[e.refundOf,book])).rows[0];
 if(!original)throw new Failure('请选择当前账本中有效的原消费');
 if(e.date<original.date)throw new Failure('退款到账日期不能早于原消费');
 const total=Number((await c.query('SELECT COALESCE(sum(amount),0) AS total FROM transactions WHERE book_id=$1 AND refund_of=$2 AND id<>$3 AND NOT deleted',[book,e.refundOf,e.id])).rows[0].total);
 if(original.event_id){const combined=Number((await c.query("SELECT COALESCE(sum(amount),0) AS total FROM (SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions original ON original.id=r.refund_of WHERE original.event_id=$1 AND r.kind='refund' AND NOT r.deleted AND r.id<>$2 AND ($3::uuid IS NULL OR r.event_id IS DISTINCT FROM $3) ORDER BY COALESCE(r.event_id,r.id)) x",[original.event_id,e.id,eventId||null])).rows[0].total);if(combined+e.amount>original.amount)throw new Failure('所有关联账本中的去重退款合计超过原消费金额');}
 if(total+e.amount>original.amount)throw new Failure('累计退款超过原消费金额，请核对退款或关联的订单');
 e.category=original.category;
}
export async function insertEntry(c:PoolClient,book:string,user:string,e:Entry,eventId?:string,preserveAccounts:string[]=[]){
 const exists=await c.query('SELECT id FROM transactions WHERE id=$1 OR (book_id=$2 AND external_id=$3)',[e.id,book,e.externalId||null]);if(exists.rowCount)return 0;
 checkVerification(e.lineItems,e.amount,e.verificationReason);await validateActiveAccounts(c,book,e,user,preserveAccounts);await validateRefund(c,book,e,eventId);await checkCategory(c,book,e.category);
 const r=await c.query('INSERT INTO transactions(id,book_id,account_id,target_id,kind,amount,date,payee,category,note,external_id,created_by,platform,order_id,product,occurred_at,source,refund_of,event_id,line_items) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb) ON CONFLICT DO NOTHING',[e.id,book,e.accountId,e.kind==='transfer'?e.targetId:null,e.kind,e.amount,e.date,e.payee,e.category,e.note,e.externalId||null,user,e.platform,e.orderId,e.product,e.occurredAt,e.source,e.refundOf||null,eventId||null,JSON.stringify(e.lineItems)]);if(r.rowCount){await c.query('UPDATE transactions SET verification_reason=$1,title=$3,scene=$4::jsonb WHERE id=$2',[e.verificationReason,e.id,e.title,JSON.stringify(e.scene)]);await linkReceipts(c,book,user,e.id,e.attachmentIds,e.retainReceipts);await linkReceipts(c,book,user,e.id,e.photoIds,true,'photo');}return r.rowCount||0;
}
