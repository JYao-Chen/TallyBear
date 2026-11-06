import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/server/db';
import {memoryModelSettings} from '../src/server/memory-models';
const user={id:'00000000-0000-4000-8000-000000000001',username:'test',name:'test',admin:true,avatar:'',theme:'bear' as const};
test('explicit credential reuse preserves model/index versions, rejects other providers and non-admin users',async()=>{
 const query=db.query,connect=db.connect;let mismatch=false;const writes:{sql:string;args:any[]}[]=[];
 const client={query:async(sql:string,args:any[]=[])=>{if(sql.includes('FROM memory_models'))return {rows:[{base_url:'https://fixture.invalid/v1',encrypted_key:'old',version:7}]};if(sql.includes('FROM ai_settings'))return {rows:[{base_url:mismatch?'https://other.invalid/v1':'https://fixture.invalid/v1/',encrypted_key:'new'}]};if(sql.startsWith('UPDATE'))writes.push({sql,args});return {rows:[]};},release:()=>{}};
 try{
  (db as any).query=async()=>({rows:[{n:3}]});(db as any).connect=async()=>client;
  await memoryModelSettings(user,'POST',{role:'embedding',operation:'reuse-key'});assert.equal(writes.length,2);assert.ok(writes.every(w=>!w.sql.includes('version=')));assert.equal(writes[0].args[1],'new');assert.deepEqual(writes[1].args,['new','https://fixture.invalid/v1','old']);
  writes.length=0;mismatch=true;await assert.rejects(memoryModelSettings(user,'POST',{role:'embedding',operation:'reuse-key'}),/服务地址不同/);assert.equal(writes.length,0);
  await assert.rejects(memoryModelSettings({...user,admin:false},'POST',{role:'embedding',operation:'reuse-key'}),/管理员/);
 }finally{db.query=query;db.connect=connect;}
});
