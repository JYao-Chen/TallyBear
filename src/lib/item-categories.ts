import {lineItemKind,verifyItemTotal,type LineItem} from './line-items';
export type CategoryAmount={category:string;amount:number};
export const hasItemCategories=(items:LineItem[])=>items.some(i=>lineItemKind(i)==='item'&&!!i.category);
export function categoryWeights(items:LineItem[],fallback:string){
 const weights=new Map<string,number>();
 for(const i of items){if(lineItemKind(i)!=='item')continue;const category=i.category||fallback;weights.set(category,(weights.get(category)||0)+(i.amount??0));}
 // Checkout adjustments follow merchandise; they never create a category.
 for(const i of items){if(lineItemKind(i)==='item'||!i.category||!weights.has(i.category))continue;weights.set(i.category,weights.get(i.category)!+(i.amount??0));}
 return [...weights].sort(([a],[b])=>a<b?-1:a>b?1:0);
}
export function itemCategoryError(items:LineItem[],amount:number,fallback:string){
 if(!hasItemCategories(items))return '';
 if(verifyItemTotal(items,amount).status!=='verified')return '按商品分类前，请补全所有明细金额，并使明细合计与实付一致';
 const weights=categoryWeights(items,fallback);
 if(weights.some(([,v])=>v<0)||!weights.some(([,v])=>v>0))return '分类优惠不能超过该类商品金额，请核对商品与优惠的分类';
 return '';
}
// Cumulative integer shares preserve every cent, including order discounts and period costs.
export function categoryAmounts(items:LineItem[],amount:number,fallback:string):CategoryAmount[]{
 if(!hasItemCategories(items))return [{category:fallback,amount}];
 const weights=categoryWeights(items,fallback).filter(([,v])=>v>0),total=weights.reduce((n,[,v])=>n+BigInt(v),0n);
 if(!total)return [];
 let cumulative=0n,previous=0n;return weights.map(([category,weight])=>{cumulative+=BigInt(weight);const current=BigInt(amount)*cumulative/total,part=Number(current-previous);previous=current;return {category,amount:part};});
}
export const itemCategoryInstructions='Support one payment with multiple item categories: lineItems[].category is an optional real category from form_options. For mixed purchases classify only merchandise lines, preserving one entry and the actual paid total. Merchandise without category inherits entry.category. Shipping, packaging and discounts are settlement adjustments, never independent categories. Leave their category empty to apportion across merchandise, or use only a category already present on merchandise to target those goods. Ignore legacy adjustment-only categories. An order discount or fee without category is apportioned across the classified amounts; a discount explicitly assigned a category reduces only that category. In item mode require all line amounts and reconciliation to paid total; never invent amounts. If the user requests one category for the whole order (e.g. all snacks), set entry.category to that category and clear category from EVERY lineItem, including existing ones when updating. Preserve line categories on unrelated edits. Do not split the payment into duplicate transactions. In filtered reports amount is the whole payment and matched_amount is the selected category share; use returned totals or matched_amount for category statistics, never sum the whole payment again for each matched category.';
