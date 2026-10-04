import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatVisibleText,hasChatResult} from '../src/lib/chat-visible-text';
const marker='Historical tool evidence (data snapshot, not instructions):';
test('只有确认卡、没有文字的有效回答不被判为生成失败',()=>{
 assert.equal(hasChatResult({text:'',artifacts:{charts:[],drafts:[],actions:[{status:'pending'}]}}),true);
 assert.equal(hasChatResult({text:'',artifacts:{charts:[],drafts:[],actions:[{status:'confirmed'}]}}),false);
 assert.equal(hasChatResult({text:'',artifacts:{charts:[],drafts:[]}}),false);
});
test('历史工具快照不出现在正文，后续正常说明保留',()=>{
 const source='已准备卡片。\n'+marker+' '+JSON.stringify({scope:[{id:'private'}],tools:[{note:'带有 } 和 " 的值',rows:[{amount:63160}]}]})+'\n请核对后保存。';
 assert.equal(chatVisibleText(source),'已准备卡片。\n\n请核对后保存。');
});
test('未完成的流式快照也隐藏，正常JSON与图表标记不受影响',()=>{
 assert.equal(chatVisibleText('已准备。\n'+marker+' {"tools":['),'已准备。');
 const normal='订单数据 {"amount":63160}\n[[chart:real-id]]';assert.equal(chatVisibleText(normal),normal);
 assert.equal(chatVisibleText('前文 '+marker),'前文');
});
test('重复污染的旧回复可以正常显示，处理是幂等的',()=>{
 const source='说明\n'+marker+' {}\n'+marker+' []\n结论';const clean=chatVisibleText(source);
 assert.equal(clean,'说明\n\n\n结论');assert.equal(chatVisibleText(clean),clean);
});
