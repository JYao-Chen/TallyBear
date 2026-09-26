import {z} from 'zod';
export const lineItemsSchema=z.array(z.object({id:z.string().uuid().optional(),kind:z.preprocess(value=>value==null||value===''||value==='expense'||value==='income'?'item':value,z.enum(['item','discount','fee']).optional()),name:z.string().trim().min(1,'请填写商品名称').max(160),quantity:z.number().positive().max(1000000).nullable().default(null),unitPrice:z.number().int().min(-100000000000).max(100000000000).nullable().default(null),amount:z.number().int().min(-100000000000).max(100000000000).nullable().default(null)})).max(200).superRefine((items,c)=>{items.forEach((i,n)=>{if(i.kind==='discount'&&i.amount!==null&&i.amount>0)c.addIssue({code:'custom',path:[n,'amount'],message:'优惠金额应以负数保存'});if(i.kind==='fee'&&i.amount!==null&&i.amount<0)c.addIssue({code:'custom',path:[n,'amount'],message:'附加费用应为非负数'});});}).default([]);
export type LineItem=z.infer<typeof lineItemsSchema>[number];
export function lineItemKind(i:{kind?:string;amount?:number|null}){return (i.amount??0)<0||i.kind==='discount'?'discount':i.kind==='fee'?'fee':'item';}
export function settlementNameKind(name:string){
 const n=name.trim().replace(/[\s：:]/g,'').toLowerCase();
 if(/^(?:(?:平台|商家|店铺|会员|支付|订单|结算|活动|商品|微信|支付宝))?(?:优惠|优惠券|满减|立减|抹零|红包抵扣|红包优惠|积分抵扣|折扣|减免)$/.test(n)||['discount','coupon','rounding','平台红包','商家红包'].includes(n))return 'discount' as const;
 if(/^(?:配送费|包装费|打包费|运费|快递费|手续费|服务费|附加费|配送|包装|deliveryfee|shippingfee|servicefee|handlingfee)$/.test(n))return 'fee' as const;
 return undefined;
}
// Only AI input is normalized. Manual edits retain their selected type; unknown amounts stay unknown.
export function normalizeRecognizedLineItems(value:unknown):unknown{
 if(!Array.isArray(value))return value;
 return value.map(i=>{if(!i||typeof i!=='object'||typeof i.name!=='string')return i;
  const kind=settlementNameKind(i.name)||lineItemKind(i);
  return {...i,kind,...(kind!=='item'?{quantity:null,unitPrice:null}:{}),...(kind==='discount'&&typeof i.amount==='number'?{amount:-Math.abs(i.amount)}:{})};
 });
}
export const settlementInstructions='Separate merchandise from checkout adjustments using lineItems.kind: item for purchased goods/services; discount for coupons, threshold reductions, checkout red packets, rounding or points deductions (negative amount); fee for shipping, packaging, handling or service surcharges (positive amount). Adjustments have quantity/unitPrice null and never appear in product summaries or food titles. Include each visible adjustment once, only when not already included in the item subtotals. Do not invent adjustments from a difference. Subtotal/total/savings-summary rows are not additional adjustments. Keep ambiguous amounts null for review. Standalone fee transactions are still expenses, not duplicated adjustments.';
export function itemTotals(items:LineItem[]){return {known:items.reduce((n,i)=>n+(i.amount??0),0),missing:items.filter(i=>i.amount===null).length};}
export function verifyItemTotal(items:LineItem[],total:number){
 const {known,missing}=itemTotals(items);
 return {known,missing,difference:total-known,status:!items.length?'none':missing?'incomplete':known===total?'verified':'mismatch'} as {known:number;missing:number;difference:number;status:'none'|'incomplete'|'verified'|'mismatch'};
}

export function settlementTotals(items:LineItem[]){const discounts=items.filter(i=>lineItemKind(i)==='discount');const fees=items.filter(i=>lineItemKind(i)==='fee');const goods=items.filter(i=>lineItemKind(i)==='item');return {goods:itemTotals(goods).known,discount:-itemTotals(discounts).known,fees:itemTotals(fees).known,net:itemTotals(items).known,missing:itemTotals(items).missing};}
