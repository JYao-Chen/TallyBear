import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relatedReceipts,mergeEvidenceValid,mergeReceipts,type Receipt} from '../src/server/receipt-merge';
const receipt=(extra:Partial<Receipt>={}):Receipt=>({kind:'expense',amount:100,date:'2026-09-13',payee:'商家',accountId:'',orderId:'one',platform:'京东',occurredAt:'',source:'图1',note:'',status:'paid',lineItems:[],...extra});
test('conflicting payments and invented totals cannot merge',()=>{
 const a=receipt(),b=receipt({amount:200});assert.equal(mergeEvidenceValid(a,b,a),false);
 assert.equal(mergeEvidenceValid(a,a,receipt({amount:200})),false);
 assert.equal(mergeEvidenceValid(receipt({externalId:'a'}),receipt({externalId:'b'}),receipt({externalId:'a'})),false);
});
test('partial refunds remain separate and expense/refund never merge',()=>{
 assert.equal(relatedReceipts(receipt({kind:'refund'}),receipt({kind:'refund'})),false);
 assert.equal(relatedReceipts(receipt(),receipt({kind:'refund'})),false);
 assert.equal(relatedReceipts(receipt({orderId:'one'}),receipt({orderId:'two'})),false);
});
test('merging retains complementary item rows and cannot drop or invent them',()=>{
 const a=receipt({lineItems:[{name:'A',amount:60,quantity:1,unitPrice:60}]}),b=receipt({lineItems:[{name:'B',amount:40,quantity:1,unitPrice:40}]});
 assert.equal(mergeEvidenceValid(a,b,receipt({lineItems:[...a.lineItems,...b.lineItems]})),true);
 assert.equal(mergeEvidenceValid(a,b,a),false);
 assert.equal(mergeEvidenceValid(a,b,receipt({lineItems:[...a.lineItems,{...b.lineItems[0],amount:50}]})),false);
});
test('ambiguous candidates and failed model checks remain reviewable',async()=>{
 const a=receipt(),b=receipt({source:'图2'});
 const result=await mergeReceipts([a,b],x=>x as Receipt,{},async()=>({sameOrder:false,reason:'只有商家日期金额相同'}));assert.equal(result.entries.length,2);assert.equal(result.merged,0);assert.ok(result.entries[1].note.includes('只有商家'));
 const failed=await mergeReceipts([a,b],x=>x as Receipt,{},async()=>{throw new Error('provider offline');});assert.equal(failed.entries.length,2);
});
test('two genuinely repeated identical item rows cannot collapse into one',()=>{
 const row={name:'同款饮料',amount:50,quantity:1,unitPrice:50};
 const a=receipt({lineItems:[row,row]}),b=receipt({lineItems:[row]});
 assert.equal(mergeEvidenceValid(a,b,receipt({lineItems:[row]})),false);
 assert.equal(mergeEvidenceValid(a,b,receipt({lineItems:[row,row]})),true);
});
