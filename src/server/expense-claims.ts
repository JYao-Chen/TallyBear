import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction,lockBook} from './db';
import {Failure} from './access';
import {reuseInTransaction,lockRelatedBooks} from './reuse';
const uuid=z.string().uuid();
async function notify(c:PoolClient,id:string,user:string,kind:string){await c.query('INSERT INTO expense_claim_events(claim_id,user_id,kind) VALUES($1,$2,$3)',[id,user,kind]);}
async function familyPair(c:PoolClient,a:string,b:string){if(!(await c.query('SELECT 1 FROM family_members a JOIN family_members b ON b.family_id=a.family_id JOIN users u ON u.id=b.user_id AND NOT u.disabled WHERE a.user_id=$1 AND b.user_id=$2 AND a.user_id<>b.user_id',[a,b])).rowCount)throw new Failure('请选择仍在同一家庭的其他成员',403);}
async function copyForClaim(c:PoolClient,claim:any,source:any,book:string){
 if(source.book_id===book){await c.query('INSERT INTO expense_claim_links(claim_id,source_id,target_id,managed) VALUES($1,$2,$2,false) ON CONFLICT(claim_id,target_id) DO UPDATE SET active=true',[claim.id,source.id]);return {id:source.id,managed:false};}
 const old=(await c.query('SELECT t.id,t.deleted,EXISTS(SELECT 1 FROM expense_claim_links l WHERE l.target_id=t.id AND l.managed) AS managed FROM transactions t WHERE t.book_id=$1 AND t.event_id=$2',[book,source.event_id])).rows[0];
 if(old?.deleted&&old.managed)await c.query('UPDATE transactions SET amount=$2,date=$3,account_id=$4,title=$5,product=$6,payee=$7,line_items=$8,deleted=false,version=version+1 WHERE id=$1',[old.id,source.amount,source.date,source.account_id,source.title,source.product,source.payee,JSON.stringify(source.line_items)]);
 const result=await reuseInTransaction(c,source.book_id,claim.recipient_id,source.id,source.version,book,[],false);
 const managed=!old||old.managed;
 await c.query('INSERT INTO expense_claim_links(claim_id,source_id,target_id,managed) VALUES($1,$2,$3,$4) ON CONFLICT(claim_id,target_id) DO UPDATE SET active=true',[claim.id,source.id,result.id,managed]);
 return {id:result.id,managed};
}
async function removeLinks(c:PoolClient,id:string){
 await c.query('UPDATE expense_claim_links SET active=false WHERE claim_id=$1',[id]);
 await c.query('UPDATE transactions t SET deleted=true,version=t.version+1 FROM expense_claim_links l WHERE l.claim_id=$1 AND l.managed AND t.id=l.target_id AND NOT t.deleted',[id]);
}
export async function inviteExpense(c:PoolClient,user:string,sourceId:string,recipient:string|null){
 const source=(await c.query(`SELECT t.*,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,(SELECT COALESCE(sum(r.amount),0)::float8 FROM transactions r WHERE r.refund_of=t.id AND NOT r.deleted) AS refunded,a.owner_id,m.role FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE t.id=$1 AND NOT t.deleted`,[sourceId,user])).rows[0];
 if(!source||source.role==='viewer'||source.owner_id!==user||source.kind!=='expense')throw new Failure('只能为本人实际付款且可编辑的消费指定认领人',403);
 if((await c.query('SELECT 1 FROM expense_claim_links WHERE target_id=$1 AND managed',[sourceId])).rowCount)throw new Failure('认领的账单不能再次转交给其他成员');
 const event=source.event_id||randomUUID();
 const current=(await c.query("SELECT * FROM expense_claims WHERE event_id=$1 AND status IN ('pending','accepted') FOR UPDATE",[event])).rows[0];
 if(current?.recipient_id===recipient)return {id:current.id};
 if(current?.status==='accepted')throw new Failure('请先撤回已认领的关联，再更换认领人');
 if(current){await c.query("UPDATE expense_claims SET status='withdrawn',version=version+1,updated_at=now() WHERE id=$1",[current.id]);await notify(c,current.id,current.recipient_id,'withdrawn');}
 if(!recipient)return {ok:true};
 await familyPair(c,user,recipient);
 if((await c.query(`SELECT 1 FROM cost_source_claims s JOIN transactions t ON t.id=s.transaction_id WHERE COALESCE(t.event_id,t.id)=$1 UNION ALL SELECT 1 FROM family_expense_shares s JOIN transactions t ON t.id=s.transaction_id WHERE COALESCE(t.event_id,t.id)=$1`,[source.event_id||source.id])).rowCount)throw new Failure('这笔账已有成员费用分担，请在费用项目中调整');
 if(!source.event_id)await c.query('UPDATE transactions SET event_id=$2,version=version+1 WHERE id=$1',[source.id,event]);
 const id=randomUUID();await c.query("INSERT INTO expense_claims(id,event_id,source_id,sender_id,recipient_id,status,snapshot) VALUES($1,$2,$3,$4,$5,'pending',$6)",[id,event,source.id,user,recipient,JSON.stringify(Object.fromEntries(['title','product','payee','category','note','line_items','amount','date','deleted','refunded'].map(k=>[k,source[k]])))]);await notify(c,id,recipient,'invited');return {id};
}
// A later refund follows the accepted expense into its recipient's chosen book.
export async function copyClaimRefund(c:PoolClient,sourceId:string){
 const source=(await c.query("SELECT t.*,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date FROM transactions t WHERE t.id=$1 AND t.kind='refund'",[sourceId])).rows[0];if(!source?.refund_of)return;
 const claims=(await c.query("SELECT c.*,t.book_id FROM expense_claims c LEFT JOIN transactions t ON t.id=c.target_id WHERE c.source_id=$1 AND c.status IN ('pending','accepted')",[source.refund_of])).rows;
 for(const claim of claims){if(claim.status==='accepted')await copyForClaim(c,claim,source,claim.book_id);await c.query("UPDATE expense_claims SET snapshot=jsonb_set(snapshot,'{refunded}',to_jsonb((SELECT COALESCE(sum(amount),0) FROM transactions WHERE refund_of=$2 AND NOT deleted))),version=version+1,updated_at=now() WHERE id=$1",[claim.id,source.refund_of]);await notify(c,claim.id,claim.recipient_id,'source_changed');}
}
export async function expenseClaims(user:string,method:string,path:string[],body:any,params:URLSearchParams){return transaction(async c=>{
 if(path[1]==='people'&&method==='GET')return (await c.query('SELECT DISTINCT u.id,u.name,u.avatar FROM family_members a JOIN family_members b ON b.family_id=a.family_id JOIN users u ON u.id=b.user_id AND NOT u.disabled WHERE a.user_id=$1 AND u.id<>$1 ORDER BY u.name,u.id',[user])).rows;
 if(path[1]==='inbox'&&method==='GET'){
  const offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
  const rows=(await c.query(`SELECT c.id,c.status,c.version,c.updated_at,COALESCE(NULLIF(c.snapshot->>'title',''),NULLIF(c.snapshot->>'product',''),NULLIF(c.snapshot->>'payee',''),c.snapshot->>'category') AS title,c.snapshot->>'product' AS product,c.snapshot->>'payee' AS payee,(c.snapshot->>'amount')::float8 AS amount,c.snapshot->>'date' AS date,u.name,u.avatar,
   CASE WHEN c.recipient_id=$1 THEN 'recipient' ELSE 'sender' END AS side,
   (SELECT kind FROM expense_claim_events e WHERE e.claim_id=c.id AND e.user_id=$1 AND NOT e.seen ORDER BY e.id DESC LIMIT 1) AS event,
   count(*) OVER()::int AS total FROM expense_claims c JOIN transactions t ON t.id=c.source_id JOIN users u ON u.id=CASE WHEN c.recipient_id=$1 THEN c.sender_id ELSE c.recipient_id END
   WHERE ($1 IN(c.sender_id,c.recipient_id))
   AND (c.recipient_id=$1 AND c.status='pending' AND NOT t.deleted OR EXISTS(SELECT 1 FROM expense_claim_events e WHERE e.claim_id=c.id AND e.user_id=$1 AND NOT e.seen))
   ORDER BY c.updated_at DESC,c.id LIMIT 5 OFFSET $2`,[user,offset])).rows;return {rows,total:rows[0]?.total||0};
 }
 if(path[1]==='sent'&&method==='GET'){
  const offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
  const rows=(await c.query(`SELECT c.id,c.status,c.updated_at,COALESCE(NULLIF(c.snapshot->>'title',''),NULLIF(c.snapshot->>'product',''),NULLIF(c.snapshot->>'payee',''),c.snapshot->>'category') AS title,
   (c.snapshot->>'amount')::float8 AS amount,c.snapshot->>'date' AS date,u.name,u.avatar,count(*) OVER()::int AS total
   FROM expense_claims c JOIN users u ON u.id=c.recipient_id WHERE c.sender_id=$1 ORDER BY c.created_at DESC,c.id LIMIT 5 OFFSET $2`,[user,offset])).rows;
  return {rows,total:rows[0]?.total||0};
 }
 if(path[1]==='for-record'&&method==='GET'){
  const id=uuid.parse(params.get('id'));
  if(!(await c.query('SELECT 1 FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE t.id=$1',[id,user])).rowCount)throw new Failure('无权查看这笔账',403);
  const row=(await c.query("SELECT c.id,c.status,c.version,c.sender_id,c.recipient_id,s.name AS sender_name,r.name AS recipient_name,c.target_id FROM expense_claims c JOIN users s ON s.id=c.sender_id JOIN users r ON r.id=c.recipient_id JOIN transactions t ON COALESCE(t.event_id,t.id)=c.event_id WHERE t.id=$1 AND c.status IN ('pending','accepted') ORDER BY c.created_at DESC LIMIT 1",[id])).rows[0];
  const payer=(await c.query('SELECT a.owner_id FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.id=$1',[id])).rows[0]?.owner_id;
  if(row&&row.recipient_id!==user)row.target_id=null;const writable=!!(await c.query("SELECT 1 FROM members m JOIN transactions t ON t.book_id=m.book_id WHERE t.id=$1 AND m.user_id=$2 AND m.role<>'viewer'",[id,user])).rowCount;return {claim:row||null,canOpen:!!row&&[row.sender_id,row.recipient_id].includes(user),canInvite:payer===user&&writable,canEdit:(!row||row.sender_id===user)&&!(await c.query('SELECT 1 FROM expense_claim_links WHERE target_id=$1 AND managed',[id])).rowCount};
 }
 if(method==='POST'&&path[1]==='invite'){
  const b=z.object({sourceId:uuid,recipientId:uuid.nullable()}).parse(body);
  const t=(await c.query('SELECT book_id FROM transactions WHERE id=$1',[b.sourceId])).rows[0];if(!t)throw new Failure('账单不存在',404);
  await lockRelatedBooks(c,t.book_id,b.sourceId,user);return inviteExpense(c,user,b.sourceId,b.recipientId);
 }
 const id=uuid.parse(path[1]);
 let claim=(await c.query('SELECT * FROM expense_claims WHERE id=$1',[id])).rows[0];if(!claim||![claim.sender_id,claim.recipient_id].includes(user))throw new Failure('认领不存在或无权访问',404);
 if(method==='GET'){
  const source=(await c.query("SELECT title,product,payee,category,note,line_items,amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date,deleted,(SELECT COALESCE(sum(r.amount),0)::float8 FROM transactions r WHERE r.refund_of=transactions.id AND NOT r.deleted) AS refunded FROM transactions WHERE id=$1",[claim.source_id])).rows[0];
  const people=(await c.query('SELECT id,name,avatar FROM users WHERE id=ANY($1::uuid[])',[[claim.sender_id,claim.recipient_id]])).rows;
  const books=(await c.query("SELECT b.id,b.name,b.icon,b.kind FROM books b JOIN members m ON m.book_id=b.id WHERE m.user_id=$1 AND m.role<>'viewer' ORDER BY b.created_at",[user])).rows;
  const target=claim.recipient_id===user&&claim.target_id?(await c.query('SELECT book_id FROM transactions WHERE id=$1',[claim.target_id])).rows[0]:null;
  return {claim:{...claim,source_id:undefined,event_id:undefined,target_id:claim.recipient_id===user?claim.target_id:null},source:['pending','accepted'].includes(claim.status)?source:claim.snapshot,people,books,userId:user,targetBookId:target?.book_id||null};
 }
 if(method!=='POST')throw new Failure('操作不存在',404);
 const sourceBook=(await c.query('SELECT book_id FROM transactions WHERE id=$1',[claim.source_id])).rows[0].book_id;
 const book=body.bookId?uuid.parse(body.bookId):undefined;
 await lockRelatedBooks(c,sourceBook,claim.source_id,user,book);
 claim=(await c.query('SELECT * FROM expense_claims WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(z.number().int().parse(body.version)!==claim.version)throw new Failure('账单或认领状态已变化，请刷新后重试',409);
 const op=z.enum(['accept','decline','withdraw','cancel','read']).parse(body.operation);
 if(op==='read'){await c.query('UPDATE expense_claim_events SET seen=true WHERE claim_id=$1 AND user_id=$2',[id,user]);return {ok:true};}
 if(['accept','decline','cancel'].includes(op)&&user!==claim.recipient_id||op==='withdraw'&&user!==claim.sender_id)throw new Failure('无权处理这笔认领',403);
 if(op==='accept'){
  await familyPair(c,claim.sender_id,claim.recipient_id);
  if(!['pending','accepted'].includes(claim.status))throw new Failure('这笔邀请已经结束');
  if(!book||!(await c.query("SELECT 1 FROM members WHERE book_id=$1 AND user_id=$2 AND role<>'viewer'",[book,user])).rowCount)throw new Failure('请选择自己可编辑的账本',403);
  const rows=(await c.query("SELECT t.*,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date FROM transactions t WHERE (id=$1 OR refund_of=$1) AND NOT deleted ORDER BY (id=$1) DESC,created_at",[claim.source_id])).rows;
  if(!rows.some(t=>t.id===claim.source_id))throw new Failure('原账单已删除');
  if(claim.status==='accepted')await removeLinks(c,id);
  let targetId='';for(const row of rows){const copy=await copyForClaim(c,claim,row,book);if(row.id===claim.source_id)targetId=copy.id;}
  await c.query("UPDATE expense_claims SET status='accepted',target_id=$2,version=version+1,updated_at=now() WHERE id=$1",[id,targetId]);await notify(c,id,claim.sender_id,'accepted');
 }else{
  if(op==='decline'&&claim.status!=='pending'||op==='cancel'&&claim.status!=='accepted'||op==='withdraw'&&!['pending','accepted'].includes(claim.status))throw new Failure('认领状态已变化，请刷新后重试',409);
  await removeLinks(c,id);
  await c.query('UPDATE expense_claims SET status=$2,version=version+1,updated_at=now() WHERE id=$1',[id,op==='decline'?'declined':'withdrawn']);await notify(c,id,user===claim.sender_id?claim.recipient_id:claim.sender_id,op);
 }
 await c.query('UPDATE expense_claim_events SET seen=true WHERE claim_id=$1 AND user_id=$2',[id,user]);return {ok:true};
});}
