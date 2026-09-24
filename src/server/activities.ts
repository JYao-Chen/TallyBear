import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {Failure} from './access';

const uuid=z.string().uuid();
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const details=z.object({name:z.string().trim().min(1).max(80),category:z.string().trim().min(1).max(40).default('其他'),familyId:uuid.nullable().default(null),description:z.string().trim().max(500).default(''),startsOn:day.nullable().default(null),endsOn:day.nullable().default(null),budget:z.number().int().min(0).max(100000000000).nullable().default(null)}).refine(v=>!v.startsOn||!v.endsOn||v.endsOn>=v.startsOn,'结束日期不能早于开始日期');

export async function accessibleActivity(user:string,id:string){
 const row=(await db.query(`SELECT a.id,a.owner_id,a.family_id,a.name,a.category,a.description,to_char(a.starts_on,'YYYY-MM-DD') AS "startsOn",to_char(a.ends_on,'YYYY-MM-DD') AS "endsOn",a.budget::float8 AS budget,a.archived,
 (a.owner_id=$2 OR f.owner_id=$2) AS editable,f.name AS "familyName"
 FROM activities a LEFT JOIN families f ON f.id=a.family_id
 WHERE a.id=$1 AND (a.family_id IS NULL AND a.owner_id=$2 OR EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$2))`,[uuid.parse(id),user])).rows[0];
 if(!row)throw new Failure('活动不存在或没有访问权限',404);
 return row;
}

async function checkFamily(c:PoolClient,user:string,familyId:string|null){
 if(familyId&&!(await c.query('SELECT 1 FROM family_members WHERE family_id=$1 AND user_id=$2',[familyId,user])).rowCount)throw new Failure('请先加入该家庭',403);
}

export async function listActivities(user:string){
 return (await db.query(`SELECT a.id,a.name,a.category,a.family_id AS "familyId",f.name AS "familyName",a.owner_id AS "ownerId",(a.owner_id=$1 OR f.owner_id=$1) AS editable,a.description,to_char(a.starts_on,'YYYY-MM-DD') AS "startsOn",to_char(a.ends_on,'YYYY-MM-DD') AS "endsOn",a.budget::float8 AS budget,a.archived,
 (SELECT count(DISTINCT COALESCE(t.event_id,t.id))::int FROM activity_entries ae JOIN transactions t ON t.id=ae.transaction_id JOIN members m ON m.book_id=t.book_id AND m.user_id=$1 WHERE ae.activity_id=a.id AND (a.family_id IS NOT NULL OR ae.owner_id=$1) AND NOT t.deleted) AS "entryCount"
 FROM activities a LEFT JOIN families f ON f.id=a.family_id
 WHERE a.family_id IS NULL AND a.owner_id=$1 OR EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$1)
 ORDER BY a.archived,a.created_at DESC`,[user])).rows;
}

export async function changeActivity(user:string,method:string,body:unknown){
 if(method==='POST'){const b=details.parse(body),id=randomUUID();return transaction(async c=>{await checkFamily(c,user,b.familyId);await c.query('INSERT INTO activities(id,owner_id,name,category,family_id,description,starts_on,ends_on,budget) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,user,b.name,b.category,b.familyId,b.description,b.startsOn,b.endsOn,b.budget]);return {id};});}
 const b=z.object({id:uuid}).parse(body);
 const activity=await accessibleActivity(user,b.id);if(!activity.editable)throw new Failure('只有创建者或家庭负责人可以管理活动',403);
 if(method==='PUT'){const d=details.parse(body);if(activity.owner_id!==user&&d.familyId!==activity.family_id)throw new Failure('只有活动创建者可以更改活动归属',403);return transaction(async c=>{await checkFamily(c,user,d.familyId);await c.query('UPDATE activities SET name=$1,category=$2,family_id=$3,description=$4,starts_on=$5,ends_on=$6,budget=$7 WHERE id=$8',[d.name,d.category,d.familyId,d.description,d.startsOn,d.endsOn,d.budget,b.id]);return {ok:true};});}
 if(method==='PATCH'){const input=z.object({id:uuid,archived:z.boolean()}).parse(body);await db.query('UPDATE activities SET archived=$1 WHERE id=$2',[input.archived,input.id]);return {ok:true};}
 if(method==='DELETE'){await db.query('DELETE FROM activities WHERE id=$1',[b.id]);return {ok:true};}
 throw new Failure('操作不存在',404);
}

export async function setEntryActivity(c:PoolClient,user:string,book:string,transactionId:string,activityId?:string|null){
 const row=(await c.query('SELECT t.id,t.event_id FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$3 WHERE t.id=$1 AND t.book_id=$2 AND NOT t.deleted',[transactionId,book,user])).rows[0];
 if(!row)throw new Failure('账目不存在或没有访问权限',404);
 const copies=(await c.query('SELECT t.id FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE NOT t.deleted AND (t.id=$1 OR ($3::uuid IS NOT NULL AND t.event_id=$3))',[transactionId,user,row.event_id||null])).rows.map(r=>r.id as string);
 if(activityId){
  const activity=(await c.query(`SELECT a.id,a.archived FROM activities a WHERE a.id=$1 AND
   (a.family_id IS NULL AND a.owner_id=$2 OR EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$2))`,[uuid.parse(activityId),user])).rows[0];
  if(!activity)throw new Failure('请选择有权限的活动',403);
  if(activity.archived){if((await c.query('SELECT 1 FROM activity_entries WHERE transaction_id=$1 AND activity_id=$2',[transactionId,activityId])).rowCount)return;throw new Failure('归档活动不能加入新账目，请先重新启用',403);}
  await c.query(`DELETE FROM activity_entries ae USING activities a WHERE ae.activity_id=a.id AND ae.transaction_id=ANY($1::uuid[])
   AND ae.activity_id<>$3 AND (ae.owner_id=$2 OR (a.family_id IS NOT NULL AND EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$2)))`,[copies,user,activityId]);
  await c.query('INSERT INTO activity_entries(transaction_id,owner_id,activity_id) SELECT unnest($1::uuid[]),$2,$3 ON CONFLICT(transaction_id,owner_id) DO UPDATE SET activity_id=$3',[copies,user,activityId]);
 }else await c.query(`DELETE FROM activity_entries ae USING activities a WHERE ae.activity_id=a.id AND ae.transaction_id=ANY($1::uuid[])
  AND (ae.owner_id=$2 OR (a.family_id IS NOT NULL AND EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$2)))`,[copies,user]);
}

export async function assignActivity(user:string,body:unknown){
 const b=z.object({bookId:uuid,transactionId:uuid,activityId:uuid.nullable()}).parse(body);
 return transaction(async c=>{const role=(await c.query("SELECT role FROM members WHERE book_id=$1 AND user_id=$2",[b.bookId,user])).rows[0];if(!role||role.role==='viewer')throw new Failure('没有修改此账本的权限',403);await setEntryActivity(c,user,b.bookId,b.transactionId,b.activityId);return {ok:true};});
}

export async function entryActivity(user:string,bookId:string,transactionId:string){
 const result=await db.query(`SELECT (SELECT ae.activity_id FROM activity_entries ae JOIN activities a ON a.id=ae.activity_id
  WHERE ae.transaction_id=t.id AND (a.family_id IS NULL AND a.owner_id=$1 OR EXISTS(SELECT 1 FROM family_members fm WHERE fm.family_id=a.family_id AND fm.user_id=$1))
  AND (ae.owner_id=$1 OR a.family_id IS NOT NULL)
  ORDER BY (ae.owner_id=$1) DESC LIMIT 1) AS "activityId"
  FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$1 WHERE t.id=$2 AND t.book_id=$3 AND NOT t.deleted`,[user,uuid.parse(transactionId),uuid.parse(bookId)]);
 if(!result.rowCount)throw new Failure('账目不存在或没有访问权限',404);
 return {activityId:result.rows[0].activityId||null};
}

export async function activityReport(user:string,id:string,params:URLSearchParams){
 const activity=await accessibleActivity(user,id);
 const filter=z.object({book:z.union([z.literal('all'),uuid]).default('all'),kind:z.enum(['all','expense','income','refund','transfer']).default('all'),category:z.string().max(60).default(''),account:z.union([z.literal('all'),uuid]).default('all'),q:z.string().trim().max(120).default(''),offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(20)}).parse(Object.fromEntries(params));
 const values:unknown[]=[id,user],where:string[]=['ae.activity_id=$1','NOT t.deleted'];
 if(!activity.family_id)where.push('ae.owner_id=$2');
 if(filter.book!=='all'){values.push(filter.book);where.push(`t.book_id=$${values.length}`);}
 if(filter.kind!=='all'){values.push(filter.kind);where.push(`t.kind=$${values.length}`);}
 if(filter.category){values.push(filter.category);where.push(`t.category=$${values.length}`);}
 if(filter.account!=='all'){values.push(filter.account);where.push(`(t.account_id=$${values.length} OR t.target_id=$${values.length})`);}
 if(filter.q){values.push('%'+filter.q.toLowerCase()+'%');where.push(`lower(concat_ws(' ',t.title,t.payee,t.product,t.note,t.order_id,t.external_id)) LIKE $${values.length}`);}
 values.push(filter.limit,filter.offset);const limit='$'+(values.length-1),offset='$'+values.length;
 const result=await db.query(`WITH matched AS (
 SELECT DISTINCT ON (COALESCE(t.event_id,t.id)) t.id,t.book_id,b.name AS book_name,t.kind,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,t.title,t.payee,t.category,t.product,t.note,t.account_id,a.name AS account_name,a.owner_id AS account_owner,t.created_at
 FROM activity_entries ae JOIN transactions t ON t.id=ae.transaction_id JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 JOIN books b ON b.id=t.book_id JOIN accounts a ON a.id=t.account_id
 WHERE ${where.join(' AND ')} ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id
 ), page AS (SELECT * FROM matched ORDER BY date DESC,created_at DESC,id DESC LIMIT ${limit} OFFSET ${offset})
 SELECT json_build_object('rows',(SELECT COALESCE(json_agg(page),'[]'::json) FROM page),
 'totals',(SELECT json_build_object('count',count(*),'income',COALESCE(sum(amount) FILTER (WHERE kind='income'),0),'expense',COALESCE(sum(amount) FILTER (WHERE kind='expense'),0),'refund',COALESCE(sum(amount) FILTER (WHERE kind='refund'),0)) FROM matched),
 'categories',(SELECT COALESCE(json_agg(x ORDER BY x.amount DESC),'[]'::json) FROM (SELECT category,sum(CASE WHEN kind='refund' THEN -amount ELSE amount END)::float8 AS amount FROM matched WHERE kind IN ('expense','refund') GROUP BY category) x),
 'wallets',(SELECT COALESCE(json_agg(x ORDER BY x.amount DESC),'[]'::json) FROM (SELECT account_id AS id,account_name AS name,sum(CASE WHEN kind='refund' THEN -amount ELSE amount END)::float8 AS amount FROM matched WHERE kind IN ('expense','refund') GROUP BY account_id,account_name) x),
 'books',(SELECT COALESCE(json_agg(x ORDER BY x.amount DESC),'[]'::json) FROM (SELECT book_id AS id,book_name AS name,sum(CASE WHEN kind='refund' THEN -amount ELSE amount END)::float8 AS amount FROM matched WHERE kind IN ('expense','refund') GROUP BY book_id,book_name) x),
 'daily',(SELECT COALESCE(json_agg(x ORDER BY x.date),'[]'::json) FROM (SELECT date,sum(CASE WHEN kind='refund' THEN -amount WHEN kind='expense' THEN amount ELSE 0 END)::float8 AS amount FROM matched GROUP BY date) x)) AS report`,values);
 return {activity,...result.rows[0].report};
}
