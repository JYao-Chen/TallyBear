import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAction} from '../src/server/chat-actions';
import {transactionEntry} from '../src/server/transaction-changes';

const transactionId='00000000-0000-4000-8000-000000000001';
const sourceAccount='00000000-0000-4000-8000-000000000002';
const targetAccount='00000000-0000-4000-8000-000000000003';
const row={id:transactionId,accountId:sourceAccount,targetId:null,kind:'expense',amount:5800,date:'2026-09-10',payee:'测试商家',category:'餐饮',note:'',title:'午餐',scene:{},product:'',platform:'',orderId:'',occurredAt:'',refundOf:null,lineItems:[],verificationReason:'',external_id:null};

test('已入账支出可以在确认卡中改为原地转账，不生成第二个交易ID',()=>{
 const value=transactionEntry(row,{kind:'transfer',targetId:targetAccount,category:'其他',title:'信用卡还款'});
 const parsed=parseAction({id:'00000000-0000-4000-8000-000000000004',kind:'transaction',bookId:'00000000-0000-4000-8000-000000000005',title:'变更已入账账目',status:'pending',data:{...value,operation:'update',transactionId,version:3},missing:[],warnings:[],summary:[]}) as any;
 assert.equal(parsed.operation,'update');
 assert.equal(parsed.value.id,transactionId);
 assert.equal(parsed.value.kind,'transfer');
 assert.equal(parsed.value.targetId,targetAccount);
});

test('删除确认卡只携带目标和版本，不需要伪造新账目字段',()=>{
 const parsed=parseAction({id:'00000000-0000-4000-8000-000000000004',kind:'transaction',bookId:'00000000-0000-4000-8000-000000000005',title:'变更已入账账目',status:'pending',data:{operation:'delete',transactionId,version:3},missing:[],warnings:[],summary:[]}) as any;
 assert.deepEqual(parsed,{operation:'delete',transactionId,version:3});
});

test('助手修改旧账时可以补充可选交易流水号',()=>{
 const value=transactionEntry(row,{externalId:'wx-flow-20260910-01'});
 assert.equal(value.externalId,'wx-flow-20260910-01');
 assert.equal(value.id,transactionId);
});
