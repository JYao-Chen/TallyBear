import {normMemory} from './memory';

type ProductInput={product?:string;title?:string;payee?:string;category?:string;scene?:{summary?:string};lineItems?:{id?:string;name:string;kind?:string;amount?:number|null}[]};
// Legacy manual entries can have a useful title without a product/scene summary.
export function memoryProducts(input:ProductInput){
 const goods=(input.lineItems||[]).filter(i=>(!i.kind||i.kind==='item')&&(i.amount==null||i.amount>=0)&&i.name.trim());
 if(goods.length)return goods.map(i=>({name:i.name,itemId:i.id}));
 const name=(input.product||input.scene?.summary||input.title||'').trim();
 if(!name||[input.payee,input.category,'支出','消费','购物','其他'].some(v=>v&&normMemory(v)===normMemory(name)))return [];
 return [{name,itemId:undefined}];
}
