import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recommendCategory,type CategoryEvidence,type CategoryInput} from '../src/lib/category-learning';
import {sceneSchema} from '../src/lib/entry-scene';

const valid=new Set(['餐饮','购物','宠物','通勤','旅行']);
const input=(patch:Partial<CategoryInput>={}):CategoryInput=>({kind:'expense',payee:'盒马鲜生',category:'购物',scene:sceneSchema.parse({type:'groceries',merchant:'盒马'}),title:'盒马买菜',product:'蔬菜 牛奶',lineItems:[],...patch});
const evidence=(id:string,category:string,patch:Partial<CategoryEvidence>={}):CategoryEvidence=>({id,category,kind:'expense',payee:'盒马鲜生',scene:sceneSchema.parse({type:'groceries',merchant:'盒马'}),title:'盒马买菜',product:'蔬菜 牛奶',lineItems:[],source:'accepted',at:new Date(),...patch});

test('frequent personal confirmations beat a one-off category',()=>{
 const rows=[evidence('1','餐饮'),evidence('2','餐饮'),evidence('3','餐饮'),evidence('4','购物')];
 const result=recommendCategory(input(),rows,valid);assert.equal(result?.category,'餐饮');assert.ok((result?.confidence||0)>=.6);assert.equal(result?.evidenceCount,3);
});

test('a direct correction adapts faster than legacy rows',()=>{
 const rows=[evidence('1','购物',{source:'legacy'}),evidence('2','购物',{source:'legacy'}),evidence('3','宠物',{source:'correction',product:'猫粮'}),evidence('4','宠物',{source:'correction',product:'猫粮'})];
 assert.equal(recommendCategory(input({product:'猫粮',title:'盒马猫粮'}),rows,valid)?.category,'宠物');
});

test('recent corrections can replace an older saved preset',()=>{
 const rows=[evidence('preset','购物',{source:'template'}),evidence('1','宠物',{source:'correction',product:'猫粮'}),evidence('2','宠物',{source:'correction',product:'猫粮'})];
 assert.equal(recommendCategory(input({product:'猫粮',title:'盒马猫粮'}),rows,valid)?.category,'宠物');
});

test('item context separates categories at a multi-purpose merchant',()=>{
 const rows=[evidence('1','餐饮',{product:'蔬菜 牛奶'}),evidence('2','餐饮',{product:'水果 面包'}),evidence('3','餐饮',{product:'生鲜 肉类'}),evidence('4','宠物',{product:'猫粮 猫砂'}),evidence('5','宠物',{product:'猫粮 罐头'}),evidence('6','宠物',{product:'猫砂 猫粮'})];
 assert.equal(recommendCategory(input({product:'猫粮 猫砂',title:'盒马宠物用品'}),rows,valid)?.category,'宠物');
});

test('an explicit category is never overridden',()=>{
 assert.equal(recommendCategory(input({category:'旅行',categorySource:'explicit'}),[evidence('1','餐饮'),evidence('2','餐饮'),evidence('3','餐饮')],valid),null);
});

test('payment platforms are not treated as merchants',()=>{
 const rows=[evidence('1','餐饮',{payee:'微信',scene:sceneSchema.parse({type:'dining'})}),evidence('2','餐饮',{payee:'微信',scene:sceneSchema.parse({type:'dining'})}),evidence('3','餐饮',{payee:'微信',scene:sceneSchema.parse({type:'dining'})})];
 assert.equal(recommendCategory(input({payee:'微信',scene:sceneSchema.parse({type:'shopping'}),product:'耳机',title:'购买耳机'}),rows,valid),null);
});

test('an exact transport route outranks other transport history',()=>{
 const route=sceneSchema.parse({type:'transport',transport:'地铁',origin:'西直门',destination:'国贸'});
 const rows=[evidence('1','通勤',{payee:'',scene:route}),evidence('2','通勤',{payee:'',scene:route}),evidence('3','通勤',{payee:'',scene:route}),evidence('4','旅行',{payee:'',scene:{...route,destination:'机场'}})];
 assert.equal(recommendCategory(input({payee:'',scene:route,title:'地铁通勤',product:''}),rows,valid)?.category,'通勤');
});

test('ambiguous low-support history does not override the recognizer',()=>{
 assert.equal(recommendCategory(input(),[evidence('1','餐饮'),evidence('2','购物')],valid),null);
});
