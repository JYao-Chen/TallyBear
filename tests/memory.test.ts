import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exactMemory,specConflict,rankFusion,redactMemoryText,type Memory} from '../src/lib/memory';
const m=(title:string,patch:Partial<Memory>={}):Memory=>({id:'1',owner_id:'u',family_id:null,title,content:'',kind:'product',aliases:[],attributes:{},status:'active',version:1,explicit:true,...patch});
const products=['牛肉面','鸡肉饭','苹果云空间','视频会员','无线鼠标','洗发水','猫粮','咖啡豆','跑鞋','牙膏','纸巾','电池','保温杯','洗衣液','面包','牛奶','酸奶','矿泉水','维生素','雨伞','笔记本','背包','充电器','数据线','键盘'];
for(const name of products){
 test(`exact ${name}: different prices do not change identity`,()=>assert.equal(exactMemory(name,'',m(name)),true));
 test(`ambiguous ${name}: merchant alone is insufficient`,()=>assert.equal(exactMemory('','同一家店',m(name,{attributes:{merchant:'同一家店'}})),false));
 test(`alias ${name}: explicit alias can match`,()=>assert.equal(exactMemory(name+'常用','',m(name,{aliases:[name+'常用']})),true));
 test(`different ${name}: different specifications conflict`,()=>assert.equal(exactMemory(name+' 256GB','',m(name+' 128GB')),false));
}
test('Plus and Pro cannot be treated as the same plan',()=>assert.equal(specConflict('GPT Plus','GPT Pro'),true));
test('repeated specification in extracted attributes is not a conflict',()=>assert.equal(specConflict('iCloud 200GB','iCloud 200GB 200GB'),false));
test('rank fusion combines evidence without duplicating products',()=>assert.deepEqual(rankFusion([[m('A')],[m('B',{id:'2'}),m('A')]]).map(x=>x.id),['1','2']));
test('external memory text masks long identifiers and email',()=>assert.equal(redactMemoryText('iCloud user@example.com 1234567890123456'),'iCloud [email] [identifier]'));
