import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreChatScope,chatEvidence} from '../src/lib/chat-context';
const turn={question:'花了多少',answer:'4374.30',artifacts:{analysisBooks:[{id:'shared',name:'共同账本'},{id:'private',name:'个人账本'}],tools:[{name:'financial_summary',args:{from:'2026-09-01',to:'2026-09-30'},result:{totals:{expense:437430}}},{name:'find_transactions',result:{rows:[{id:'repayment',book_id:'private',amount:96437,version:1,title:'京东白条还款'}]}}]}};
test('重开对话恢复多账本范围而不是当前单本',()=>assert.deepEqual(restoreChatScope([turn],['shared','private'],'shared'),['shared','private']));
test('只恢复仍有访问权限的账本',()=>assert.deepEqual(restoreChatScope([turn],['shared'],'shared'),['shared']));
test('历史证据携带真实金额、记录ID和来源范围',()=>{const result=chatEvidence(turn,['shared','private']);assert.equal(result.tools?.[0].totals.expense,437430);assert.equal(result.tools?.[1].rows[0].id,'repayment');assert.equal(result.tools?.[1].rows[0].book_id,'private');});
test('权限撤销后不把旧工具私有内容再次传给模型',()=>assert.equal(chatEvidence(turn,['shared']).unavailable,true));
test('新对话使用当前账本，未完成轮次也可恢复已保存范围',()=>{assert.deepEqual(restoreChatScope([],['shared'],'shared'),['shared']);assert.deepEqual(restoreChatScope([{...turn,answer:'',artifacts:{analysisBooks:turn.artifacts.analysisBooks}}],['shared','private'],'shared'),['shared','private']);});
