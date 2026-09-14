import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyItemTotal} from '../src/lib/line-items';
import {verifyAndRepair} from '../src/server/receipt-verification';
const item=(amount:number|null,name='商品')=>({name,amount,quantity:null,unitPrice:null});
const order=(lineItems=[item(90)])=>({kind:'expense',amount:100,date:'2026-09-13',payee:'商家',accountId:'account',orderId:'1',platform:'店铺',lineItems,note:''});
test('exact cents, negative discounts and missing amounts have distinct verification states',()=>{
 assert.equal(verifyItemTotal([item(120),item(-20,'优惠')],100).status,'verified');
 assert.equal(verifyItemTotal([item(100),item(null)],100).status,'incomplete');
 assert.equal(verifyItemTotal([item(99)],100).difference,1);
 assert.equal(verifyItemTotal([],100).status,'none');
});
test('mismatch rereads original and repairs itemization without changing payment',async()=>{
 let count=0;const r=await verifyAndRepair([order()],async()=>{count++;return [order([item(90),item(10,'运费')])];});
 assert.equal(count,1);assert.equal(r.repaired,1);assert.equal(r.unresolved,0);assert.equal(r.entries[0].amount,100);assert.equal(r.entries[0].lineItems.length,2);
});
test('no retry when matching, but missing values trigger reread',async()=>{
 const good=await verifyAndRepair([order([item(100)])],async()=>{throw new Error('should not run');});assert.equal(good.attempts,0);
 const incomplete=await verifyAndRepair([order([item(null)])],async()=>[order([item(100)])]);assert.equal(incomplete.repaired,1);
});
test('changing total to fit is rejected and unresolved difference survives bounded retries',async()=>{
 const r=await verifyAndRepair([order()],async()=>[{...order(),amount:90}]);
 assert.equal(r.attempts,2);assert.equal(r.repaired,0);assert.equal(r.unresolved,1);assert.equal(r.entries[0].amount,100);assert.ok(r.entries[0].note.includes('0.10'));
});
test('ambiguous duplicate identities cannot exchange itemizations',async()=>{
 const r=await verifyAndRepair([order(),order()],async()=>[order([item(100)])]);assert.equal(r.repaired,0);assert.equal(r.unresolved,2);
});
test('cancel propagates; provider error retains original items for review',async()=>{
 const r=await verifyAndRepair([order()],async()=>{throw new Error('offline');});assert.equal(r.unresolved,1);assert.equal(r.entries[0].lineItems[0].amount,90);
 await assert.rejects(()=>verifyAndRepair([order()],async()=>[],()=>{},AbortSignal.abort()));
});
