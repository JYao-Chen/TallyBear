import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inferPreferences,rankPreferenceEvidence,resolvePreference,type PreferenceInput,type PreferenceEvidence,type PreferenceSuggestion} from '../src/lib/preference-learning';
import {sceneSchema} from '../src/lib/entry-scene';
const now=Date.parse('2026-10-01T12:00:00Z');
const input=(patch:Partial<PreferenceInput>={}):PreferenceInput=>({kind:'expense',category:'其他',payee:'',scene:sceneSchema.parse({}),...patch});
const row=(id:string,patch:Partial<PreferenceEvidence>={}):PreferenceEvidence=>({...input(),id,at:new Date(now),date:'2026-10-01',accountId:'wechat',...patch});
const copies=(patch:Partial<PreferenceEvidence>,n=4)=>Array.from({length:n},(_,i)=>row('r'+i,patch));
const infer=(current:PreferenceInput,rows:PreferenceEvidence[],query='',semanticIds?:Set<string>)=>inferPreferences(current,rankPreferenceEvidence(current,rows,query),{wallets:new Map([['wechat','微信'],['bank','银行卡']]),categories:new Set(['交通','餐饮','会员订阅','购物','宠物','工资']),now,semanticIds});
test('route input learns wallet and category but not old amount or payment references',()=>{
 const scene=sceneSchema.parse({type:'transport',transport:'地铁',origin:'甲站',destination:'乙站'});
 const current={...input({scene}),amount:0,date:'2026-10-01',orderId:''};
 const result=infer(current,copies({scene,category:'交通'}));assert.equal(result.value.accountId,'wechat');assert.equal(result.value.category,'交通');assert.equal((result.value as typeof current).amount,0);assert.equal((result.value as typeof current).orderId,'');
});
test('generic dining, shopping and subscriptions learn separately, not a commute special case',()=>{
 for(const [payee,category,wallet] of [['咖啡店','餐饮','wechat'],['宠物用品店','宠物','bank'],['云服务商','会员订阅','bank']]){
  const result=infer(input({payee}),copies({payee,category,accountId:wallet}));assert.equal(result.value.category,category);assert.equal(result.value.accountId,wallet);
 }
});
test('vague intent can recall all semantic contexts, filling shared preferences without inventing a route',()=>{
 const outbound=copies({title:'上班路程',scene:sceneSchema.parse({type:'transport',transport:'地铁',origin:'甲站',destination:'乙站'}),category:'交通'});
 const returning=copies({title:'回家路程',scene:sceneSchema.parse({type:'transport',transport:'地铁',origin:'乙站',destination:'甲站'}),category:'交通'}).map(r=>({...r,id:'back'+r.id}));
 const rows=[...outbound,...returning],result=infer(input(),rows,'通勤记账',new Set(rows.map(r=>r.id)));
 assert.equal(result.value.accountId,'wechat');assert.equal(result.value.scene?.transport,'地铁');assert.equal(result.value.scene?.origin,'');assert.ok(result.suggestions.some(s=>s.field==='scene.origin'&&s.state==='candidate'));
});
test('context separates different purchases at the same merchant',()=>{
 const food=copies({payee:'大超市',product:'蔬菜牛奶',category:'餐饮',accountId:'wechat'}),pet=copies({payee:'大超市',product:'猫粮猫砂',category:'宠物',accountId:'bank'}).map(r=>({...r,id:'pet'+r.id}));
 const result=infer(input({payee:'大超市',product:'猫粮猫砂'}),[...food,...pet]);assert.equal(result.value.accountId,'bank');assert.equal(result.value.category,'宠物');
});
test('current explicit values are never replaced',()=>{
 const current=input({payee:'咖啡店',accountId:'bank',category:'购物',categorySource:'explicit'});const result=infer(current,copies({payee:'咖啡店',accountId:'wechat',category:'购物'}));assert.equal(result.value.accountId,'bank');assert.equal(result.value.category,'购物');
});
test('different specifications and opposite route are not habit evidence',()=>{
 assert.equal(infer(input({payee:'云服务商',product:'GPT Pro'}),copies({payee:'云服务商',product:'GPT Plus',category:'会员订阅'})).value.accountId,undefined);
 const scene=sceneSchema.parse({type:'transport',origin:'甲站',destination:'乙站'});assert.equal(infer(input({scene}),copies({scene:{...scene,origin:'乙站',destination:'甲站'}})).value.accountId,undefined);
});
test('equal wallet alternatives and one-off history stay candidates',()=>{
 const rows=[...copies({payee:'餐馆'}),...copies({payee:'餐馆',accountId:'bank'}).map(r=>({...r,id:'b'+r.id}))];assert.equal(infer(input({payee:'餐馆'}),rows).value.accountId,undefined);assert.equal(infer(input({payee:'餐馆'}),rows.slice(0,1)).value.accountId,undefined);
});
test('reused book appearances count once and unauthorized wallet cannot fill',()=>{
 const duplicated=copies({payee:'餐馆',eventId:'same'});assert.equal(infer(input({payee:'餐馆'}),duplicated).value.accountId,undefined);assert.equal(infer(input({payee:'餐馆'}),copies({payee:'餐馆',accountId:'other-user-wallet'})).value.accountId,undefined);
});
test('income habits do not cross into spending',()=>{
 const result=infer(input({payee:'公司'}),copies({payee:'公司',kind:'income',category:'工资'}));assert.equal(result.value.accountId,undefined);
});
test('recent wallet corrections outweigh old history; generated defaults do not bootstrap certainty',()=>{
 const suggestion:PreferenceSuggestion={field:'accountId',value:'wechat',label:'微信',before:'',state:'applied',count:4,basis:'context',sources:[]};
 const old=copies({payee:'餐馆',date:new Date(now-240*86400000).toISOString().slice(0,10),at:new Date(now)}),changed=copies({payee:'餐馆',accountId:'bank',preferenceSuggestions:[suggestion]},2).map(r=>({...r,id:'new'+r.id}));assert.equal(infer(input({payee:'餐馆'}),[...old,...changed]).value.accountId,'bank');
 assert.equal(infer(input({payee:'餐馆'}),copies({payee:'餐馆',preferenceSuggestions:[suggestion]},20)).value.accountId,undefined);
});
test('undo keeps subsequent manual changes; explicit candidate selection remains learnable',()=>{
 const result=infer(input({payee:'餐馆'}),copies({payee:'餐馆'})),value={...result.value,preferenceSuggestions:result.suggestions};const s=result.suggestions.find(s=>s.field==='accountId')!;
 assert.equal(resolvePreference(value,s,false).accountId,'');assert.equal(resolvePreference({...value,accountId:'bank'},s,false).accountId,'bank');assert.equal(resolvePreference(value,s,true).preferenceSuggestions?.find(s=>s.field==='accountId')?.confirmed,true);
});
test('an empty request cannot recall the most frequent wallet without context',()=>{
 assert.equal(infer(input(),copies({payee:'餐馆'}),'帮我记一笔').value.accountId,undefined);
});
