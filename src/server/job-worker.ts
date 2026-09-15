import {deployment} from '@/lib/deployment';
import {checkDeploymentCurrency} from './deployment';
import {translate,language} from '@/lib/i18n';
import {cleanupReceipts} from './receipts';
import {testModelConnections} from './connection-test';
import {updateThinking} from '@/lib/thinking';
import {db,transaction} from './db';
import {member,type User} from './access';
import {recognize} from './recognize';
import {runFinanceAgent} from './finance-agent';
import {callModel} from './ai';

export async function executeJob(job:any){
 const controller=new AbortController();const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15*60*1000)]);
 let liveText='',liveArtifacts:any={charts:[],tools:[],drafts:[],thinking:[],actions:job.payload.previousActions||[],images:job.payload.images||[]};
 let pending:{event:string;data:any}[]=[],saving=Promise.resolve(),stage='正在准备',cancelled=false,lastSnapshot=0;
 const emit=(event:string,data:any)=>{if(event==='status'&&typeof data==='string')data=translate(data,deployment().language);if(event==='delta'&&job.kind==='chat')liveText+=data;if(data?.artifacts)liveArtifacts=JSON.parse(JSON.stringify(data.artifacts));if(event==='thinking'){liveArtifacts.thinking=updateThinking(liveArtifacts.thinking,data);stage=data.label+(data.status==='running'?' · 思考中':' · 思考结束');}const last=pending.at(-1);if(event==='delta'&&last?.event==='delta')last.data+=data;else if(event==='thinking'&&data.delta&&last?.event==='thinking'&&last.data.id===data.id&&last.data.delta)last.data.delta+=data.delta;else pending.push({event,data:typeof data==='object'&&data!==null?JSON.parse(JSON.stringify(data)):data});if(event==='status')stage=String(data);if(event==='tool_start')stage=String(data.label)+'…';if(event==='agent_start')stage=String(data.role)+'正在处理';if(event==='agent_done')stage=String(data.role)+'已返回结果';if(event==='delta'&&stage==='正在准备')stage='模型正在生成';};
 const flush=()=>{saving=saving.then(async()=>{const batch=pending.splice(0);if(batch.length)await transaction(async c=>{for(const e of batch)await c.query('INSERT INTO ai_job_events(job_id,event,data) VALUES($1,$2,$3)',[job.id,e.event,JSON.stringify(e.data)]);await c.query('UPDATE ai_jobs SET stage=$1 WHERE id=$2',[stage,job.id]);if(job.kind==='chat'&&Date.now()-lastSnapshot>=750){lastSnapshot=Date.now();await c.query("UPDATE finance_turns SET answer=$1,artifacts=$2 WHERE id=$3 AND status='running'",[liveText,liveArtifacts,job.id]);}});});return saving;};
 const streamTimer=setInterval(()=>{flush().catch(()=>controller.abort());},50);
 const timer=setInterval(()=>{db.query('SELECT cancel_requested FROM ai_jobs WHERE id=$1',[job.id]).then(r=>{if(!r.rows[0]||r.rows[0].cancel_requested){cancelled=true;controller.abort();}}).catch(()=>controller.abort());},750);
 let result:any=null,status='complete',error='';
 try{
  await checkDeploymentCurrency();
  if(job.cancel_requested){cancelled=true;throw new Error('任务已取消');}
  const user=(await db.query('SELECT id,username,name,admin,avatar,theme FROM users WHERE id=$1 AND NOT disabled',[job.user_id])).rows[0] as User;if(!user)throw new Error('用户已停用');
  if(job.book_id)await member(job.book_id,user,job.kind==='assistant');
  emit('status',job.kind==='assistant'?'正在识别订单与商品明细':job.kind==='chat'?'正在分析问题':'正在测试连接');
  if(job.kind==='assistant')result=await recognize(job.book_id,job.payload,{signal,onDelta:t=>emit('delta',t),onStage:s=>emit('status',s),checkpoint:{get:async key=>(await db.query('SELECT result FROM ai_job_steps WHERE job_id=$1 AND step=$2',[job.id,key])).rows[0]?.result,set:async(key,value)=>{await db.query('INSERT INTO ai_job_steps VALUES($1,$2,$3) ON CONFLICT(job_id,step) DO UPDATE SET result=$3',[job.id,key,JSON.stringify(value)]);}}},user.id);
  else if(job.kind==='connection'){if(!user.admin)throw new Error('需要管理员权限');result=await testModelConnections({signal,onStage:s=>emit('status',s)});}
  else if(job.kind==='chat'){
   const b=job.payload;const prior=(await db.query("SELECT question,answer FROM finance_turns WHERE conversation_id=$1 AND status='complete' ORDER BY created_at DESC LIMIT 6",[b.id])).rows.reverse();
   result=await runFinanceAgent({previousImages:b.previousImages,previousActions:b.previousActions,deviceTime:b.deviceTime,useHistory:b.useHistory,language:b.language,book:job.book_id,user,question:(b.text||'请识别附图账单并整理待确认草稿')+(b.actionId?'\n用户正在修改待确认卡片 actionId='+b.actionId:''),month:b.month,images:b.images,history:prior.flatMap(t=>[{role:'user' as const,content:t.question},{role:'assistant' as const,content:t.answer}]),signal,emit});
   if(!result.text&&!result.artifacts.charts.length&&!result.artifacts.drafts.length)throw new Error('模型未生成可用回答');
  }else throw new Error('任务类型无效');
  if(job.book_id)await member(job.book_id,user,job.kind==='assistant');
  if(signal.aborted)throw new Error('任务已停止');
 }catch(e){result=(e as any).partial||result;status=cancelled?'cancelled':'error';error=cancelled?'任务已取消':signal.aborted?'处理超时或后台连接中断，请重试':e instanceof Error?(e.name==='ZodError'?'识别信息不完整，请补充后重试':e.message):'任务未完成';}
 finally{
  clearInterval(timer);clearInterval(streamTimer);await flush();
  if(job.kind==='chat'){result={id:job.id,text:liveText,artifacts:liveArtifacts,model:'',...result,status:status==='complete'?'complete':status==='cancelled'?'stopped':'error',error};}
  await transaction(async c=>{
   if(job.kind==='chat'){await c.query('UPDATE finance_turns SET answer=$1,artifacts=$2,model=$3,status=$4,error=$5 WHERE id=$6',[result.text,result.artifacts,result.model,result.status,error,job.id]);await c.query('UPDATE finance_conversations SET updated_at=now() WHERE id=$1',[job.payload.id]);}
   await c.query("UPDATE ai_jobs SET status=$1,stage=$2,result=$3,error=$4,payload=CASE WHEN $1='complete' THEN '{}'::jsonb ELSE payload END,finished_at=now() WHERE id=$5",[status,status==='complete'?'已完成':error,result,error,job.id]);
  });
 }
}
export async function startWorker(){
 // One scheduler owns the global concurrency limit, including during deployments.
 const lock=await db.connect();const acquired=(await lock.query('SELECT pg_try_advisory_lock(301616) AS ok')).rows[0].ok;if(!acquired){lock.release();throw new Error('后台任务服务已在运行');}
 lock.on('error',()=>process.exit(1));
 await transaction(async c=>{await c.query("UPDATE finance_turns SET status='error',error='后台服务中断，请重新提交' WHERE id IN (SELECT id FROM ai_jobs WHERE status='running')");await c.query("UPDATE ai_jobs SET status=CASE WHEN kind='assistant' THEN 'queued' ELSE 'error' END,stage='后台服务中断，已保留进度',error='后台服务中断，可重试',finished_at=CASE WHEN kind='assistant' THEN NULL ELSE now() END WHERE status='running'");});
 let nextReceiptCleanup=0;let stopping=false;const active=new Set<Promise<void>>();process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
 console.log('AI queue worker ready');
 try{while(!stopping){
  if(Date.now()>=nextReceiptCleanup){try{const count=await cleanupReceipts();nextReceiptCleanup=Date.now()+(count===100?1000:3600000);}catch(e){console.error('Receipt cleanup failed:',e instanceof Error?e.message:'unknown');nextReceiptCleanup=Date.now()+60000;}}
  const limit=Number((await db.query('SELECT concurrency FROM ai_queue_settings WHERE id=1')).rows[0].concurrency);
  while(active.size<limit&&!stopping){const job=await transaction(async c=>{const j=(await c.query("SELECT * FROM ai_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(j)await c.query("UPDATE ai_jobs SET status='running',stage='正在准备',started_at=now() WHERE id=$1",[j.id]);return j;});if(!job)break;
   const work=executeJob(job).catch(async()=>{await db.query("UPDATE ai_jobs SET status='error',error='任务保存失败，请重试',stage='任务保存失败',finished_at=now() WHERE id=$1",[job.id]);await db.query("UPDATE finance_turns SET status='error',error='任务保存失败，请重试' WHERE id=$1",[job.id]);}).finally(()=>active.delete(work));active.add(work);
  }
  await new Promise(r=>setTimeout(r,500));
 }}finally{await Promise.allSettled(active);await lock.query('SELECT pg_advisory_unlock(301616)');lock.release();await db.end();}
}
