import test from 'node:test';
import assert from 'node:assert/strict';
import {lineItemsSchema,settlementTotals,verifyItemTotal,normalizeRecognizedLineItems} from '../src/lib/line-items';
import {memoryProducts} from '../src/lib/memory-products';
import {LineItemsView,LineItemsEditor} from '../src/components/LineItems';
import {entry} from '../src/server/model';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {TransactionList} from '../src/components/TransactionList';
test('105 less 5 is 100; only the paid amount is reconciled',()=>{const items=lineItemsSchema.parse([{name:'商品',amount:10500,kind:'item'},{name:'抹零',amount:-500,kind:'discount'}]);assert.deepEqual(settlementTotals(items),{goods:10500,discount:500,fees:0,net:10000,missing:0});assert.equal(verifyItemTotal(items,10000).status,'verified');assert.equal(verifyItemTotal(items,10500).status,'mismatch');});
test('fees, multiple discounts, and unknown values remain distinct',()=>{const items=lineItemsSchema.parse([{name:'商品',amount:10500},{name:'优惠券',kind:'discount',amount:-300},{name:'抹零',kind:'discount',amount:-200},{name:'配送',kind:'fee',amount:600}]);assert.equal(verifyItemTotal(items,10600).status,'verified');assert.equal(settlementTotals(items).discount,500);assert.equal(verifyItemTotal([...items,{name:'未知',quantity:null,unitPrice:null,amount:null}],10600).status,'incomplete');assert.throws(()=>lineItemsSchema.parse([{name:'优惠',kind:'discount',amount:500}]));});
test('merchant is the fallback title; explicit manual title wins over product details',()=>{const row={id:'test',title:'',payee:'七鲜',product:'牛奶鸡蛋水果洗衣液等一长串',category:'购物',amount:10000,kind:'expense',account_name:'微信',date:'2026-09-13',note:''} as any;let html=renderToStaticMarkup(createElement(TransactionList,{rows:[row],onSelect:()=>{}}));assert.match(html,/查看七鲜详情/);html=renderToStaticMarkup(createElement(TransactionList,{rows:[{...row,title:'周末买菜'}],onSelect:()=>{}}));assert.match(html,/查看周末买菜详情/);});
test('AI checkout adjustments are separated without confusing discounted product names',()=>{
 const items=lineItemsSchema.parse(normalizeRecognizedLineItems([{name:'满减牛肉套餐',kind:'item',amount:5000},{name:'满减',kind:'item',amount:800,quantity:1},{name:'平台红包',amount:-200},{name:'手续费',kind:'item',amount:100},{name:'包装费',amount:null}]));
 assert.deepEqual(items.map(i=>i.kind),['item','discount','discount','fee','fee']);
 assert.equal(items[1].quantity,null);assert.equal(items[1].amount,-800);assert.equal(items[4].amount,null);
 assert.deepEqual(memoryProducts({lineItems:items}).map(i=>i.name),['满减牛肉套餐']);
 assert.equal(settlementTotals(items).net,4100);assert.equal(verifyItemTotal(items,4100).status,'incomplete');
 assert.deepEqual(memoryProducts({title:'手续费',lineItems:[items[3]]}),[]);
});
test('editor and saved detail put adjustments outside merchandise and paginate',()=>{
 const items=lineItemsSchema.parse([{name:'牛肉面',amount:2000},{name:'满减',kind:'discount',amount:-500},{name:'配送费',kind:'fee',amount:200}]);
 for(const component of [createElement(LineItemsView,{items,total:1700}),createElement(LineItemsEditor,{items,total:1700,onChange:()=>{}})]){
  const html=renderToStaticMarkup(component);const goods=html.split('aria-label="商品明细"')[1].split('</section>')[0];
  assert.match(goods,/牛肉面/);assert.doesNotMatch(goods,/满减|配送费/);assert.match(html,/aria-label="优惠与费用"/);
 }
 const html=renderToStaticMarkup(createElement(LineItemsView,{items:Array.from({length:7},(_,n)=>({...items[0],name:'商品'+n})),total:14000}));
 assert.match(html,/下一页/);assert.doesNotMatch(html,/商品6/);
});
