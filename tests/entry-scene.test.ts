import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneSchema,sceneTitle} from '../src/lib/entry-scene';
import {relatedPreferences} from '../src/server/receipt-preferences';
test('transport titles preserve known endpoints without inventing missing stations',()=>{
 const scene=sceneSchema.parse({type:'transport',transport:'地铁',origin:'西直门',destination:'国贸'});
 assert.equal(sceneTitle(scene),'地铁 · 西直门 → 国贸');
 assert.equal(sceneTitle({...scene,destination:''}),'地铁 · 西直门');
 assert.equal(scene.destination,'国贸');
});
test('dining and shopping use short scene titles rather than item lists',()=>{
 assert.equal(sceneTitle(sceneSchema.parse({type:'dining',merchant:'陶陶居',meal:'晚餐'})),'陶陶居 · 晚餐');
 assert.equal(sceneTitle(sceneSchema.parse({type:'groceries',merchant:'盒马'})),'盒马 · 买菜');
 assert.equal(sceneTitle(sceneSchema.parse({type:'shopping',merchant:'Target'}),true),'Target · Shopping');
});
test('history selection prefers the same merchant and deduplicates repeated samples',()=>{
 const scene=sceneSchema.parse({type:'dining',merchant:'陶陶居'});
 const same={payee:'陶陶居餐饮有限公司',category:'餐饮',scene,title:'陶陶居 · 晚餐'};
 const unrelated={...same,payee:'别的商家',scene:sceneSchema.parse({type:'shopping',merchant:'别的商家'})};
 const result=relatedPreferences({payee:same.payee,scene},[unrelated,same,same]);
 assert.equal(result.exact,true);assert.deepEqual(result.examples,[same]);
 assert.deepEqual(relatedPreferences({payee:'新商家',scene:sceneSchema.parse({})},[same]).examples,[]);
});

test('unknown scene fields returned as null stay blank',()=>{assert.equal(sceneSchema.parse({type:'transport',origin:null}).origin,'');});
test('matching route takes priority over unrelated transport examples',()=>{
 const scene=sceneSchema.parse({type:'transport',transport:'地铁',origin:'西直门',destination:'国贸'});
 const same={payee:'',category:'通勤',scene,title:'上班'};
 const other={...same,category:'旅行',scene:{...scene,destination:'机场'}};
 assert.deepEqual(relatedPreferences({payee:'',scene},[other,same]).examples,[same]);
});
