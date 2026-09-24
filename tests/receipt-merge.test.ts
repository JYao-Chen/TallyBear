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
test('missing dates in one long screenshot do not compare unrelated payments',async()=>{
 const entries=Array.from({length:56},(_,i)=>receipt({orderId:'',externalId:'',source:'原图1',date:i<2?'':'2026-09-13',payee:`商家${i}`,amount:100+i}));
 let comparisons=0;
 const result=await mergeReceipts(entries,x=>x as Receipt,{},async()=>{comparisons++;return {sameOrder:false,reason:'证据不足'};});
 assert.equal(comparisons,0);
 assert.equal(result.entries.length,56);
 assert.equal(result.uncertain,0);
});
test('only plausible unnumbered payments need model comparison',async()=>{
 const entries=[receipt({orderId:'',source:'原图1',date:'',payee:'商家A'}),receipt({orderId:'',source:'原图1',payee:'商家B'}),receipt({orderId:'',source:'原图1',payee:'商家A',occurredAt:'18:02'}),receipt({orderId:'',source:'原图1',payee:'商家A',amount:200})];
 let comparisons=0;
 const result=await mergeReceipts(entries,x=>x as Receipt,{},async()=>{comparisons++;return {sameOrder:false,reason:'同名同价但无法确认'};});
 assert.equal(comparisons,0);
 assert.equal(result.entries.length,4);
 assert.ok(result.entries[2].note.includes('人工核对'));
 assert.equal(result.entries[3].note,'');
});
test('shared payment time or item evidence still asks the model before merging',async()=>{
 const entries=[receipt({orderId:'',source:'原图1',occurredAt:'18:02'}),receipt({orderId:'',source:'原图2',occurredAt:'18:02'})];
 let comparisons=0;
 const result=await mergeReceipts(entries,x=>x as Receipt,{},async()=>{comparisons++;return {sameOrder:false,reason:'相同时间仍无法确认'};});
 assert.equal(comparisons,1);
 assert.equal(result.entries.length,2);
 assert.ok(result.entries[1].note.includes('相同时间'));
});
test('matching payment reference with complementary fields merges without a model call',async()=>{
 const a=receipt({orderId:'',externalId:'pay-1',amount:0,lineItems:[]});
 const b=receipt({orderId:'',externalId:'pay-1',lineItems:[{name:'商品',amount:100,quantity:1,unitPrice:100}]});
 const result=await mergeReceipts([a,b],x=>x as Receipt,{},async()=>{throw new Error('model should not run');});
 assert.equal(result.merged,1);
 assert.equal(result.entries.length,1);
 assert.equal(result.entries[0].amount,100);
 assert.equal(result.entries[0].lineItems.length,1);
});
test('conflicting payment evidence is not sent to the model',()=>{
 assert.equal(relatedReceipts(receipt({externalId:'a'}),receipt({externalId:'b'})),false);
 assert.equal(relatedReceipts(receipt({date:'2026-09-13'}),receipt({date:'2026-09-14'})),false);
 assert.equal(relatedReceipts(receipt({amount:100}),receipt({amount:200})),false);
 assert.equal(relatedReceipts(receipt({orderId:'',externalId:'same',date:''}),receipt({orderId:'',externalId:'same'})),true);
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
