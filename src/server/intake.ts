import {normalizeTransactionTime} from '@/lib/entry-time';
import {memorySuggestion} from '@/lib/memory';
import {z} from 'zod';
import {sceneSchema} from '@/lib/entry-scene';
import {lineItemsSchema} from '@/lib/line-items';
import {categorySuggestionSchema} from '@/lib/category-learning';
export const details={memorySuggestions:z.array(memorySuggestion).max(600).optional(),scene:sceneSchema,title:z.string().trim().max(80).default(''),photoIds:z.array(z.string().uuid()).default([]),retainReceipts:z.boolean().default(false),verificationReason:z.string().trim().max(500).default(''),attachmentIds:z.array(z.string().uuid()).default([]),lineItems:lineItemsSchema,platform:z.string().max(40).default(''),orderId:z.string().max(200).default(''),product:z.string().max(160).default(''),occurredAt:z.preprocess(normalizeTransactionTime,z.string()),source:z.string().max(200).default(''),refundOf:z.string().uuid().nullable().optional(),categorySource:z.enum(['explicit','model']).optional(),categorySuggestion:categorySuggestionSchema.optional()};
export type Comparable={id:string;kind:string;amount:number;date:string;payee:string;accountId:string;externalId?:string;orderId?:string;platform?:string;occurredAt?:string;product?:string;category?:string;note?:string;version?:number};
const norm=(s?:string)=>(s||'').trim().toLowerCase().replace(/\s/g,'');
export function matchReason(a:Comparable,b:Comparable):string|null{
 if(a.id===b.id)return '同一条记录';
 if(a.kind!==b.kind)return null;
 if(a.externalId&&a.externalId===b.externalId)return '交易流水号相同';
 const sameOrder=a.orderId&&a.orderId===b.orderId&&a.platform&&a.platform===b.platform;
 if(sameOrder&&a.amount===b.amount)return '订单号与金额相同';
 if(sameOrder&&a.kind==='expense')return '订单号相同，金额需核对，可仅补充商品信息';
 if(a.orderId&&b.orderId&&a.platform&&a.platform===b.platform&&a.orderId!==b.orderId)return null;
 if(a.externalId&&b.externalId&&a.externalId!==b.externalId)return null;
 if(a.amount<=0||a.amount!==b.amount||!a.date||a.date!==b.date)return null;
 if(a.occurredAt&&a.occurredAt===b.occurredAt)return '交易时间与金额相同';
 if(norm(a.payee)&&norm(a.payee)===norm(b.payee))return '日期、金额与商家相同';
 if(a.accountId&&a.accountId===b.accountId)return '日期、金额与账户相同，请确认是否为另一笔消费';
 return '日期与金额相同，信息不足，请核对是否为同一笔';
}
export function missingFields(e:Comparable){return [!e.amount?'金额':'',!e.accountId?'账户':''].filter(Boolean);}
export function refundCandidates(e:Comparable,rows:Comparable[]){return rows.filter(r=>r.kind==='expense'&&(!e.date||r.date<=e.date)&&((e.orderId&&r.orderId===e.orderId&&e.platform===r.platform)||(norm(e.payee)&&norm(e.payee)===norm(r.payee))));}
