import {authorizeImages} from './receipts';
import {randomUUID} from 'node:crypto';
import {db} from './db';
import {Failure,member,type User} from './access';
import type {PoolClient} from 'pg';
export type JobKind='assistant'|'chat'|'connection';
export async function enqueue(user:User,book:string|null,kind:JobKind,payload:unknown,id:string=randomUUID(),client:Pick<PoolClient,'query'>=db){
 if(book)await authorizeImages([...((payload as any)?.images||[]),...((payload as any)?.image?[(payload as any).image]:[])],book,user.id);
 await client.query('INSERT INTO ai_jobs(id,user_id,book_id,kind,payload) VALUES($1,$2,$3,$4,$5)',[id,user.id,book,kind,JSON.stringify(payload)]);return id;
}
export async function ownedJob(id:string,u:User){const j=(await db.query('SELECT * FROM ai_jobs WHERE id=$1 AND user_id=$2',[id,u.id])).rows[0];if(!j)throw new Failure('任务不存在',404);if(j.book_id)await member(j.book_id,u);return j;}
// Streams observe durable events; disconnecting never cancels execution.
export function watchJob(id:string,signal:AbortSignal){const encoder=new TextEncoder();let closed=false;
 return new Response(new ReadableStream<Uint8Array>({async start(stream){let cursor=0;const send=(event:string,data:unknown)=>{if(!closed&&!signal.aborted)stream.enqueue(encoder.encode(`data: ${JSON.stringify({event,data})}\n\n`));};try{send('task',{id});send('status','已加入后台队列');while(!closed&&!signal.aborted){const rows=(await db.query('SELECT seq,event,data FROM ai_job_events WHERE job_id=$1 AND seq>$2 ORDER BY seq',[id,cursor])).rows;for(const r of rows){cursor=Number(r.seq);send(r.event,r.data);}const j=(await db.query('SELECT status,result,error,kind FROM ai_jobs WHERE id=$1',[id])).rows[0];if(!j){send('error','任务已移除');break;}if(['complete','error','cancelled'].includes(j.status)){if(j.status==='complete')send(j.kind==='chat'?'done':'complete',j.result);else if(j.kind==='chat'&&j.result)send('done',j.result);else send('error',j.error||'任务已取消');break;}await new Promise(r=>setTimeout(r,50));}}catch{send('error','进度连接中断，请到后台任务查看结果');}finally{if(!closed){closed=true;stream.close();}}},cancel(){closed=true;}}),{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no','X-Task-Id':id}});
}
