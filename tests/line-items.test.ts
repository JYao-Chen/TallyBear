import test from 'node:test';
import assert from 'node:assert/strict';
import {lineItemsSchema,itemTotals} from '../src/lib/line-items';
test('receipt cents, discounts and incomplete prices remain distinct',()=>{
 const items=lineItemsSchema.parse([{name:'牛肉面',quantity:2,unitPrice:1800,amount:3600},{name:'优惠',quantity:1,unitPrice:-500,amount:-500},{name:'饮料'}]);
 assert.deepEqual(itemTotals(items),{known:3100,missing:1});assert.equal(items[2].amount,null);
 assert.throws(()=>lineItemsSchema.parse([{name:'菜品',amount:12.5}]));
 assert.throws(()=>lineItemsSchema.parse([{name:' ',amount:100}]));
 assert.throws(()=>lineItemsSchema.parse([{name:'菜品',quantity:0}]));
});
