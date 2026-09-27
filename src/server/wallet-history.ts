import {db} from './db';

/** Reconstruct book balances from all wallet events, never from the filtered report. */
export async function attachWalletBalances<T extends {id:string;event_id?:string|null;cost_row_key?:string;cost_project_id?:string}>(user:string,rows:T[]):Promise<T[]>{
 const ids=rows.filter(r=>!r.cost_row_key).map(r=>r.event_id||r.id);
 if(!ids.length)return rows;
 const result=await db.query(`WITH owned AS (
 SELECT a.* FROM accounts a WHERE a.owner_id=$1 OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=a.family_id AND f.user_id=$1)
 ), entries AS (
 SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.* FROM transactions t
 WHERE NOT t.deleted AND (t.account_id IN(SELECT id FROM owned) OR t.target_id IN(SELECT id FROM owned))
 ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id
 ), events AS (
 SELECT COALESCE(t.event_id,t.id) AS id,v.account_id,v.delta,
 t.date+CASE WHEN t.occurred_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN t.occurred_at::time ELSE (t.created_at AT TIME ZONE 'Asia/Shanghai')::time END AS at,
 t.created_at,0 AS type FROM entries t CROSS JOIN LATERAL (VALUES(t.account_id,CASE WHEN t.kind IN('income','refund') THEN t.amount ELSE -t.amount END),(t.target_id,t.amount)) v(account_id,delta)
 WHERE v.account_id IN(SELECT id FROM owned)
 UNION ALL
 SELECT m.id,v.account_id,v.delta,m.date+(m.created_at AT TIME ZONE 'Asia/Shanghai')::time,m.created_at,1
 FROM family_movements m CROSS JOIN LATERAL (VALUES(m.source_id,-m.amount),(m.target_id,m.amount)) v(account_id,delta)
 WHERE m.status='confirmed' AND v.account_id IN(SELECT id FROM owned)
 UNION ALL
 SELECT j.id,j.account_id,j.amount,j.created_at AT TIME ZONE 'Asia/Shanghai',j.created_at,2 FROM account_adjustments j WHERE j.account_id IN(SELECT id FROM owned)
 ), running AS (
 SELECT e.*,a.name,a.opening+sum(e.delta) OVER(PARTITION BY e.account_id ORDER BY e.at,e.created_at,e.type,e.id ROWS UNBOUNDED PRECEDING) AS balance
 FROM events e JOIN owned a ON a.id=e.account_id
 ) SELECT id,account_id,name,balance::float8 AS balance FROM running WHERE id=ANY($2::uuid[])`,[user,ids]);
 return rows.map(r=>({...r,wallet_balances:r.cost_row_key?[]:result.rows.filter(b=>b.id===(r.event_id||r.id)).map(({account_id,name,balance})=>({account_id,name,balance}))}));
}
