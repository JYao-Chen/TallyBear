import {z} from 'zod';
export const lineItemsSchema=z.array(z.object({id:z.string().uuid().optional(),kind:z.preprocess(value=>value==null||value===''||value==='expense'||value==='income'?'item':value,z.enum(['item','discount','fee']).optional()),name:z.string().trim().min(1,'请填写商品名称').max(160),quantity:z.number().positive().max(1000000).nullable().default(null),unitPrice:z.number().int().min(-100000000000).max(100000000000).nullable().default(null),amount:z.number().int().min(-100000000000).max(100000000000).nullable().default(null)})).max(200).superRefine((items,c)=>{items.forEach((i,n)=>{if(i.kind==='discount'&&i.amount!==null&&i.amount>0)c.addIssue({code:'custom',path:[n,'amount'],message:'优惠金额应以负数保存'});if(i.kind==='fee'&&i.amount!==null&&i.amount<0)c.addIssue({code:'custom',path:[n,'amount'],message:'附加费用应为非负数'});});}).default([]);
export type LineItem=z.infer<typeof lineItemsSchema>[number];
export function itemTotals(items:LineItem[]){return {known:items.reduce((n,i)=>n+(i.amount??0),0),missing:items.filter(i=>i.amount===null).length};}
export function verifyItemTotal(items:LineItem[],total:number){
 const {known,missing}=itemTotals(items);
 return {known,missing,difference:total-known,status:!items.length?'none':missing?'incomplete':known===total?'verified':'mismatch'} as {known:number;missing:number;difference:number;status:'none'|'incomplete'|'verified'|'mismatch'};
}

export function settlementTotals(items:LineItem[]){const discounts=items.filter(i=>i.kind==='discount'||(i.amount!==null&&i.amount<0));const fees=items.filter(i=>i.kind==='fee'&&!discounts.includes(i));const goods=items.filter(i=>!discounts.includes(i)&&!fees.includes(i));return {goods:itemTotals(goods).known,discount:-itemTotals(discounts).known,fees:itemTotals(fees).known,net:itemTotals(items).known,missing:itemTotals(items).missing};}
