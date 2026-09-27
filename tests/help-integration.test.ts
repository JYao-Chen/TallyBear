import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

test('help database indexing, semantic retrieval, versions and keyword fallback',{skip:!process.env.HELP_TEST_DATABASE_URL},async()=>{
 process.env.DATABASE_URL=process.env.HELP_TEST_DATABASE_URL;
 process.env.ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 const {db}=await import('../src/server/db');const {encrypt}=await import('../src/server/ai');
 const {prepareHelp,indexHelp,searchHelp,syncHelp}=await import('../src/server/help');
 const saved=globalThis.fetch;let fail=false,calls=0;
 globalThis.fetch=async(_url,init)=>{calls++;if(fail)return new Response('',{status:503});const input=JSON.parse(String(init?.body)).input;const vector=/refund|reimbursement/i.test(input)?[1,0]:[0,1];return Response.json({data:[{embedding:vector}],usage:{total_tokens:5}});};
 try{
  const id=randomUUID();await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$3)',[id,'help-'+id,'test']);
  for(const role of ['embedding','extraction','judgment'])await db.query('INSERT INTO memory_models(role,base_url,model,encrypted_key,dimensions) VALUES($1,$2,$3,$4,2)',[role,'https://example.invalid/v1','fixture',encrypt('fixture')]);
  await db.query("INSERT INTO memory_embedding_versions SELECT version,base_url,model,encrypted_key,dimensions FROM memory_models WHERE role='embedding'");
  assert.equal((await prepareHelp(id)).state,'indexing');await prepareHelp(id);assert.equal((await db.query("SELECT count(*)::int AS n FROM ai_jobs WHERE payload->>'operation'='help-index'")).rows[0].n,1);
  await indexHelp({modelVersion:1},{});assert.equal((await prepareHelp(id)).state,'ready');const count=calls;await indexHelp({modelVersion:1},{});assert.equal(calls,count);
  const semantic=await searchHelp(id,'reimbursement','en');assert.equal(semantic.mode,'hybrid');assert.ok(semantic.items.some(a=>a.id==='refund'&&a.match==='semantic'));
  const book=randomUUID();await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'Help fixture','private',$2)",[book,id]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,id]);
  const {executeFinanceTool}=await import('../src/server/finance-agent');const artifacts:any={charts:[],drafts:[],tools:[]};
  await executeFinanceTool('search_help',{query:'refund'},{book,user:{id,name:'Reader',admin:false} as any,language:'en',images:[],signal:new AbortController().signal},artifacts);
  assert.ok(artifacts.links.some((l:any)=>l.page==='help'&&l.helpId==='refund'));
  fail=true;const fallback=await searchHelp(id,'refund','en');assert.equal(fallback.mode,'keyword');assert.ok(fallback.items.some(a=>a.id==='refund'));fail=false;
  await db.query("UPDATE help_articles SET article=article||'{\"intro\":\"obsolete\"}'::jsonb WHERE id='refund' AND locale='en'");await syncHelp();assert.equal((await db.query("SELECT version FROM help_articles WHERE id='refund' AND locale='en'")).rows[0].version,2);await indexHelp({modelVersion:1},{});
  await db.query("UPDATE memory_models SET version=2 WHERE role='embedding'");const changed=await searchHelp(id,'money back','en');assert.equal(changed.mode,'keyword');assert.equal(changed.indexState,'indexing');
 }finally{globalThis.fetch=saved;await db.end();}
});
