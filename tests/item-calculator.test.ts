import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendedItemAmount,editCalculatedItem,canUseSettlementTotal} from '../src/lib/item-calculator';
import {settlementTotals,type LineItem} from '../src/lib/line-items';
const item=(patch:Partial<LineItem>={}):LineItem=>({kind:'item',name:'鱼片',quantity:null,unitPrice:null,amount:null,...patch});
test('either input order fills subtotal and subsequent edits stay in sync',()=>{
 let row=editCalculatedItem(item(),{unitPrice:1390});assert.equal(row.amount,null);
 row=editCalculatedItem(row,{quantity:2});assert.equal(row.amount,2780);
 row=editCalculatedItem(row,{quantity:3});assert.equal(row.amount,4170);
 row=editCalculatedItem(row,{unitPrice:1290});assert.equal(row.amount,3870);
 assert.equal(editCalculatedItem(editCalculatedItem(item(),{quantity:2}),{unitPrice:1390}).amount,2780);
});
test('manual and OCR totals stay intact until recommended subtotal is adopted',()=>{
 let row=item({quantity:2,unitPrice:1390,amount:1390});
 row=editCalculatedItem(row,{quantity:3});assert.equal(row.amount,1390);
 row=editCalculatedItem(row,{amount:recommendedItemAmount(row)});
 row=editCalculatedItem(row,{quantity:4});assert.equal(row.amount,5560);
 row=editCalculatedItem(row,{amount:5000});
 assert.equal(editCalculatedItem(row,{unitPrice:1000}).amount,5000);
});
test('blank factors clear only automatic amounts and missing quantities are never assumed',()=>{
 assert.equal(recommendedItemAmount(item({unitPrice:100})),null);
 assert.equal(editCalculatedItem(item({unitPrice:100,quantity:2,amount:200}),{quantity:null}).amount,null);
 assert.equal(editCalculatedItem(item({unitPrice:100,quantity:2,amount:150}),{quantity:null}).amount,150);
});
test('decimal quantities round cents half up without floating-point loss',()=>{
 assert.equal(recommendedItemAmount(item({quantity:0.145,unitPrice:100})),15);
 assert.equal(recommendedItemAmount(item({quantity:1.005,unitPrice:100})),101);
 assert.equal(recommendedItemAmount(item({quantity:0.5,unitPrice:199})),100);
 assert.equal(recommendedItemAmount(item({quantity:1e-7,unitPrice:100000000})),10);
});
test('invalid or excessive calculation is unavailable, never NaN or Infinity',()=>{
 for(const quantity of [0,-1,NaN,Infinity,1000001])assert.equal(recommendedItemAmount(item({quantity,unitPrice:100})),null);
 assert.equal(recommendedItemAmount(item({quantity:1000000,unitPrice:100000000000})),null);
 assert.equal(recommendedItemAmount(item({quantity:2,unitPrice:0})),0);
});
test('settlement uses current subtotals, subtracts discounts once, adds fees and refuses incomplete totals',()=>{
 const rows=[item({amount:2780}),item({amount:590}),item({kind:'discount',amount:-500}),item({kind:'fee',amount:200})];
 const s=settlementTotals(rows);assert.deepEqual(s,{goods:3370,discount:500,fees:200,net:3070,missing:0});
 assert.equal(canUseSettlementTotal(s.net,s.missing),true);
 assert.equal(canUseSettlementTotal(s.net,1),false);
 for(const n of [0,-1,Infinity,100000000001])assert.equal(canUseSettlementTotal(n,0),false);
 assert.equal(editCalculatedItem(item({kind:'fee',amount:200}),{quantity:2,unitPrice:1000}).amount,200);
});
