import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assembleReceipt} from '../src/server/receipt-assembly';
import type {Receipt} from '../src/server/receipt-merge';
const row=(name:string,amount:number)=>({name,amount,quantity:1,unitPrice:amount});
const base:Receipt={kind:'expense',amount:0,date:'',payee:'京东七鲜',accountId:'',orderId:'',externalId:'',platform:'京东',occurredAt:'',source:'原图1',note:'',status:'unknown',lineItems:[]};
const first={...base,lineItems:[row('牛奶',590),row('金针菇',299)]};
const last={...base,amount:7387,orderId:'3634413016884118',status:'paid',lineItems:[row('金针菇',299),row('火锅底料',790)]};
const complete={...last,lineItems:[...first.lineItems,last.lineItems[1]]};
const parse=(v:unknown)=>v as Receipt;
test('one long order joins product and footer fragments with overlap',()=>{
 assert.deepEqual(assembleReceipt([first,last],{singleOrder:true,entry:complete},parse),complete);
 assert.deepEqual(assembleReceipt([{...first,amount:2455},last],{singleOrder:true,entry:complete},parse),complete);
});
test('same image cannot authorize merging multiple orders, payments or refunds',()=>{
 for(const other of [{...first,orderId:'other'},{...first,externalId:'pay1'},{...first,amount:123,status:'paid'},{...first,kind:'refund'}]){
  assert.equal(assembleReceipt([other,{...last,externalId:'pay2'}],{singleOrder:true,entry:{...complete,externalId:'pay2'}},parse),undefined);
 }
 assert.equal(assembleReceipt([first,last],{singleOrder:false,entry:complete},parse),undefined);
 assert.equal(assembleReceipt([first,{...last,orderId:''}],{singleOrder:true,entry:complete},parse),undefined);
});
test('assembly cannot invent prices, discard items, or collapse repeated purchases',()=>{
 for(const candidate of [{...complete,amount:8000},{...complete,date:'2026-09-27'},{...complete,lineItems:[...complete.lineItems,row('虚构优惠',-100)]},{...complete,lineItems:[last.lineItems[1]]}]){
  assert.equal(assembleReceipt([first,last],{singleOrder:true,entry:candidate},parse),undefined);
 }
 assert.equal(assembleReceipt([{...first,lineItems:[first.lineItems[0],first.lineItems[0]]},last],{singleOrder:true,entry:complete},parse),undefined);
});
