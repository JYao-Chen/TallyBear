import {copyFile} from 'node:fs/promises';
import path from 'node:path';
import {receiptDirectory} from './receipts';
import {withReceiptTransaction} from './move-entry';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {Failure} from './access';
import {entry} from './model';
import {insertEntry,validateRefund,type Entry} from './ledger';
export async function lockRelatedBooks(c:PoolClient,book:string,id:string,user:string,targetBook?:string){
 const ids=(await c.query('SELECT DISTINCT book_id FROM transactions WHERE event_id=(SELECT event_id FROM transactions WHERE id=$1 AND book_id=$2)',[id,book])).rows.map(x=>x.book_id);for(const b of Array.from(new Set([book,...ids,...(targetBook?[targetBook]:[])])).sort())await lockBook(c,b);
}
export async function syncFinancialFacts(c:PoolClient,book:string,e:Entry,user:string){
 const old=(await c.query('SELECT account_id,target_id,event_id,refund_of,amount::float8 AS amount,kind,to_char(date,\'YYYY-MM-DD\') AS date FROM transactions WHERE id=$1 AND book_id=$2',[e.id,book])).rows[0];if(!old?.event_id)return;if(old.kind!==e.kind)throw new Failure('关联记录不能更改收支类型，请新建正确类型的记录');if((old.refund_of||null)!==(e.refundOf||null))throw new Failure('关联退款的原消费不能只在一个账本更改');if(old.amount===e.amount&&old.date===e.date&&old.account_id===e.accountId&&old.target_id===(e.targetId||null))return;
 if(e.kind==='transfer')throw new Failure('跨账本关联的记录不能改为账户转账');
 const copies=(await c.query("SELECT t.*,m.role FROM transactions t LEFT JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE t.event_id=$1 AND t.id<>$3",[old.event_id,user,e.id])).rows;
 if(copies.some(x=>!x.role||x.role==='viewer'))throw new Failure('修改这笔关联记录的金额、日期或付款账户，需要拥有所有关联账本的记账权限');
 for(const t of copies){await validateRefund(c,t.book_id,{...e,id:t.id,accountId:t.account_id,targetId:t.target_id,category:t.category,refundOf:t.refund_of});await c.query('UPDATE transactions SET amount=$1,date=$2,kind=$3,account_id=$5,version=version+1 WHERE id=$4',[e.amount,e.date,e.kind,t.id,e.accountId]);}
}
export async function reuseInTransaction(c:PoolClient,book:string,user:string,sourceId:string,version:number,targetBook:string,copied:string[]){
 const source=(await c.query("SELECT *,amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted",[sourceId,book])).rows[0];if(!source)throw new Failure('原记录不存在');if(source.version!==version)throw new Failure('原记录已变化，请重新打开',409);if(source.kind==='transfer')throw new Failure('账户间转账请在各账本单独处理');const event=source.event_id||randomUUID();const existing=(await c.query('SELECT id,deleted FROM transactions WHERE book_id=$1 AND event_id=$2',[targetBook,event])).rows[0];if(existing){if(existing.deleted)throw new Failure('目标账本曾移除这笔关联记录，请先恢复该记录');return {ok:true,alreadyExists:true,id:existing.id};}
 let refundOf=null;if(source.refund_of){const original=(await c.query('SELECT event_id FROM transactions WHERE id=$1',[source.refund_of])).rows[0];const target=(await c.query('SELECT id FROM transactions WHERE event_id=$1 AND book_id=$2 AND NOT deleted',[original?.event_id,targetBook])).rows[0];if(!target)throw new Failure('请先把原消费复用到目标账本，再复用这笔退款');refundOf=target.id;}
 const id=randomUUID();const e=entry.parse({id,accountId:source.account_id,kind:source.kind,amount:source.amount,date:source.date,payee:source.payee,category:source.category,note:source.note,externalId:source.external_id||undefined,title:source.title,product:source.product,lineItems:source.line_items,verificationReason:source.verification_reason,platform:source.platform,orderId:source.order_id,refundOf});await c.query('UPDATE transactions SET event_id=$1,version=version+1 WHERE id=$2',[event,source.id]);const added=await insertEntry(c,targetBook,user,e,event,[source.account_id]);if(!added)throw new Failure('目标账本已有相同流水号，请核对已有记录，未新增');await c.query('UPDATE transactions SET event_id=$1 WHERE id=$2',[event,id]);await c.query('INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) SELECT $1,start_month,months,start_date,period_unit,period_count FROM expense_allocations WHERE transaction_id=$2',[id,source.id]);const files=(await c.query('SELECT f.*,r.purpose FROM receipt_files f JOIN transaction_receipts r ON r.file_id=f.id WHERE r.transaction_id=$1',[source.id])).rows;
 for(const f of files){const fileId=randomUUID();copied.push(fileId);await copyFile(path.join(receiptDirectory(),f.id),path.join(receiptDirectory(),fileId));await c.query('INSERT INTO receipt_files(id,book_id,user_id,name,mime,temporary) VALUES($1,$2,$3,$4,$5,false)',[fileId,targetBook,user,f.name,f.mime]);await c.query('INSERT INTO transaction_receipts(transaction_id,file_id,purpose) VALUES($1,$2,$3)',[id,fileId,f.purpose]);}
 return {ok:true,id};
}
export async function reuse(book:string,user:string,body:unknown){
 const b=z.object({id:z.string().uuid(),version:z.number().int(),targetBook:z.string().uuid()}).parse(body);if(book===b.targetBook)throw new Failure('请选择另一本账本');
 return withReceiptTransaction(async(c,copied)=>{for(const id of [book,b.targetBook].sort())await lockBook(c,id);for(const id of [book,b.targetBook]){const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[id,user])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('需要拥有两个账本的记账权限',403);}return reuseInTransaction(c,book,user,b.id,b.version,b.targetBook,copied);});
}
export async function overview(user:string,params:URLSearchParams){const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(params.get('month'));const result=(await db.query(`WITH visible AS (SELECT t.* FROM transactions t JOIN members m ON m.book_id=t.book_id WHERE m.user_id=$1 AND NOT t.deleted AND t.date>=$2::date AND t.date<$2::date+interval '1 month'), unique_records AS (SELECT DISTINCT ON (COALESCE(event_id,id)) * FROM visible ORDER BY COALESCE(event_id,id),created_at,id) SELECT (SELECT count(*)::int FROM visible) AS appearances,count(*)::int AS count,COALESCE(sum(amount) FILTER(WHERE kind='expense'),0)::float8 AS expense,COALESCE(sum(amount) FILTER(WHERE kind='refund'),0)::float8 AS refund,COALESCE(sum(amount) FILTER(WHERE kind='income'),0)::float8 AS income FROM unique_records`,[user,month+'-01'])).rows[0];return result;}
