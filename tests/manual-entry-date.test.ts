import {test} from 'node:test';import assert from 'node:assert/strict';import {manualEntryDate} from '../src/lib/manual-entry-date';
test('新手动记录使用今天，不继承空白云草稿的旧日期',()=>{
 const today='2026-10-20';assert.equal(manualEntryDate(undefined,today),today);assert.equal(manualEntryDate({date:'2026-09-27',amount:0,title:'',note:'',lineItems:[],photoIds:[],scene:{type:'general',origin:'',diningMode:'unknown'}},today),today);
});
test('真正未完成的历史草稿保留日期，非法日期回到今天',()=>{
 const today='2026-10-20';for(const draft of [{amount:5000},{title:'历史电费'},{note:'补记'},{lineItems:[{name:'电费'}]},{photoIds:['receipt']},{scene:{origin:'北京南站'}},{platform:'缴费平台'}])assert.equal(manualEntryDate({date:'2026-09-27',...draft},today),'2026-09-27');assert.equal(manualEntryDate({amount:5000,date:'2026-02-30'},today),today);
});
