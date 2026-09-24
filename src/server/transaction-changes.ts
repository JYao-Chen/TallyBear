import type {PoolClient} from 'pg';
import {z} from 'zod';
import {Failure} from './access';
import {accountAccess,validateActiveAccounts} from './accounts';
import {checkCategory} from './categories';
import {validateRefund,type Entry} from './ledger';
import {entry} from './model';
import {recordCategoryFeedback} from './receipt-preferences';
import {syncFinancialFacts} from './reuse';
import {setEntryActivity} from './activities';

const uuid=z.string().uuid();

export async function transactionForAction(c:Pick<PoolClient,'query'>,book:string,id:string){
 const row=(await c.query(`SELECT *,account_id AS "accountId",target_id AS "targetId",refund_of AS "refundOf",order_id AS "orderId",occurred_at AS "occurredAt",line_items AS "lineItems",verification_reason AS "verificationReason",amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted`,[uuid.parse(id),book])).rows[0];
 if(!row)throw new Failure('要处理的账目不存在或已删除',404);
 return row;
}

export function transactionEntry(row:any,patch:Record<string,unknown>={}):Entry{
 return entry.parse({accountId:row.accountId,activityId:row.activityId||undefined,targetId:row.targetId,kind:row.kind,amount:row.amount,date:row.date,payee:row.payee,category:row.category,note:row.note,externalId:row.external_id||undefined,title:row.title||'',scene:row.scene||{},product:row.product||'',platform:row.platform||'',orderId:row.orderId||'',occurredAt:row.occurredAt||'',refundOf:row.refundOf||undefined,lineItems:row.lineItems||[],verificationReason:row.verificationReason||'',photoIds:[],attachmentIds:[],retainReceipts:false,...patch,id:row.id});
}

export async function applyTransactionChange(c:PoolClient,book:string,user:string,data:any){
 const operation=z.enum(['update','delete']).parse(data.operation),id=uuid.parse(data.transactionId),version=z.number().int().nonnegative().parse(data.version);
 const previous=await transactionForAction(c,book,id);
 if(previous.version!==version)throw new Failure('账目已被修改，请让助手重新读取后再操作',409);
 await validateActiveAccounts(c,book,{accountId:previous.accountId,targetId:previous.targetId,kind:previous.kind} as Entry,user,[previous.accountId,previous.targetId].filter(Boolean));
 if(operation==='delete'){
  if((await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted',[book,id])).rowCount)throw new Failure('原消费关联了退款，请先处理退款记录');
  const result=await c.query('UPDATE transactions SET deleted=true,version=version+1 WHERE id=$1 AND book_id=$2 AND version=$3 AND NOT deleted RETURNING version',[id,book,version]);
  if(!result.rowCount)throw new Failure('账目已被修改，请让助手重新读取后再操作',409);
  return {id,deleted:true,version:result.rows[0].version};
 }
 const value=entry.parse(data.value||transactionEntry(previous,data));
 await validateActiveAccounts(c,book,value,user,[previous.accountId,previous.targetId].filter(Boolean));
 if(previous.amount!==value.amount||previous.kind!==value.kind||previous.date!==value.date||previous.accountId!==value.accountId||previous.targetId!==(value.targetId||null)){
  if((await c.query(`SELECT 1 FROM accounts a WHERE a.id=ANY($1::uuid[]) AND NOT ${accountAccess('$2')}`,[[previous.accountId,previous.targetId].filter(Boolean),user])).rowCount)throw new Failure('只有资产所有者或家庭成员可以修改实际收付款信息',403);
  await validateActiveAccounts(c,book,value,user);
 }
 await validateRefund(c,book,value);
 await checkCategory(c,user,value.category,previous.category);
 await syncFinancialFacts(c,book,value,user);
 if(value.externalId&&(await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND external_id=$2 AND id<>$3',[book,value.externalId,id])).rowCount)throw new Failure('这个交易流水号已用于另一笔账目，请核对后再保存');
 const result=await c.query('UPDATE transactions SET account_id=$1,target_id=$2,kind=$3,amount=$4,date=$5,payee=$6,category=$7,note=$8,product=$12,platform=$13,order_id=$14,occurred_at=$15,refund_of=$16,line_items=$17::jsonb,verification_reason=$18,title=$19,scene=$20::jsonb,external_id=$21,version=version+1 WHERE id=$9 AND book_id=$10 AND version=$11 AND NOT deleted RETURNING version',[value.accountId,value.kind==='transfer'?value.targetId:null,value.kind,value.amount,value.date,value.payee,value.category,value.note,value.id,book,version,value.product,value.platform,value.orderId,value.occurredAt,value.refundOf||null,JSON.stringify(value.lineItems),value.verificationReason,value.title,JSON.stringify(value.scene),value.externalId||null]);
 if(!result.rowCount)throw new Failure('账目已被修改，请让助手重新读取后再操作',409);
 if(value.activityId!==undefined)await setEntryActivity(c,user,book,id,value.activityId);
 if(previous.category!==value.category&&(value.kind==='expense'||value.kind==='income'))await recordCategoryFeedback(c,book,user,value,previous.category);
 if(value.kind==='expense')await c.query('UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND refund_of=$3 AND NOT deleted',[value.category,book,value.id]);
 return {id,deleted:false,version:result.rows[0].version};
}
