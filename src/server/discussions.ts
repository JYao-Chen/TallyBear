import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction} from './db';
import {Failure} from './access';
import type {DiscussionTarget} from '@/lib/discussions';

const uuid=z.string().uuid();
const targetSchema=z.object({kind:z.enum(['movement','transaction','project','schedule','claim']),id:uuid,scope:z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/).default('')});
// Resolve membership from the source records on every request, including the inbox.
// A linked copy in another book deliberately has a separate discussion audience.
const audiences=`
 SELECT 'movement' AS kind,v.id AS target_id,f.user_id,
 s.name||' → '||COALESCE(r.name,a.name) AS title,NULL::uuid AS book_id,v.family_id,
 v.amount::float8 AS amount,to_char(v.date,'YYYY-MM-DD') AS date,v.note
 FROM family_movements v JOIN family_members f ON f.family_id=v.family_id AND f.user_id IN (v.sender_id,v.recipient_id)
 JOIN users s ON s.id=v.sender_id LEFT JOIN users r ON r.id=v.recipient_id LEFT JOIN accounts a ON a.id=v.target_id
 UNION ALL
 SELECT 'transaction',t.id,m.user_id,COALESCE(NULLIF(t.title,''),NULLIF(t.payee,''),t.category),t.book_id,b.family_id,t.amount::float8,to_char(t.date,'YYYY-MM-DD'),''
 FROM transactions t JOIN books b ON b.id=t.book_id AND b.kind='shared' JOIN members m ON m.book_id=b.id WHERE NOT t.deleted
 UNION ALL
 SELECT 'project',p.id,u.id,p.title,NULL::uuid,p.family_id,NULL::float8,NULL::text,''
 FROM cost_projects p JOIN users u ON u.id=p.owner_id OR EXISTS(SELECT 1 FROM cost_project_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=p.family_id WHERE m.project_id=p.id AND m.user_id=u.id)
 UNION ALL
 SELECT 'schedule',s.id,u.id,s.rule->>'title',NULL::uuid,s.family_id,NULL::float8,NULL::text,''
 FROM cost_schedules s JOIN users u ON u.id=s.owner_id OR EXISTS(SELECT 1 FROM cost_schedule_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=s.family_id WHERE m.schedule_id=s.id AND m.user_id=u.id)
 UNION ALL
 SELECT 'claim',c.id,u.id,COALESCE(NULLIF(c.snapshot->>'title',''),NULLIF(c.snapshot->>'product',''),NULLIF(c.snapshot->>'payee',''),c.snapshot->>'category'),NULL::uuid,NULL::uuid,(c.snapshot->>'amount')::float8,c.snapshot->>'date',''
 FROM expense_claims c JOIN users u ON u.id IN(c.sender_id,c.recipient_id)
 WHERE EXISTS(SELECT 1 FROM family_members a JOIN family_members b ON b.family_id=a.family_id WHERE a.user_id=c.sender_id AND b.user_id=c.recipient_id)
`;
async function access(c:PoolClient,user:string,input:DiscussionTarget){
 const t=targetSchema.parse(input);
 const row=(await c.query(`SELECT * FROM (${audiences}) a WHERE a.kind=$1 AND a.target_id=$2 AND a.user_id=$3`,[t.kind,t.id,user])).rows[0];
 if(!row)throw new Failure('讨论不存在或无权访问',404);
 if(t.scope){
  if(t.kind!=='schedule'||!(await c.query(`SELECT 1 FROM cost_schedules s WHERE s.id=$1 AND (to_char(s.next_date,'YYYY-MM-DD')=$2 OR EXISTS(SELECT 1 FROM cost_schedule_occurrences o WHERE o.schedule_id=s.id AND to_char(o.due_date,'YYYY-MM-DD')=$2) OR EXISTS(SELECT 1 FROM discussion_threads t WHERE t.kind='schedule' AND t.target_id=s.id AND t.scope=$2))`,[t.id,t.scope])).rowCount)throw new Failure('账期不存在',404);
 }
 return {target:t,context:row};
}
export async function postDiscussionMessage(c:PoolClient,user:string,input:DiscussionTarget,body:unknown){
 const {target:t}=await access(c,user,input);
 const b=z.object({id:uuid,body:z.string().trim().min(1).max(2000),replyTo:uuid.nullable().optional()}).parse(body);
 const thread=(await c.query(`INSERT INTO discussion_threads(id,kind,target_id,scope) VALUES($1,$2,$3,$4) ON CONFLICT(kind,target_id,scope) DO UPDATE SET target_id=EXCLUDED.target_id RETURNING id`,[randomUUID(),t.kind,t.id,t.scope])).rows[0];
 if(b.replyTo&&!(await c.query('SELECT 1 FROM discussion_messages WHERE id=$1 AND thread_id=$2',[b.replyTo,thread.id])).rowCount)throw new Failure('回复的留言不属于这段讨论');
 const existing=(await c.query('SELECT thread_id,user_id,body,reply_to FROM discussion_messages WHERE id=$1',[b.id])).rows[0];
 if(existing){if(existing.thread_id!==thread.id||existing.user_id!==user||existing.body!==b.body||existing.reply_to!==(b.replyTo||null))throw new Failure('留言已变化，请刷新后重试',409);return {ok:true};}
 await c.query('INSERT INTO discussion_messages(id,thread_id,user_id,body,reply_to) VALUES($1,$2,$3,$4,$5)',[b.id,thread.id,user,b.body,b.replyTo||null]);
 return {ok:true};
}
export async function discussions(user:string,method:string,path:string[],body:any,params:URLSearchParams){
 return transaction(async c=>{
  const offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
  if(path[1]==='inbox'&&method==='GET'){
   const result=await c.query(`WITH accessible AS (SELECT t.*,a.title,a.book_id,a.family_id,a.amount,a.date FROM discussion_threads t JOIN (${audiences}) a ON a.kind=t.kind AND a.target_id=t.target_id AND a.user_id=$1),
    unread AS (SELECT t.*,count(*)::int AS unread,max(m.seq) AS latest_seq FROM accessible t JOIN discussion_messages m ON m.thread_id=t.id AND m.user_id<>$1 LEFT JOIN discussion_reads r ON r.thread_id=t.id AND r.user_id=$1 WHERE m.seq>COALESCE(r.last_seq,0) GROUP BY t.id,t.kind,t.target_id,t.scope,t.title,t.book_id,t.family_id,t.amount,t.date)
    SELECT t.*,m.body,m.created_at,u.name,u.avatar,count(*) OVER()::int AS total FROM unread t JOIN discussion_messages m ON m.seq=t.latest_seq JOIN users u ON u.id=m.user_id ORDER BY t.latest_seq DESC LIMIT 5 OFFSET $2`,[user,offset]);
   return {rows:result.rows,total:result.rows[0]?.total||0};
  }
  const input=method==='GET'?{kind:params.get('kind'),id:params.get('id'),scope:params.get('scope')||''}:body.target;
  const {target:t,context}=await access(c,user,input);
  if(method==='POST'&&path[1]==='messages')return postDiscussionMessage(c,user,t,body);
  const thread=(await c.query('SELECT id FROM discussion_threads WHERE kind=$1 AND target_id=$2 AND scope=$3',[t.kind,t.id,t.scope])).rows[0];
  if(method==='POST'&&path[1]==='read'){
   const seq=z.string().regex(/^\d+$/).parse(body.upTo);
   if(thread)await c.query(`INSERT INTO discussion_reads(thread_id,user_id,last_seq) SELECT $1,$2,seq FROM discussion_messages WHERE thread_id=$1 AND seq=$3 ON CONFLICT(thread_id,user_id) DO UPDATE SET last_seq=GREATEST(discussion_reads.last_seq,EXCLUDED.last_seq)`,[thread.id,user,seq]);
   return {ok:true};
  }
  if(method!=='GET')throw new Failure('操作不存在',404);
  const people=(await c.query(`SELECT u.id,u.name,u.avatar FROM (${audiences}) a JOIN users u ON u.id=a.user_id WHERE a.kind=$1 AND a.target_id=$2 AND NOT u.disabled ORDER BY u.name,u.id`,[t.kind,t.id])).rows;
  if(!thread)return {available:true,userId:user,context,people,rows:[],total:0};
  const rows=(await c.query(`SELECT m.*,u.name,u.avatar,r.body AS reply_body,ru.name AS reply_name,ru.avatar AS reply_avatar,count(*) OVER()::int AS total FROM discussion_messages m JOIN users u ON u.id=m.user_id LEFT JOIN discussion_messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.id=r.user_id WHERE m.thread_id=$1 ORDER BY m.seq DESC LIMIT 20 OFFSET $2`,[thread.id,offset])).rows;
  return {available:true,userId:user,context,people,rows:rows.reverse(),total:rows[0]?.total||0};
 });
}
