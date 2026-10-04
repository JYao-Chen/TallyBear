import test from 'node:test';
import assert from 'node:assert/strict';
import {applyProfile,buildProfile,coarseLocation,conditionKey,dayType,distanceMeters,profileConditionSchema,timeBand,type ProfileEvidence,type ProfileRule} from '../src/lib/personal-profile';
import {sceneSchema} from '../src/lib/entry-scene';
const now=Date.parse('2026-10-01T12:00:00Z');
const evidence=(id:string,overrides:Partial<ProfileEvidence>={}):ProfileEvidence=>({id,eventId:id,date:'2026-09-29',at:'2026-09-29',kind:'expense',category:'餐饮',payee:'面馆',title:'午餐',accountId:'wechat',scene:sceneSchema.parse({type:'dining',meal:'午餐',diningMode:'dine_in'}),...overrides});
const rows=Array.from({length:5},(_,i)=>evidence(String(i)));
const options={wallets:new Map([['wechat','微信'],['bank','银行卡']]),categories:new Set(['餐饮','其他','购物'])};
const input={kind:'expense',category:'其他',payee:'面馆',scene:sceneSchema.parse({type:'dining'}),accountId:''};
test('destination book rules respect explicit input, permissions and conflicts',()=>{
 const books=new Map([['personal','Personal'],['shared','Shared']]),transport={...input,bookId:undefined as string|undefined,scene:sceneSchema.parse({type:'transport',transport:'地铁'})};
 const condition=profileConditionSchema.parse({fields:{'scene.type':'transport'}});
 const rule:ProfileRule={condition,field:'bookId',value:'personal',state:'confirmed'};
 const result=applyProfile(transport,transport,[],[rule],{...options,books});
 assert.equal(result.value.bookId,'personal');assert.equal(result.suggestions[0].label,'Personal');
 const explicit={...transport,bookId:'shared'};
 assert.equal(applyProfile(explicit,explicit,[],[rule],{...options,books}).value.bookId,'shared');
 assert.equal(applyProfile(transport,transport,[],[rule],options).value.bookId,undefined);
 const conflict=applyProfile(transport,transport,[],[rule,{...rule,value:'shared'}],{...options,books});
 assert.equal(conflict.value.bookId,undefined);assert.equal(conflict.suggestions.filter(s=>s.state==='candidate').length,2);
});
test('generic profile groups multiple contexts without commute-specific defaults',()=>{
 const result=buildProfile([...rows,...rows.map(r=>({...r,id:'s'+r.id,eventId:'s'+r.id,payee:'超市',category:'购物',scene:sceneSchema.parse({type:'shopping'}),accountId:'bank'}))],now);
 assert.ok(result.some(i=>i.field==='accountId'&&i.condition.fields.payee==='面馆'&&i.status==='stable'&&i.choices[0].value==='wechat'));
 assert.ok(result.some(i=>i.field==='accountId'&&i.condition.fields.payee==='超市'&&i.choices[0].value==='bank'));
 const filled=applyProfile(input,input,result,[],options);assert.equal(filled.value.accountId,'wechat');assert.ok(filled.suggestions.some(s=>s.basis==='profile'));
 const fields={payee:'Cafe A'};assert.equal(conditionKey({kind:'expense',fields,timeBand:'midday',dayType:'weekday'}),conditionKey({dayType:'weekday',fields,kind:'expense',timeBand:'midday'}));
});
test('transactions copied across books are one observation',()=>{
 const result=buildProfile([evidence('1'),evidence('2',{eventId:'1'}),evidence('3',{eventId:'1'})],now);assert.equal(result.length,0);
});
test('recent consistent changes are reported separately from established habits',()=>{
 const result=buildProfile([...Array.from({length:8},(_,i)=>evidence('old'+i,{date:'2026-07-01'})),...Array.from({length:4},(_,i)=>evidence('new'+i,{accountId:'bank'}))],now);
 const wallet=result.find(i=>i.field==='accountId'&&i.condition.fields.payee==='面馆')!;assert.equal(wallet.status,'changed');assert.equal(wallet.previousValue,'wechat');
 assert.equal(applyProfile(input,input,[wallet],[],options).value.accountId,'');
});
test('an isolated exception does not overturn an established pattern',()=>{
 const result=buildProfile([...rows,...rows.map(r=>({...r,id:'more'+r.id,eventId:'more'+r.id})),evidence('exception',{accountId:'bank'})],now);
 const wallet=result.find(i=>i.field==='accountId'&&i.condition.fields.payee==='面馆')!;assert.equal(wallet.status,'stable');assert.equal(wallet.choices[0].value,'wechat');
});
test('old purchases stay stale even after editing today',()=>{
 const result=buildProfile(rows.map(r=>({...r,date:'2025-01-01',at:'2026-10-01'})),now);assert.ok(result.every(i=>i.status==='stale'));
});
test('unconfirmed automatic defaults cannot become independent evidence',()=>{
 const result=buildProfile(rows.map(r=>({...r,preferenceSuggestions:[{field:'accountId',value:'wechat',label:'微信',before:'',state:'applied',count:4,basis:'profile',sources:[]}]})),now);
 assert.ok(result.filter(i=>i.field==='accountId').every(i=>i.status==='tentative'));
});
test('explicit rules override statistics but never the current user input',()=>{
 const rules:ProfileRule[]=[{condition:profileConditionSchema.parse({fields:{payee:'面馆'}}),field:'accountId',value:'bank',state:'confirmed'}];
 assert.equal(applyProfile(input,input,buildProfile(rows,now),rules,options).value.accountId,'bank');
 const explicit={...input,accountId:'wechat'};assert.equal(applyProfile(explicit,explicit,buildProfile(rows,now),rules,options).value.accountId,'wechat');
});
test('equally specific conflicting rules remain candidates',()=>{
 const rules:ProfileRule[]=['wechat','bank'].map(value=>({condition:profileConditionSchema.parse({fields:{payee:'面馆'}}),field:'accountId',value,state:'confirmed'}));
 const result=applyProfile(input,input,[],rules,options);assert.equal(result.value.accountId,'');assert.equal(result.suggestions.filter(s=>s.state==='candidate').length,2);
});
test('disabled old rule does not override its explicit replacement; empty disabled rule stops suggestions',()=>{
 const condition=profileConditionSchema.parse({fields:{payee:'面馆'}}),rules:ProfileRule[]=[{condition,field:'accountId',value:'wechat',state:'disabled'},{condition,field:'accountId',value:'bank',state:'confirmed'}];
 assert.equal(applyProfile(input,input,[],rules,options).value.accountId,'bank');
 assert.equal(applyProfile(input,input,buildProfile(rows,now),[{condition,field:'accountId',value:'',state:'disabled'}],options).value.accountId,'');
});
test('rejected suggestions cannot reappear through another statistical group',()=>{
 const rule:ProfileRule={condition:profileConditionSchema.parse({fields:{payee:'面馆'}}),field:'accountId',value:'wechat',state:'rejected'};
 const result=applyProfile(input,input,buildProfile(rows,now),[rule],options);assert.equal(result.value.accountId,'');assert.ok(!result.suggestions.some(s=>s.field==='accountId'&&s.value==='wechat'));
});
test('unknown transaction time has no time-of-day context',()=>{
 assert.equal(timeBand(''),undefined);assert.equal(timeBand('最近'),undefined);assert.equal(timeBand('12:03'),'midday');assert.equal(dayType('2026-10-03'),'weekend');
 const condition=profileConditionSchema.parse({fields:{payee:'面馆'},timeBand:'midday'}),rule:ProfileRule={condition,field:'accountId',value:'wechat',state:'confirmed'};
 assert.equal(applyProfile(input,input,[],[rule],options).value.accountId,'');
 assert.equal(applyProfile(input,{...input,occurredAt:'12:03'},[],[rule],options).value.accountId,'wechat');
});
test('location is coarse and region matching does not manufacture a venue',()=>{
 const point=coarseLocation({latitude:39.912345,longitude:116.398765,accuracy:12,capturedAt:'2026-10-01T10:00:00Z'});
 assert.equal(point.latitude,39.91);assert.equal(point.longitude,116.4);assert.equal(point.accuracy,1500);assert.equal(distanceMeters(point,point),0);
});
test('condition equality is order- and spelling-normalized',()=>{
 assert.equal(conditionKey(profileConditionSchema.parse({fields:{payee:'Cafe A',platform:'App'}})),conditionKey(profileConditionSchema.parse({fields:{platform:'app',payee:'cafe a'}})));
});
