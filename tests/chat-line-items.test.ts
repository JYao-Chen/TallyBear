import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineItemsSchema,verifyItemTotal} from '../src/lib/line-items';
test('chat goods remain separate and accept transaction-kind mistakes',()=>{
 const items=lineItemsSchema.parse([{name:'三元鲜牛奶',kind:'expense',amount:900},{name:'茉莉红茶',kind:null,amount:500}]);
 assert.equal(items.length,2);assert.equal(items[0].kind,'item');assert.equal(items[1].kind,'item');assert.equal(verifyItemTotal(items,1400).status,'verified');
});
test('settlement types retain validation',()=>{
 assert.equal(lineItemsSchema.parse([{name:'优惠',kind:'discount',amount:-500}])[0].kind,'discount');
 assert.equal(lineItemsSchema.safeParse([{name:'优惠',kind:'discount',amount:500}]).success,false);
 assert.equal(lineItemsSchema.safeParse([{name:'运费',kind:'fee',amount:-500}]).success,false);
 assert.equal(lineItemsSchema.safeParse([{name:'商品',kind:'unknown',amount:500}]).success,false);
});
