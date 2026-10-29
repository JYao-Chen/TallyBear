import test from 'node:test';import assert from 'node:assert/strict';
import {parseAction,actionMissing} from '../src/server/chat-actions';import type {ChatAction} from '../src/lib/chat-actions';
const id='11111111-1111-4111-8111-111111111111';
const action=(extra:Record<string,unknown>={})=>({id,kind:'installment',bookId:id,status:'pending',title:'Installment',summary:[],warnings:[],missing:[],data:{transactionId:id,name:'Test purchase',terms:6,firstDate:'2026-11-19',fees:0,allocate:true,...extra}} as ChatAction);
test('repayment dates and terms do not silently fill expense allocation fields',()=>{
 assert.deepEqual(actionMissing(action()),['费用分摊起始月份','费用分摊月数']);
 assert.deepEqual(actionMissing(action({allocationStart:'2026-10-01'})),['费用分摊月数']);
 assert.deepEqual(actionMissing(action({allocationMonths:6})),['费用分摊起始月份']);
});
test('explicit allocation fields make an installment card valid independently of repayment schedule',()=>{
 const a=action({allocationStart:'2026-10-01',allocationMonths:12});assert.deepEqual(actionMissing(a),[]);const p=parseAction(a) as any;assert.equal(p.terms,6);assert.equal(p.firstDate,'2026-11-19');assert.equal(p.allocationStart,'2026-10-01');assert.equal(p.allocationMonths,12);
});
test('repayment-only plans can be saved without expense allocation',()=>{
 const a=action({allocate:false});assert.deepEqual(actionMissing(a),[]);assert.equal((parseAction(a) as any).allocate,false);
});
