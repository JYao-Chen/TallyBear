import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPurchaseMemory,purchaseDefaults,samePurchase,normalizeDining,type Purchase} from '../src/lib/purchase-memory';
import {sceneSchema} from '../src/lib/entry-scene';
const old:Purchase={id:'00000000-0000-4000-8000-000000000001',kind:'expense',payee:'面馆',title:'牛肉面',product:'牛肉面',category:'餐饮',scene:sceneSchema.parse({type:'dining',diningMode:'delivery',summary:'牛肉面'}),lineItems:[{name:'牛肉面',amount:2500,unitPrice:2500,quantity:1}]};
test('same product fills history but keeps current payment facts and current item prices',()=>{
 const now={...old,id:'00000000-0000-4000-8000-000000000002',amount:1900,orderId:'new',date:'2026-09-26',lineItems:[{...old.lineItems![0],amount:1900,unitPrice:1900}]};
 const result=applyPurchaseMemory(now,[old]);
 assert.equal(result.scene?.purchaseGroup,old.id);assert.equal(result.amount,1900);assert.equal(result.lineItems[0].amount,1900);assert.equal(result.orderId,'new');assert.equal(result.date,'2026-09-26');assert.equal(result.id,now.id);
});
test('a merchant alone, different items and ambiguous merchants do not auto-fill',()=>{
 assert.equal(samePurchase({...old,product:'',scene:sceneSchema.parse({}),lineItems:[]},old),false);
 assert.equal(samePurchase({...old,product:'鸡肉饭',lineItems:[]},old),false);
 const missing={...old,payee:''};assert.equal(applyPurchaseMemory(missing,[old,{...old,payee:'其他面馆'}]).scene?.purchaseGroup,undefined);
});
test('repeat fill clears payment references and old item prices; refund does not copy purchase breakdown',()=>{
 const reused=purchaseDefaults(old);assert.equal(reused.orderId,'');assert.equal(reused.externalId,'');assert.equal(reused.lineItems[0].amount,null);assert.equal(reused.lineItems[0].quantity,null);assert.deepEqual(purchaseDefaults(old,true).lineItems,[]);
});
test('delivery is food-led while dine-in retains merchant-led title',()=>{
 assert.equal(normalizeDining({...old,title:'面馆'}).title,'牛肉面');
 assert.equal(normalizeDining({...old,scene:sceneSchema.parse({type:'dining',diningMode:'dine_in',merchant:'面馆',meal:'午餐'})}).title,'面馆 · 午餐');
});
test('automatic matching fills missing merchant and platform even with a category suggestion',()=>{
 const current={...old,payee:'',platform:'',categorySource:'explicit' as const,category:'午餐',categorySuggestion:{category:'餐饮'},amount:1800,externalId:'new-payment'};
 const result=applyPurchaseMemory(current,[{...old,platform:'美团'}]);
 assert.equal(result.scene?.purchaseGroup,old.id);
 assert.equal(result.payee,'面馆');assert.equal(result.platform,'美团');
 assert.equal(result.category,'午餐');assert.equal(result.amount,1800);assert.equal(result.externalId,'new-payment');
});
