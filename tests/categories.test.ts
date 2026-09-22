import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCategories,listCategories,checkCategory} from '../src/server/categories';

test('personal category catalogue uses the user id and includes expanded defaults',async()=>{
 const calls:{sql:string;args:unknown[]}[]=[];
 const connection={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:[{name:'宠物',icon:'🐾',archived:false,deleted:false,position:99}]};}} as any;
 const categories=await listCategories('00000000-0000-0000-0000-000000000001',connection);
 assert.deepEqual(calls[0].args,['00000000-0000-0000-0000-000000000001']);
 assert.match(calls[0].sql,/WHERE user_id=\$1/);
 assert.equal(defaultCategories.length,19);
 assert.ok(['sticker:050','sticker:023','sticker:044','sticker:148'].every(icon=>defaultCategories.some(category=>category[1]===icon)));
 assert.ok(categories.some(category=>category.name==='宠物'));
});

test('disabled category validation is scoped to the current user',async()=>{
 const calls:{sql:string;args:unknown[]}[]=[];
 const connection={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:[{archived:true,deleted:false}]};}} as any;
 await assert.rejects(checkCategory(connection,'00000000-0000-0000-0000-000000000002','宠物'),/这个分类已停用/);
 assert.deepEqual(calls[0].args,['00000000-0000-0000-0000-000000000002','宠物']);
 assert.match(calls[0].sql,/WHERE user_id=\$1/);
});
