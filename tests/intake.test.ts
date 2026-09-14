import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchReason,missingFields,refundCandidates} from '../src/server/intake';
const a={id:'a',kind:'expense',amount:1000,date:'2026-09-01',payee:'京东',accountId:'wechat',orderId:'order1',platform:'京东'};
test('订单与流水可通过金额日期候选匹配，缺少商家时仍提示人工核对',()=>{assert.ok(matchReason(a,{...a,id:'b',orderId:'',payee:''}));assert.equal(matchReason(a,{...a,id:'b',amount:1100,orderId:''}),null);});
test('退款不能被当作原消费的重复记录',()=>{assert.equal(matchReason(a,{...a,id:'b',kind:'refund'}),null);});
test('流水号重复与订单金额重复的理由不同',()=>{assert.equal(matchReason({...a,externalId:'pay1'},{...a,id:'b',externalId:'pay1'}),'交易流水号相同');assert.equal(matchReason(a,{...a,id:'b'}),'订单号与金额相同');});
test('缺失金额日期账户必须显式补充',()=>{assert.deepEqual(missingFields({...a,amount:0,date:'',accountId:''}),['金额','日期','账户']);});
test('部分退款可关联早前订单，不匹配未来或金额不足的消费',()=>{assert.equal(refundCandidates({...a,id:'refund',kind:'refund',amount:500,date:'2026-10-01'},[a]).length,1);assert.equal(refundCandidates({...a,id:'refund',kind:'refund',amount:2000},[a]).length,0);});
