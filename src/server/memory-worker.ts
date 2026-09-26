import {randomUUID} from 'node:crypto';
import {db,transaction} from './db';
import {memoryEnabled} from './memory';
import {memoryInput,normMemory,type MemoryInput} from '@/lib/memory';
import {memoryProducts} from '@/lib/memory-products';
import {extractProductFacts} from './memory-intelligence';
import {memoryModel,ensureMemoryModels} from './memory-models';
import type {ModelProgress} from './ai';

export async function dispatchMemory(){
 await ensureMemoryModels();
 await transaction(async c=>{
  const rows=(await c.query("SELECT o.* FROM memory_outbox o LEFT JOIN memory_settings s ON s.user_id=o.user_id WHERE COALESCE(s.enabled,true) AND NOT EXISTS(SELECT 1 FROM ai_jobs j WHERE j.user_id=o.user_id AND j.kind='memory' AND j.status IN ('queued','running') AND j.payload->>'sourceId'=o.source_id::text) AND (o.source_type<>'turn' OR EXISTS(SELECT 1 FROM memory_models WHERE role='extraction')) ORDER BY o.id FOR UPDATE OF o SKIP LOCKED LIMIT 10")).rows;
  for(const r of rows){await c.query("INSERT INTO ai_jobs(id,user_id,kind,payload) VALUES($1,$2,'memory',$3)",[randomUUID(),r.user_id,{operation:'source',sourceType:r.source_type,sourceId:r.source_id}]);await c.query('DELETE FROM memory_outbox WHERE id=$1',[r.id]);}
 });
}
async function vectorize(id:string,signal?:AbortSignal,version?:number){
 const m=(await db.query("SELECT * FROM memories WHERE id=$1 AND status<>'forgotten'",[id])).rows[0];if(!m)return;
 const cfg=version?{version}:(await db.query("SELECT version FROM memory_models WHERE role='embedding'")).rows[0];if(!cfg)return;
 if((await db.query('SELECT 1 FROM memory_vectors WHERE memory_id=$1 AND model_version=$2 AND content_version=$3',[id,cfg.version,m.version])).rowCount)return;
 const v=await memoryModel('embedding',JSON.stringify({title:m.title,aliases:m.aliases,content:m.content,attributes:{model:m.attributes.model,canonicalName:m.attributes.canonicalName,category:m.attributes.category,merchant:m.attributes.merchant,brand:m.attributes.brand,specification:m.attributes.specification,scope:m.attributes.scope,match:m.attributes.match}}),signal,cfg.version);
 await db.query('INSERT INTO memory_vectors(memory_id,model_version,content_version,dimensions,embedding) SELECT $1,$2,$3,$4,$5 WHERE EXISTS(SELECT 1 FROM memories WHERE id=$1 AND version=$3 AND status<>\'forgotten\') ON CONFLICT(memory_id,model_version) DO UPDATE SET content_version=$3,dimensions=$4,embedding=$5',[id,v.version,m.version,v.dimensions,v.value]);
}
async function learnSource(user:string,type:string,id:string,progress:ModelProgress){
 if(type==='memory'){await vectorize(id,progress.signal);return;}
 let candidates:{value:MemoryInput;itemId:string;explicit:boolean;memoryId?:string}[]=[],version=0;
 if(type==='transaction'){
  const t=(await db.query('SELECT t.* FROM transactions t JOIN members b ON b.book_id=t.book_id AND b.user_id=$2 WHERE t.id=$1 AND t.created_by=$2 AND NOT t.deleted AND t.kind=\'expense\'',[id,user])).rows[0];
  if(t){version=t.version;
   candidates=memoryProducts({...t,lineItems:t.line_items}).map(i=>({itemId:i.itemId||'',explicit:false,memoryId:(t.memory_suggestions||[]).find((s:any)=>s.status==='matched'&&normMemory(s.fields?.originalName||'')===normMemory(i.name)&&(s.itemId===i.itemId||!s.itemId&&!i.itemId))?.id,value:memoryInput.parse({kind:'product',title:i.name,attributes:{category:t.category,merchant:t.payee,platform:t.platform||undefined}})}));
   if((await db.query("SELECT 1 FROM memory_models WHERE role='extraction'")).rowCount){
    for(let offset=0;offset<candidates.length;offset+=10){
     const batch=candidates.slice(offset,offset+10),key='products:'+id+':'+version+':'+offset;
     const facts=await progress.checkpoint?.get(key)||await extractProductFacts(batch.map(c=>({name:c.value.title,merchant:t.payee})),progress.signal);
     await progress.checkpoint?.set(key,facts);
     batch.forEach((candidate,index)=>{const f=facts[index]||{};candidate.value.attributes={...candidate.value.attributes,platform:t.platform||undefined,canonicalName:f.name,brand:f.brand,specification:f.specification,model:f.model,quotes:f.quotes};});
    }
   }
  }
 }else if(type==='turn'){
  const t=(await db.query("SELECT t.question FROM finance_turns t JOIN finance_conversations c ON c.id=t.conversation_id JOIN members b ON b.book_id=c.book_id AND b.user_id=$2 WHERE t.id=$1 AND c.user_id=$2 AND t.status='complete'",[id,user])).rows[0];
  if(t){
   const cached=await progress.checkpoint?.get('extract:'+id);
   const result=cached|| (await memoryModel('extraction',JSON.stringify({task:'Extract explicit financial preferences only from user text. Ignore questions, hypothetical statements and instructions unrelated to financial memory. Return {memories:[{kind:"preference|subscription|activity|conversation|todo",title,content,aliases:[],attributes:{category?:string,match?:string,scope?:"product|merchant"},quote:string}]}. Do not include balances, payments, account numbers, IDs or inferred future actions.',text:t.question}),progress.signal)).value;
   if(!cached)await progress.checkpoint?.set('extract:'+id,result);
   candidates=(Array.isArray(result.memories)?result.memories:[]).slice(0,20).filter((v:any)=>typeof v.quote==='string'&&v.quote.length>=4&&t.question.includes(v.quote)).map((v:any)=>({value:memoryInput.parse(v),itemId:'',explicit:/(记住|remember)/i.test(t.question)&&!/[?？]|如果|假设/.test(t.question)}));
  }
 }
 const ids=await transaction(async c=>{
  // Serialize learning for one owner to avoid duplicate product creation in parallel jobs.
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);
  const previous=(await c.query('SELECT memory_id,item_id,source_text FROM memory_sources WHERE source_type=$1 AND source_id=$2 AND memory_id IN(SELECT id FROM memories WHERE owner_id=$3)',[type,id,user])).rows;
  await c.query('DELETE FROM memory_sources WHERE source_type=$1 AND source_id=$2 AND memory_id IN(SELECT id FROM memories WHERE owner_id=$3)',[type,id,user]);
  const learned:string[]=[];
  for(const candidate of candidates){
   if((await c.query('SELECT 1 FROM memory_exclusions WHERE user_id=$1 AND source_type=$2 AND source_id=$3 AND item_id=$4',[user,type,id,candidate.itemId])).rowCount)continue;
   const v=candidate.value;
   const chosenId=previous.find(p=>p.item_id===candidate.itemId&&p.source_text===v.title)?.memory_id||candidate.memoryId;
   const excluded=(await c.query("SELECT attributes->>'targetId' AS id FROM memories WHERE owner_id=$1 AND kind='negative' AND status='active' AND title=$2",[user,normMemory(v.title)])).rows.map(r=>r.id);
   const chosen=chosenId&&!excluded.includes(chosenId)?(await c.query("SELECT * FROM memories WHERE id=$1 AND owner_id=$2 AND family_id IS NULL AND kind='product' AND status='active'",[chosenId,user])).rows[0]:null;
   const old=chosen||(await c.query("SELECT * FROM memories WHERE owner_id=$1 AND family_id IS NULL AND kind=$2 AND title=$3 AND COALESCE(attributes->>'merchant','')=$4 AND status<>'forgotten' AND NOT(id=ANY($5::uuid[])) ORDER BY created_at LIMIT 1",[user,v.kind,v.title,v.attributes.merchant||'',excluded])).rows[0];
   const memoryId=old?.id||randomUUID();
   if(!old)await c.query('INSERT INTO memories(id,owner_id,kind,title,content,attributes,aliases,status,explicit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[memoryId,user,v.kind,v.title,v.content,v.attributes,JSON.stringify(v.aliases),type==='transaction'||candidate.explicit?'active':'pending',candidate.explicit]);
   
   await c.query('INSERT INTO memory_sources(memory_id,source_type,source_id,item_id,source_version,source_text) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[memoryId,type,id,candidate.itemId,version,v.title]);learned.push(memoryId);
   if(!old?.explicit&&type==='transaction'){
    await c.query("UPDATE memories SET attributes=attributes||$2::jsonb,version=version+1,updated_at=now() WHERE id=$1 AND attributes IS DISTINCT FROM attributes||$2::jsonb",[memoryId,JSON.stringify(v.attributes)]);
   }
  }
  const affected=[...new Set([...learned,...previous.map(p=>p.memory_id)])];
  for(const memoryId of affected){
   const latest=(await c.query("SELECT t.category,t.payee,t.platform FROM memory_sources s JOIN transactions t ON t.id=s.source_id AND s.source_type='transaction' JOIN members b ON b.book_id=t.book_id AND b.user_id=$2 WHERE s.memory_id=$1 AND NOT t.deleted AND t.version=s.source_version ORDER BY COALESCE(t.updated_at,t.created_at) DESC,t.id DESC LIMIT 1",[memoryId,user])).rows[0];
   if(latest)await c.query("UPDATE memories SET attributes=attributes||$2::jsonb,status='active',version=version+1,updated_at=now() WHERE id=$1 AND NOT explicit AND (status='disabled' OR attributes IS DISTINCT FROM attributes||$2::jsonb)",[memoryId,JSON.stringify({category:latest.category,merchant:latest.payee,platform:latest.platform||''})]);
   else await c.query("UPDATE memories SET status='disabled',version=version+1 WHERE id=$1 AND NOT explicit AND status<>'disabled' AND NOT EXISTS(SELECT 1 FROM memory_sources WHERE memory_id=$1)",[memoryId]);
  }
  return affected;
 });
 for(const memoryId of ids){progress.signal?.throwIfAborted();await vectorize(memoryId,progress.signal);}
}
export async function runMemoryJob(user:string,payload:any,progress:ModelProgress){
 await ensureMemoryModels();
 if(!await memoryEnabled(user))throw new Error('记忆学习已暂停，开启后可在任务列表重试续跑');
 if(payload.operation==='source'){await learnSource(user,payload.sourceType,payload.sourceId,progress);const cfg=(await db.query("SELECT version FROM memory_models WHERE role='embedding'")).rows[0];if(cfg)await activateReadyIndex(user,cfg.version);return {ok:true};}
 let cursor=await progress.checkpoint?.get('cursor')||'';let count=Number(await progress.checkpoint?.get('count')||0);
 const embeddingVersion=await progress.checkpoint?.get('embeddingVersion')||(await db.query("SELECT version FROM memory_models WHERE role='embedding'")).rows[0]?.version;
 if(embeddingVersion)await progress.checkpoint?.set('embeddingVersion',embeddingVersion);
 for(;;){
  progress.signal?.throwIfAborted();
  const rows=payload.operation==='rebuild'?(await db.query("SELECT id::text AS key,'memory' AS type,id FROM memories WHERE owner_id=$1 AND status<>'forgotten' AND id::text>$2 ORDER BY id::text LIMIT 20",[user,cursor])).rows:
   (await db.query(`SELECT * FROM (
    SELECT 'transaction:'||t.id AS key,'transaction' AS type,t.id FROM transactions t JOIN members b ON b.book_id=t.book_id AND b.user_id=$1 WHERE t.created_by=$1 AND NOT t.deleted
    UNION ALL SELECT 'turn:'||t.id AS key,'turn' AS type,t.id FROM finance_turns t JOIN finance_conversations c ON c.id=t.conversation_id JOIN members b ON b.book_id=c.book_id AND b.user_id=$1 WHERE c.user_id=$1 AND t.status='complete'
   ) sources WHERE key>$2 ORDER BY key LIMIT 20`,[user,cursor])).rows;
  if(!rows.length)break;
  for(const row of rows){progress.signal?.throwIfAborted();if(!await memoryEnabled(user))throw new Error('记忆学习已暂停，开启后可重试续跑');if(payload.operation==='rebuild')await vectorize(row.id,progress.signal,embeddingVersion);else await learnSource(user,row.type,row.id,progress);cursor=row.key;count++;await progress.checkpoint?.set('cursor',cursor);await progress.checkpoint?.set('count',count);progress.onStage?.('已整理 '+count+' 条来源');}
 }
 if(embeddingVersion){
  const missing=(await db.query("SELECT 1 FROM memories m WHERE owner_id=$1 AND status<>'forgotten' AND NOT EXISTS(SELECT 1 FROM memory_vectors v WHERE v.memory_id=m.id AND v.model_version=$2 AND v.content_version=m.version) LIMIT 1",[user,embeddingVersion])).rowCount;
  if(!missing)await db.query('INSERT INTO memory_embedding_active VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET version=$2',[user,embeddingVersion]);
 }
 return {count};
}
async function activateReadyIndex(user:string,version:number){
 await db.query("INSERT INTO memory_embedding_active(user_id,version) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM memories m WHERE m.owner_id=$1 AND m.status<>'forgotten' AND NOT EXISTS(SELECT 1 FROM memory_vectors v WHERE v.memory_id=m.id AND v.model_version=$2 AND v.content_version=m.version)) ON CONFLICT(user_id) DO UPDATE SET version=$2",[user,version]);
}
