import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryProducts} from '../src/lib/memory-products';
test('legacy title-only products and transport services are extracted',()=>{
 assert.equal(memoryProducts({title:'可复美次抛精华',category:'护肤'})[0].name,'可复美次抛精华');
 assert.equal(memoryProducts({title:'地铁 · 知春里 → 石佛营',category:'交通'})[0].name,'地铁 · 知春里 → 石佛营');
});
test('category and merchant alone do not become product identity',()=>{
 assert.deepEqual(memoryProducts({title:'交通',category:'交通'}),[]);
 assert.deepEqual(memoryProducts({title:'盒马',payee:'盒马'}),[]);
});
test('fees and discounts do not count as goods in matching or learning',()=>{
 assert.deepEqual(memoryProducts({lineItems:[{id:'goods',name:'牛奶',amount:500},{id:'fee',name:'配送费',kind:'fee',amount:200},{id:'discount',name:'优惠',amount:-100}]}),[{itemId:'goods',name:'牛奶'}]);
});
