import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {memoryModelSettings} from '../src/server/memory-models';
import {memoryRoute,searchMemories} from '../src/server/memory';
import {runMemoryJob} from '../src/server/memory-worker';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_memory_test'));
const originalFetch=globalThis.fetch;
const owner=randomUUID(),other=randomUUID();const user={id:owner,admin:true} as any;
try{
 for(const id of [owner,other])await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'向量测试','unused')",[id]);
 let fail=false;
 globalThis.fetch=async(_url,options)=>{if(fail)throw new Error('simulated timeout');const body=JSON.parse(String(options?.body));return Response.json({data:[{embedding:body.dimensions===3?[1,0,0]:[1,0]}],usage:{total_tokens:10}});};
 await memoryModelSettings(user,'POST',{role:'embedding',base_url:'http://embedding.test/v1',model:'fixture-v1',key:'test-only',dimensions:2});
 const saved=await memoryRoute(user,'POST',new URLSearchParams(),{operation:'save',kind:'product',title:'iCloud',attributes:{brand:'Apple',specification:'200GB'}}) as {id:string};
 await runMemoryJob(owner,{operation:'rebuild'},{});
 const active1=(await db.query('SELECT version FROM memory_embedding_active WHERE user_id=$1',[owner])).rows[0].version;
 assert.equal((await searchMemories(owner,'苹果云空间','product'))[0].id,saved.id);
 assert.equal((await searchMemories(other,'苹果云空间','product')).length,0);
 await memoryModelSettings(user,'POST',{role:'embedding',base_url:'http://embedding.test/v1',model:'fixture-v2',dimensions:3});
 assert.equal((await db.query('SELECT version FROM memory_embedding_active WHERE user_id=$1',[owner])).rows[0].version,active1);
 assert.equal((await searchMemories(owner,'苹果云空间','product'))[0].id,saved.id);
 await runMemoryJob(owner,{operation:'rebuild'},{});assert.ok((await db.query('SELECT version FROM memory_embedding_active WHERE user_id=$1',[owner])).rows[0].version>active1);
 fail=true;assert.equal((await searchMemories(owner,'iCloud','product'))[0].id,saved.id);assert.equal((await searchMemories(owner,'无关键字','product')).length,0);
 console.log('PASS: permission-scoped pgvector retrieval, old index retained until rebuild, model dimension isolation, lexical fallback (mocked embedding provider; not a semantic-quality benchmark)');
}finally{globalThis.fetch=originalFetch;await db.query("DELETE FROM memory_models WHERE base_url='http://embedding.test/v1'");await db.end();}
