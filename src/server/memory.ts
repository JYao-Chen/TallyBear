import {extractProductFacts,judgeProducts} from './memory-intelligence';
import {planMemoryFill} from '@/lib/memory-fields';
import {memoryProducts} from '@/lib/memory-products';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db';
import {Failure,type User} from './access';
import {enqueue} from './jobs';
import {memoryModel,memoryModelSettings} from './memory-models';
import {exactMemory,memoryInput,normMemory,rankFusion,specConflict,type Memory,type MemorySuggestion} from '@/lib/memory';
import type {CategoryInput} from '@/lib/category-learning';
import type {PoolClient} from 'pg';
import {listCategories} from './categories';

// Scope is enforced before text/vector retrieval, not after returning a top-k list.
export const memoryVisibility=`((m.owner_id=$1 AND m.family_id IS NULL) OR (m.family_id IS NOT NULL AND EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=m.family_id AND fm.user_id=$1)))
 AND (m.explicit OR EXISTS(SELECT 1 FROM memory_sources s WHERE s.memory_id=m.id AND (
  (s.source_type='transaction' AND EXISTS(SELECT 1 FROM transactions t JOIN members b ON b.book_id=t.book_id AND b.user_id=$1 WHERE t.id=s.source_id AND NOT t.deleted AND t.version=s.source_version)) OR
  (s.source_type='turn' AND EXISTS(SELECT 1 FROM finance_turns t JOIN finance_conversations c ON c.id=t.conversation_id JOIN members b ON b.book_id=c.book_id AND b.user_id=$1 WHERE t.id=s.source_id AND c.user_id=$1 AND t.status='complete')))))`;
const visibility=memoryVisibility;
export async function memoryEnabled(user:string){return (await db.query('SELECT enabled FROM memory_settings WHERE user_id=$1',[user])).rows[0]?.enabled!==false;}
export async function searchMemories(user:string,query:string,kind?:string,semantic=true,signal?:AbortSignal):Promise<Memory[]>{
 const args=[user,'%'+query.replace(/[\\%_]/g,'\\$&')+'%',kind||null];
 const lexical=(await db.query(`SELECT m.* FROM memories m WHERE ${visibility} AND m.status='active' AND ($3::text IS NULL OR m.kind=$3) AND (m.title ILIKE $2 OR m.aliases::text ILIKE $2 OR m.content ILIKE $2) ORDER BY (lower(m.title)=lower(substring($2,2,length($2)-2))) DESC,m.updated_at DESC LIMIT 20`,args)).rows;
 if(!semantic||!query||lexical.some(m=>exactMemory(query,'',m)))return lexical;
 try{
  const active=(await db.query('SELECT version FROM memory_embedding_active WHERE user_id=$1',[user])).rows[0];
  if(!active)return lexical;
  const embedded=await memoryModel('embedding',query,signal,active.version);
  const vector=(await db.query(`SELECT m.* FROM memories m JOIN memory_vectors v ON v.memory_id=m.id AND v.content_version=m.version WHERE ${visibility} AND m.status='active' AND ($3::text IS NULL OR m.kind=$3) AND v.model_version=$4 AND v.dimensions=$5 ORDER BY v.embedding::vector <=> $2::vector LIMIT 20`,[user,JSON.stringify(embedded.value),kind||null,embedded.version,embedded.dimensions])).rows;
  return rankFusion([lexical,vector]);
 }catch{return lexical;}
}
export async function suggestMemory(user:string,input:CategoryInput,signal?:AbortSignal):Promise<MemorySuggestion[]>{
 if(input.kind!=='expense'||!await memoryEnabled(user))return [];
 const items=memoryProducts(input);
 const result:MemorySuggestion[]=[];
 const budget=AbortSignal.any([AbortSignal.timeout(12000),...(signal?[signal]:[])]);
 async function inspect(item:typeof items[number]){
  if(!item.name)return;
  signal?.throwIfAborted();
  const negatives=(await db.query("SELECT attributes->>'targetId' AS id FROM memories WHERE owner_id=$1 AND kind='negative' AND status='active' AND title=$2",[user,normMemory(item.name)])).rows.map(r=>r.id);
  const found=(await searchMemories(user,item.name,'product',!budget.aborted,budget)).filter(m=>!negatives.includes(m.id)&&!specConflict(item.name,m.title+' '+(m.attributes.specification||''))).slice(0,8);
  const exact=found.filter(m=>exactMemory(item.name,input.payee,m)&&normMemory(item.name)!==normMemory(input.payee));let matched=exact.length===1?exact[0].id:'';
  let decisions:{id:string;relation:string;reason:string}[]=[];
  if(!matched&&found.length&&!budget.aborted){
   try{
    const facts=(await extractProductFacts([{name:item.name,merchant:input.payee}],budget))[0];
    decisions=await judgeProducts({name:item.name,merchant:input.payee,facts},found,budget);
    const same=decisions.filter(d=>d.relation==='same');if(same.length===1)matched=same[0].id;
   }catch{/* Keep ambiguous candidates editable when an optional model is unavailable. */}
  }
  for(const m of [...found].sort((a,b)=>Number(b.id===matched)-Number(a.id===matched)).slice(0,3)){
   const sources=m.owner_id===user&&!m.family_id?(await db.query("SELECT s.source_type AS type,s.source_id AS id,s.item_id AS \"itemId\" FROM memory_sources s WHERE s.memory_id=$1 AND s.source_type='transaction' AND EXISTS(SELECT 1 FROM transactions t JOIN members b ON b.book_id=t.book_id AND b.user_id=$2 WHERE t.id=s.source_id AND NOT t.deleted AND t.version=s.source_version) LIMIT 5",[m.id,user])).rows:[];
   result.push({id:m.id,title:m.title,itemId:item.itemId,status:matched===m.id?'matched':'candidate',reason:decisions.find(d=>d.id===m.id)?.reason||(matched===m.id?'商品信息与历史记忆一致':'相似商品，请核对规格'),conflicts:decisions.find(d=>d.id===m.id)?.relation==='different_spec'?['规格不同，不自动关联']:[],fieldChanges:[],fields:{originalName:item.name,product:m.title,...(!item.itemId?{title:m.attributes.canonicalName||m.title}:{}),...(m.attributes.merchant?{payee:m.attributes.merchant}:{}),...(m.attributes.platform?{platform:m.attributes.platform}:{}),...(m.attributes.category?{category:m.attributes.category}:{})},sources});
  }
 }
 for(let offset=0;offset<items.length;offset+=3){signal?.throwIfAborted();await Promise.all(items.slice(offset,offset+3).map(inspect));}
 return result.sort((a,b)=>items.findIndex(i=>i.itemId===a.itemId)-items.findIndex(i=>i.itemId===b.itemId));
}
export async function applyMemory<T extends CategoryInput>(user:string,input:T,signal?:AbortSignal):Promise<T&{memorySuggestions?:MemorySuggestion[]}>{
 if(!await memoryEnabled(user))return input;
 const suggestions=await suggestMemory(user,input,signal);
 const products=memoryProducts(input);
 if(products.length>1&&new Set(suggestions.filter(s=>s.status==='matched').map(s=>s.itemId)).size!==products.length)for(const s of suggestions)if(s.fields.category)s.conflicts.push('还有明细尚未明确关联，整单分类需核对');
 const rules=(await db.query(`SELECT m.* FROM memories m WHERE ${visibility} AND m.kind='preference' AND m.status='active' AND m.explicit`,[user])).rows as Memory[];
 const applicable=rules.filter(m=>{const a=m.attributes;const clue=a.scope==='merchant'?input.payee:input.product||input.scene?.summary||'';return !!a.match&&normMemory(a.match)===normMemory(clue)&&!!a.category;});
 const personal=applicable.filter(m=>m.owner_id===user&&!m.family_id),preferred=personal.length?personal:applicable;
 if(preferred.length){
  for(const s of suggestions)delete s.fields.category;
  const categories=new Set(preferred.map(m=>m.attributes.category));
  for(const m of preferred)suggestions.push({id:m.id,title:m.title,status:categories.size===1?'matched':'candidate',reason:'用户明确分类规则',conflicts:categories.size>1?['同一场景存在不同分类规则，请选择，本次不会自动覆盖']:[],fieldChanges:[],fields:{category:m.attributes.category!,originalName:input.product||input.payee},sources:[]});
 }
 const valid=new Set((await listCategories(user)).filter(c=>!c.archived).map(c=>c.name));
 for(const s of suggestions)if(s.fields.category&&!valid.has(s.fields.category)){s.conflicts.push('此分类不在你的有效分类中');delete s.fields.category;}
 const filled=planMemoryFill(input,suggestions);
 return {...filled.value,memorySuggestions:filled.suggestions};
}
async function purchaseStats(user:string,id:string){
 return (await db.query(`WITH facts AS (
 SELECT DISTINCT ON(COALESCE(t.event_id,t.id),s.item_id) COALESCE(t.event_id,t.id) AS payment,s.item_id,
 CASE WHEN s.item_id='' THEN t.amount ELSE (SELECT (i->>'amount')::bigint FROM jsonb_array_elements(t.line_items) i WHERE i->>'id'=s.item_id LIMIT 1) END AS amount
 FROM memory_sources s JOIN transactions t ON t.id=s.source_id AND s.source_type='transaction' JOIN members b ON b.book_id=t.book_id AND b.user_id=$1
 WHERE s.memory_id=$2 AND NOT t.deleted AND t.version=s.source_version AND t.kind='expense'
 ORDER BY COALESCE(t.event_id,t.id),s.item_id,t.created_at DESC)
 SELECT count(DISTINCT payment)::int AS purchases,COALESCE(sum(amount),0)::float8 AS known_amount,count(*) FILTER(WHERE amount IS NULL)::int AS unknown_amounts FROM facts`,[user,id])).rows[0];
}
async function owned(user:string,id:string,c=db){const m=(await c.query('SELECT * FROM memories m WHERE id=$1 AND owner_id=$2 AND (family_id IS NULL OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=m.family_id AND f.user_id=$2))',[id,user])).rows[0];if(!m)throw new Failure('记忆不存在',404);return m as Memory;}
async function memoryTargets(user:string,type:string,q:string,page=1){
 const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
 if(type==='activity')return (await db.query("SELECT id,name FROM activities a WHERE NOT archived AND (owner_id=$1 OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=a.family_id AND f.user_id=$1)) AND name ILIKE $2 ORDER BY name,id LIMIT 20 OFFSET $3",[user,pattern,(page-1)*20])).rows;
 const table=type==='schedule'?'bill_schedules':'entry_templates';
 return (await db.query(`SELECT id,name FROM ${table} s WHERE user_id=$1 AND EXISTS(SELECT 1 FROM members b WHERE b.book_id=s.book_id AND b.user_id=$1) AND name ILIKE $2 ORDER BY name,id LIMIT 20 OFFSET $3`,[user,pattern,(page-1)*20])).rows;
}
async function checkReference(user:string,value:z.infer<typeof memoryInput>){
 const {targetId,targetType}=value.attributes;if(!targetId)return;if(!targetType)throw new Failure('请选择关联对象类型');
 const allowed=targetType==='activity'?(await db.query('SELECT 1 FROM activities a WHERE id=$2 AND (owner_id=$1 OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=a.family_id AND f.user_id=$1))',[user,targetId])).rowCount:
 (await db.query(`SELECT 1 FROM ${targetType==='schedule'?'bill_schedules':'entry_templates'} s WHERE id=$2 AND user_id=$1 AND EXISTS(SELECT 1 FROM members b WHERE b.book_id=s.book_id AND b.user_id=$1)`,[user,targetId])).rowCount;
 if(!allowed)throw new Failure('关联对象不可访问',403);
}
export async function prepareMemoryChange(user:string,body:unknown){
 const b=z.object({operation:z.enum(['save','status','forget','share']),id:z.string().uuid().optional()}).passthrough().parse(body);
 if(b.id){const m=await owned(user,b.id);return {...b,...(b.operation==='save'?memoryInput.parse({...m,...b}):{title:m.title}),version:m.version};}
 if(b.operation!=='save')throw new Failure('请选择记忆');return {...memoryInput.parse(body),operation:'save'};
}
export async function memoryRoute(user:User,method:string,params:URLSearchParams,body:any,connection?:PoolClient){
 if(params.get('admin')==='models')return memoryModelSettings(user,method,body);
 if(method==='GET'){
  if(params.has('targets'))return {items:await memoryTargets(user.id,z.enum(['activity','schedule','template']).parse(params.get('targets')),params.get('q')||'',z.coerce.number().int().min(1).parse(params.get('page')||1))};
  if(params.has('settings'))return {enabled:await memoryEnabled(user.id)};
  if(params.has('search'))return {items:await searchMemories(user.id,params.get('search')||'',params.get('kind')||undefined)};
  if(params.has('events'))return {items:(await db.query('SELECT id,memory_id,operation,created_at FROM memory_events WHERE user_id=$1 ORDER BY id DESC LIMIT 20 OFFSET $2',[user.id,Math.max(0,Number(params.get('page')||1)-1)*20])).rows};
  const id=params.get('id');if(id){z.string().uuid().parse(id);const m=(await db.query(`SELECT m.* FROM memories m WHERE m.id=$2 AND ${visibility}`, [user.id,id])).rows[0];if(!m)throw new Failure('记忆不可访问',404);
   const sources=m.owner_id===user.id&&!m.family_id?(await db.query(`SELECT s.*,t.title,t.category,t.amount::float8 AS amount,t.date,t.line_items FROM memory_sources s LEFT JOIN transactions t ON s.source_type='transaction' AND t.id=s.source_id AND NOT t.deleted AND t.version=s.source_version AND EXISTS(SELECT 1 FROM members b WHERE b.book_id=t.book_id AND b.user_id=$2) WHERE s.memory_id=$1 AND (s.source_type<>'transaction' OR t.id IS NOT NULL) ORDER BY t.date DESC NULLS LAST LIMIT 20 OFFSET $3`,[id,user.id,Math.max(0,Number(params.get('page')||1)-1)*20])).rows:[];return {memory:m,sources,stats:m.owner_id===user.id&&!m.family_id?await purchaseStats(user.id,id):null};}
  const page=z.coerce.number().int().min(1).parse(params.get('page')||1),status=params.get('status')||'active',kind=params.get('kind')||null,q='%'+(params.get('q')||'').replace(/[\\%_]/g,'\\$&')+'%';
  const where=`${visibility} AND m.status=$2 AND ($3::text IS NULL OR m.kind=$3) AND (m.title ILIKE $4 OR m.content ILIKE $4)`;
  const total=Number((await db.query(`SELECT count(*) FROM memories m WHERE ${where}`,[user.id,status,kind,q])).rows[0].count);
  const items=(await db.query(`SELECT m.* FROM memories m WHERE ${where} ORDER BY m.updated_at DESC,m.id LIMIT 20 OFFSET $5`,[user.id,status,kind,q,(page-1)*20])).rows;return {items,total,page};
 }
 const op=z.enum(['save','status','forget','share','merge','split','reject','learn','settings','history','rebuild','undo','export']).parse(body.operation);
 if(op==='export')return {items:(await db.query("SELECT * FROM memories WHERE owner_id=$1 AND status<>'forgotten'",[user.id])).rows};
 if(op==='settings'){const enabled=z.boolean().parse(body.enabled);await db.query('INSERT INTO memory_settings VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET enabled=$2',[user.id,enabled]);return {ok:true};}
 if(op==='history'||op==='rebuild')return {jobId:await enqueue(user,null,'memory',{operation:op})};
 if(op==='learn'){await db.query('DELETE FROM memory_exclusions WHERE user_id=$1',[user.id]);return {jobId:await enqueue(user,null,'memory',{operation:'history'})};}
 if(op==='reject'){
  const target=z.string().uuid().parse(body.targetId);const visible=await db.query(`SELECT m.id FROM memories m WHERE m.id=$2 AND ${visibility}`,[user.id,target]);if(!visible.rowCount)throw new Failure('记忆不可访问',404);
  const name=normMemory(z.string().min(1).max(160).parse(body.name));await db.query("INSERT INTO memories(id,owner_id,kind,title,attributes,status,explicit) VALUES($1,$2,'negative',$3,$4,'active',true)",[randomUUID(),user.id,name,{targetId:target}]);return {ok:true};
 }
 return transaction(async c=>{
  if(op==='save'&&!body.id){const value=memoryInput.parse(body);await checkReference(user.id,value);const id=randomUUID();const pending=await resolveRuleConflicts(c,user.id,undefined,value,body.replaceConflicts===true);await c.query("INSERT INTO memories(id,owner_id,kind,title,content,attributes,aliases,status,explicit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)",[id,user.id,value.kind,value.title,value.content,value.attributes,JSON.stringify(value.aliases),pending?'pending':'active']);await c.query("INSERT INTO memory_outbox(user_id,source_type,source_id) VALUES($1,'memory',$2) ON CONFLICT DO NOTHING",[user.id,id]);return {id,pending};}
  if(op==='undo'){
   const event=(await c.query('SELECT * FROM memory_events WHERE id=$1 AND user_id=$2 FOR UPDATE',[z.coerce.number().int().positive().parse(body.eventId),user.id])).rows[0];if(!event?.previous||!['save','status'].includes(event.operation))throw new Failure('此操作不能撤销');const m=await owned(user.id,event.memory_id,c as any);if(m.version!==event.previous.version+1)throw new Failure('记忆已有后续变更，不能直接撤销',409);const p=event.previous;
   await c.query('UPDATE memories SET title=$2,content=$3,attributes=$4,aliases=$5,status=$6,explicit=$7,version=version+1,updated_at=now() WHERE id=$1',[m.id,p.title,p.content,p.attributes,JSON.stringify(p.aliases),p.status,p.explicit]);await c.query("INSERT INTO memory_events(user_id,memory_id,operation) VALUES($1,$2,'undo')",[user.id,m.id]);await queueVector(c,user.id,m.id);return {ok:true};
  }
  const id=z.string().uuid().parse(body.id);await c.query('SELECT id FROM memories WHERE id=$1 FOR UPDATE',[id]);const m=await owned(user.id,id,c as any);if(m.status==='forgotten')throw new Failure('记忆已遗忘');if(body.version!==m.version)throw new Failure('记忆已变化，请刷新',409);
  await c.query('INSERT INTO memory_events(user_id,memory_id,operation,previous) VALUES($1,$2,$3,$4)',[user.id,id,op,op==='forget'?null:m]);
  if(op==='forget'){
   await c.query('INSERT INTO memory_exclusions SELECT $1,source_type,source_id,item_id FROM memory_sources WHERE memory_id=$2 ON CONFLICT DO NOTHING',[user.id,id]);
   await c.query('DELETE FROM memory_vectors WHERE memory_id=$1',[id]);await c.query('DELETE FROM memory_sources WHERE memory_id=$1',[id]);await c.query('UPDATE memory_events SET previous=NULL WHERE memory_id=$1',[id]);
   await c.query("UPDATE memories SET title='',content='',attributes='{}',aliases='[]',status='forgotten',version=version+1,updated_at=now() WHERE id=$1",[id]);return {ok:true};
  }
  if(op==='share'){
   const family=z.string().uuid().parse(body.familyId);if(!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[family,user.id])).rowCount)throw new Failure('没有家庭权限',403);
   // Sharing requires a separately reviewed description, not a copy of private evidence.
   const v=memoryInput.parse(body.shared);delete v.attributes.targetId;delete v.attributes.targetType;const sharedId=randomUUID();await c.query("INSERT INTO memories(id,owner_id,family_id,kind,title,content,aliases,attributes,status,explicit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',true)",[sharedId,user.id,family,v.kind,v.title,v.content,JSON.stringify(v.aliases),v.attributes]);await queueVector(c,user.id,sharedId);return {id:sharedId};
  }
  if(op==='merge'){
   const otherId=z.string().uuid().parse(body.targetId);if(otherId===id)throw new Failure('不能合并自身');const other=await owned(user.id,otherId,c as any);if(m.kind!=='product'||other.kind!=='product'||other.status==='forgotten'||m.family_id||other.family_id)throw new Failure('只能合并个人商品');
   await c.query('INSERT INTO memory_sources(memory_id,source_type,source_id,item_id,source_version,source_text) SELECT $2,source_type,source_id,item_id,source_version,source_text FROM memory_sources WHERE memory_id=$1 ON CONFLICT DO NOTHING',[id,otherId]);await c.query('DELETE FROM memory_sources WHERE memory_id=$1',[id]);await c.query("UPDATE memories SET status='disabled',version=version+1 WHERE id=$1",[id]);await c.query('UPDATE memories SET aliases=$2,version=version+1,updated_at=now() WHERE id=$1',[otherId,JSON.stringify([...new Set([...other.aliases,m.title,...m.aliases])].slice(0,40))]);await queueVector(c,user.id,otherId);return {id:otherId};
  }
  if(op==='split'){
   if(m.kind!=='product'||m.family_id)throw new Failure('只能拆分个人商品');
   const sourceId=z.string().uuid().parse(body.sourceId),itemId=z.string().parse(body.itemId||''),v=memoryInput.parse(body.value),newId=randomUUID();if(!(await c.query('SELECT 1 FROM memory_sources WHERE memory_id=$1 AND source_id=$2 AND item_id=$3',[id,sourceId,itemId])).rowCount)throw new Failure('来源不存在');
   await c.query("INSERT INTO memories(id,owner_id,kind,title,content,aliases,attributes,status,explicit) VALUES($1,$2,'product',$3,$4,$5,$6,'active',true)",[newId,user.id,v.title,v.content,JSON.stringify(v.aliases),v.attributes]);await c.query('UPDATE memory_sources SET memory_id=$4 WHERE memory_id=$1 AND source_id=$2 AND item_id=$3',[id,sourceId,itemId,newId]);await c.query('UPDATE memories SET version=version+1,updated_at=now() WHERE id=$1',[id]);await queueVector(c,user.id,id);await queueVector(c,user.id,newId);return {id:newId};
  }
  let pending=false;
  if(op==='status'){let status=z.enum(['active','disabled','pending']).parse(body.status);if(status==='active'){pending=m.family_id?false:await resolveRuleConflicts(c,user.id,id,m,body.replaceConflicts===true);if(pending)status='pending';}await c.query('UPDATE memories SET status=$2,explicit=true,version=version+1,updated_at=now() WHERE id=$1',[id,status]);}
  if(op==='save'){const v=memoryInput.parse(body);await checkReference(user.id,v);pending=m.family_id?false:await resolveRuleConflicts(c,user.id,id,v,body.replaceConflicts===true);await c.query('UPDATE memories SET status=$2 WHERE id=$1',[id,pending?'pending':'active']);await c.query('UPDATE memories SET title=$2,content=$3,aliases=$4,attributes=$5,explicit=true,version=version+1,updated_at=now() WHERE id=$1',[id,v.title,v.content,JSON.stringify(v.aliases),v.attributes]);}
  await c.query("INSERT INTO memory_outbox(user_id,source_type,source_id) VALUES($1,'memory',$2) ON CONFLICT DO NOTHING",[user.id,id]);return {ok:true,pending};
 },connection);
}

async function queueVector(c:PoolClient,user:string,id:string){await c.query("INSERT INTO memory_outbox(user_id,source_type,source_id) VALUES($1,'memory',$2) ON CONFLICT DO NOTHING",[user,id]);}

async function resolveRuleConflicts(c:PoolClient,user:string,id:string|undefined,value:z.infer<typeof memoryInput>,replace:boolean){
 if(value.kind!=='preference'||!value.attributes.match||!value.attributes.category)return false;
 const others=(await c.query("SELECT * FROM memories WHERE owner_id=$1 AND family_id IS NULL AND kind='preference' AND status='active' FOR UPDATE",[user])).rows as Memory[];
 const conflicting=others.filter(m=>m.id!==id&&(m.attributes.scope||'product')===(value.attributes.scope||'product')&&normMemory(m.attributes.match||'')===normMemory(value.attributes.match!)&&m.attributes.category!==value.attributes.category);
 if(!replace)return conflicting.length>0;
 for(const m of conflicting){await c.query("INSERT INTO memory_events(user_id,memory_id,operation,previous) VALUES($1,$2,'status',$3)",[user,m.id,m]);await c.query("UPDATE memories SET status='disabled',version=version+1,updated_at=now() WHERE id=$1",[m.id]);}
 return false;
}
