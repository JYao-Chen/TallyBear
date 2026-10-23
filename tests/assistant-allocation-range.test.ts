import test from 'node:test';import assert from 'node:assert/strict';
import {parseAction,actionMissing} from '../src/server/chat-actions';
import type {ChatAction} from '../src/lib/chat-actions';
const id='11111111-1111-4111-8111-111111111111';
const action=(data:Record<string,unknown>)=>({id,kind:'allocation',bookId:id,status:'pending',title:'费用分摊',missing:[],warnings:[],summary:[],data:{transactionId:id,version:1,...data}} as ChatAction);
test('assistant keeps exact inclusive dates and ignores leftover calendar fields',()=>{
 const p=parseAction(action({startDate:'2026-10-23',endDate:'2027-10-29',periodUnit:'month',periodCount:12})) as any;
 assert.equal(p.startDate,'2026-10-23');assert.equal(p.endDate,'2027-10-29');assert.equal(p.periodUnit,'day');assert.equal(p.periodCount,372);
});
test('assistant range validation handles missing end, reversed dates and leap days',()=>{
 assert.ok(actionMissing(action({startDate:'2026-10-23'})).includes('结束日期（含当天）'));
 assert.ok(actionMissing(action({startDate:'2026-10-23',endDate:'2026-10-22'})).includes('结束日期不能早于开始日期'));
 assert.ok(actionMissing(action({startDate:'2026-10-23',endDate:'2026-02-30'})).includes('结束日期（含当天）'));
 assert.equal((parseAction(action({startDate:'2028-02-28',endDate:'2028-03-01'})) as any).periodCount,3);
 assert.equal((parseAction(action({startDate:'2026-10-23',endDate:'2026-10-23'})) as any).periodCount,1);
});
test('assistant still supports fixed periods and clearing a previous date range',()=>{
 const p=parseAction(action({startDate:'2026-10-01',endDate:null,periodUnit:'month',periodCount:12})) as any;
 assert.equal(p.periodUnit,'month');assert.equal(p.periodCount,12);assert.equal(p.endDate,undefined);
});
