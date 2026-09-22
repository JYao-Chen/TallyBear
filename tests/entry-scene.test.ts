import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneSchema,sceneTitle} from '../src/lib/entry-scene';
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

test('unknown scene fields returned as null stay blank',()=>{assert.equal(sceneSchema.parse({type:'transport',origin:null}).origin,'');});
