import {randomUUID} from 'node:crypto';
import {db,transaction} from './db';
import {ensureMemoryModels,memoryModel} from './memory-models';
import {helpArticles,helpText,helpKeywordScore,cosineSimilarity,type HelpArticle} from '@/lib/help-manual';
import type {Language} from '@/lib/i18n';
import type {ModelProgress} from './ai';

export async function syncHelp(){
 await transaction(async c=>{for(const locale of ['zh-CN','en'] as const){
  const articles=helpArticles(locale);
  for(const a of articles)await c.query(`INSERT INTO help_articles(id,locale,article,content) VALUES($1,$2,$3,$4)
   ON CONFLICT(id,locale) DO UPDATE SET article=$3,content=$4,version=help_articles.version+1 WHERE help_articles.article IS DISTINCT FROM $3::jsonb`,[a.id,locale,a,helpText(a)]);
  await c.query('DELETE FROM help_articles WHERE locale=$1 AND NOT(id=ANY($2::text[]))',[locale,articles.map(a=>a.id)]);
 }});
}
export async function prepareHelp(user:string){
 await syncHelp();await ensureMemoryModels();
 const model=(await db.query("SELECT version FROM memory_models WHERE role='embedding'")).rows[0];if(!model)return {state:'unconfigured'};
 const missing=(await db.query('SELECT 1 FROM help_articles a WHERE NOT EXISTS(SELECT 1 FROM help_vectors v WHERE v.article_id=a.id AND v.locale=a.locale AND v.content_version=a.version AND v.model_version=$1) LIMIT 1',[model.version])).rowCount;
 if(!missing)return {state:'ready'};
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(301617)');
  // Global documentation is indexed once, independently of personal memory learning.
  await c.query(`INSERT INTO ai_jobs(id,user_id,kind,payload) SELECT $1,$2,'memory',$3 WHERE NOT EXISTS(
   SELECT 1 FROM ai_jobs WHERE kind='memory' AND payload->>'operation'='help-index' AND
   (status IN ('queued','running') OR (status='error' AND finished_at>now()-interval '5 minutes')))`,[randomUUID(),user,{operation:'help-index',modelVersion:model.version}]);
 });
 return {state:'indexing'};
}
export async function indexHelp(payload:{modelVersion:number},progress:ModelProgress){
 await syncHelp();
 const rows=(await db.query(`SELECT a.* FROM help_articles a WHERE NOT EXISTS(SELECT 1 FROM help_vectors v WHERE v.article_id=a.id AND v.locale=a.locale AND v.content_version=a.version AND v.model_version=$1) ORDER BY locale,id`,[payload.modelVersion])).rows;
 let count=0;
 for(const a of rows){
  progress.signal?.throwIfAborted();progress.onStage?.(`Indexing help ${++count}/${rows.length}`);
  const v=await memoryModel('embedding',a.content,progress.signal,payload.modelVersion);
  await db.query(`INSERT INTO help_vectors(article_id,locale,content_version,model_version,dimensions,embedding)
   SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS(SELECT 1 FROM help_articles WHERE id=$1 AND locale=$2 AND version=$3)
   ON CONFLICT(article_id,locale,model_version) DO UPDATE SET content_version=$3,dimensions=$5,embedding=$6`,[a.id,a.locale,a.version,v.version,v.dimensions,v.value]);
 }
 return {ok:true,articles:count};
}
export async function searchHelp(user:string,query:string,locale:Language,signal?:AbortSignal){
 const status=await prepareHelp(user);
 const rows=(await db.query('SELECT * FROM help_articles WHERE locale=$1 ORDER BY id',[locale])).rows;
 const keyword=rows.map(r=>({id:r.id,score:helpKeywordScore(r.article,query)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
 let semantic:{id:string;score:number}[]=[],mode='keyword';
 if(query.trim()&&status.state!=='unconfigured')try{
  const cfg=(await db.query("SELECT version FROM memory_models WHERE role='embedding'")).rows[0];
  const vectors=(await db.query(`SELECT v.* FROM help_vectors v JOIN help_articles a ON a.id=v.article_id AND a.locale=v.locale AND a.version=v.content_version WHERE v.locale=$1 AND v.model_version=$2`,[locale,cfg.version])).rows;
  if(vectors.length){
   const v=await memoryModel('embedding',query,AbortSignal.any([AbortSignal.timeout(5000),...(signal?[signal]:[])]),cfg.version);
   semantic=vectors.filter(r=>r.dimensions===v.dimensions).map(r=>({id:r.article_id,score:cosineSimilarity(v.value,r.embedding)})).filter(r=>r.score>=0.35).sort((a,b)=>b.score-a.score).slice(0,8);mode='hybrid';
  }
 }catch{signal?.throwIfAborted();mode='keyword';}
 const ranked=new Map<string,number>();for(const list of [keyword,semantic])list.forEach((r,i)=>ranked.set(r.id,(ranked.get(r.id)||0)+1/(60+i+1)));
 const items=[...ranked].sort((a,b)=>b[1]-a[1]).map(([id])=>{
  const article=rows.find(r=>r.id===id)!.article as HelpArticle;
  const fragments=[article.intro,...article.steps,...article.notes];
  const snippet=fragments.find(p=>helpKeywordScore({...article,title:'',intro:p,steps:[],notes:[]},query)>0)||article.intro;
  return {...article,snippet,match:keyword.some(k=>k.id===id)?'keyword':'semantic'};
 });
 return {items,mode,indexState:status.state};
}
