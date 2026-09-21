import {familyInbox} from '@/server/family-inbox';
import {bookMovements} from '@/server/family-books';
import {familyFinance} from '@/server/family-finance';
import {listInstallments,changeInstallment} from '@/server/installments';
import {mergeAccounts} from '@/server/merge-accounts';
import {organize} from '@/server/organize';
import {moveEntry,movePreview,moveInTransaction,selectedGroup,withReceiptTransaction} from '@/server/move-entry';
import {deployment} from '@/lib/deployment';
import {checkDeploymentCurrency} from '@/server/deployment';
import {language,translate} from '@/lib/i18n';
import {LIST_PAGE_SIZE} from '@/lib/pagination';
import {families} from '@/server/families';
import {search,searchOptions} from '@/server/search';

import {receiptRoute,linkReceipts,authorizeImages} from '@/server/receipts';
import {checkVerification} from '@/lib/verification';
import {enqueue,ownedJob,watchJob} from '@/server/jobs';
import {financeChat} from '@/server/finance-chat';
import {reuse,overview,lockRelatedBooks,syncFinancialFacts} from '@/server/reuse';
import {profile,manageUser,bookMetadata,avatar} from '@/server/management';
import {allocations} from '@/server/allocations';
import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db,transaction } from '@/server/db';
import { user,member,session,passwordHash,verifyPassword,Failure } from '@/server/auth';
import { entry } from '@/server/model';
import {schedules} from '@/server/schedules';
import {report,exportCSV} from '@/server/reports';
import {listCategories,changeCategory,checkCategory,defaultCategories} from '@/server/categories';
import {templates} from '@/server/templates';
import {getDraft,saveDraft} from '@/server/drafts';
import {listAccounts,listAssets,createAccount,accountHistory,changeAccount,validateActiveAccounts,accountAccess,accountReport} from '@/server/accounts';
import {streamAnswer} from '@/server/stream';
import {details} from '@/server/intake';
import {recognize,review} from '@/server/recognize';
import {lockBook,validateRefund,insertEntry} from '@/server/ledger';
import { callModel,encrypt } from '@/server/ai';
export const runtime='nodejs';
const name=z.string().trim().min(1).max(80),uuid=z.string().uuid();
type Ctx={params:Promise<{path:string[]}>};
async function handle(req:NextRequest,ctx:Ctx){const locale=deployment().language;const tr=(s:string)=>translate(s,locale);try{
 await checkDeploymentCurrency();
 const path=(await ctx.params).path;const method=req.method;
 if(method!=='GET'&&req.headers.get('origin')!==process.env.APP_ORIGIN)throw new Failure('请求来源不匹配',403);
 if(path[0]==='receipts')return await receiptRoute(req,path,await user());
 const photoRequest=path[0]==='books'&&path.length===3&&['assistant','chat','drafts'].includes(path[2]);
 if(photoRequest&&method!=='GET')await user();
 if(!photoRequest&&Number(req.headers.get('content-length')||0)>35000000)throw new Failure('请求内容过大',413);
 const body=method==='GET'?{}:await req.json();if(body&&typeof body==='object'&&!Array.isArray(body))body.language=locale;
 if(path[0]==='health'){await db.query('SELECT 1');return NextResponse.json({ok:true,app:'tallybear'});}
 if(path[0]==='login'&&method==='POST'){
  const input=z.object({username:name,password:z.string().min(1).max(200)}).parse(body);
  const rate=await db.query("INSERT INTO login_attempts(username,count) VALUES($1,1) ON CONFLICT(username) DO UPDATE SET count=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END,window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING count",[input.username]);
  if(rate.rows[0].count>15)throw new Failure('登录尝试过多，请15分钟后再试',429);
  const {rows}=await db.query('SELECT * FROM users WHERE username=$1',[input.username]);if(!rows[0]||rows[0].disabled||!verifyPassword(input.password,rows[0].password))throw new Failure('账号或密码不正确',401);
  await db.query('DELETE FROM login_attempts WHERE username=$1',[input.username]);await session(rows[0].id);return NextResponse.json({ok:true});
 }
 const u=await user();
 if(path[0]==='family-inbox'&&method==='GET')return NextResponse.json(await familyInbox(u.id,req.nextUrl.searchParams));
 if(path[0]==='book-movements'&&method==='GET')return NextResponse.json(await bookMovements(u.id,path[1],req.nextUrl.searchParams));
 if(path[0]==='family-finance')return NextResponse.json(await familyFinance(u.id,path[1],method,body));
 if(path[0]==='families')return NextResponse.json(await families(u.id,method,path,body));
 if(path[0]==='search-options'&&method==='GET')return NextResponse.json(await searchOptions(u.id,req.nextUrl.searchParams));
 if(path[0]==='search'&&method==='GET')return NextResponse.json(await search(u.id,req.nextUrl.searchParams));
 if(path[0]==='queue-settings'){
  if(!u.admin)throw new Failure('需要管理员权限',403);
  if(method==='PUT'){const n=z.number().int().min(1).max(8).parse(body.concurrency);await db.query('UPDATE ai_queue_settings SET concurrency=$1 WHERE id=1',[n]);}
  return NextResponse.json((await db.query('SELECT concurrency FROM ai_queue_settings WHERE id=1')).rows[0]);
 }
 if(path[0]==='jobs'){
  if(!path[1]&&method==='GET')return NextResponse.json((await db.query(`SELECT j.id,j.kind,j.status,j.stage,j.error,j.book_id,b.name AS book_name,j.created_at,j.started_at,j.finished_at FROM ai_jobs j LEFT JOIN books b ON b.id=j.book_id WHERE j.user_id=$1 AND (j.book_id IS NULL OR EXISTS(SELECT 1 FROM members m WHERE m.book_id=j.book_id AND m.user_id=$1)) ORDER BY j.created_at DESC LIMIT 100`,[u.id])).rows);
  const id=uuid.parse(path[1]);const j=await ownedJob(id,u);
  if(method==='GET'){if(req.nextUrl.searchParams.get('stream')==='1')return watchJob(id,req.signal);const {payload,...safe}=j;return NextResponse.json(safe);}
  if(method==='POST'&&body.operation==='retry'){if(j.book_id)await member(j.book_id,u,j.kind==='assistant');await transaction(async c=>{if(j.kind==='chat'){await c.query('SELECT id FROM finance_conversations WHERE id=$1 FOR UPDATE',[j.payload.id]);const later=await c.query('SELECT 1 FROM finance_turns WHERE conversation_id=$1 AND created_at>(SELECT created_at FROM finance_turns WHERE id=$2)',[j.payload.id,id]);if(later.rowCount)throw new Failure('已有后续对话，请在对话中重新发送问题');}const r=await c.query("UPDATE ai_jobs SET status='queued',stage='等待续跑',error='',cancel_requested=false,finished_at=NULL WHERE id=$1 AND status IN ('error','cancelled') AND (kind='connection' OR payload<>'{}'::jsonb) RETURNING id",[id]);if(!r.rowCount)throw new Failure('这个任务不能续跑，请重新提交',409);await c.query('DELETE FROM ai_job_events WHERE job_id=$1',[id]);if(j.kind==='chat')await c.query("UPDATE finance_turns SET status='running',error='' WHERE id=$1",[id]);});return NextResponse.json({ok:true});}
  if(method==='POST'&&body.operation==='cancel'){await transaction(async c=>{const row=(await c.query('SELECT status FROM ai_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];if(row.status==='queued'){await c.query("UPDATE ai_jobs SET status='cancelled',stage='已取消',error='任务已取消',finished_at=now(),cancel_requested=true WHERE id=$1",[id]);await c.query("UPDATE finance_turns SET status='stopped',error='任务已取消' WHERE id=$1",[id]);}else if(row.status==='running')await c.query('UPDATE ai_jobs SET cancel_requested=true WHERE id=$1',[id]);});return NextResponse.json({ok:true});}
  throw new Failure('操作不存在',404);
 }
 if(path[0]==='me'){if(method==='PATCH'){const t=z.enum(['bear','minimal']).parse(body.theme);await db.query('UPDATE users SET theme=$1 WHERE id=$2',[t,u.id]);return NextResponse.json({ok:true,theme:t});}if(method==='GET')return NextResponse.json(u);if(method==='PUT')return NextResponse.json(await profile(u,body));}
 if(path[0]==='logout'&&method==='POST'){const jar=await cookies();await db.query('DELETE FROM sessions WHERE id=$1',[jar.get('bubu_session')?.value]);jar.delete('bubu_session');return NextResponse.json({ok:true});}
 if(path[0]==='password'&&method==='PUT'){const b=z.object({oldPassword:z.string(),newPassword:z.string().min(1).max(200)}).parse(body);const row=(await db.query('SELECT password FROM users WHERE id=$1',[u.id])).rows[0];if(!verifyPassword(b.oldPassword,row.password))throw new Failure('当前密码不正确',403);const token=(await cookies()).get('bubu_session')?.value;await transaction(async c=>{await c.query('UPDATE users SET password=$1 WHERE id=$2',[passwordHash(b.newPassword),u.id]);await c.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2',[u.id,token]);});return NextResponse.json({ok:true});}
 if(path[0]==='users'){
  if(!u.admin)throw new Failure('需要管理员权限',403);
  if(method==='GET')return NextResponse.json((await db.query('SELECT id,username,name,admin,avatar,disabled FROM users ORDER BY created_at')).rows);
  if(method==='PATCH')return NextResponse.json(await manageUser(u,body));
  if(method==='POST'){const b=z.object({username:name,name,password:z.string().min(1).max(200),avatar:avatar.default('🧸')}).parse(body);await db.query('INSERT INTO users(id,username,name,password,avatar) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.username,b.name,passwordHash(b.password),b.avatar]);return NextResponse.json({ok:true});}
 }
 if(path[0]==='installments'){if(method==='GET')return NextResponse.json(await listInstallments(u.id));if(method==='POST')return NextResponse.json(await changeInstallment(u.id,body));}
 if(path[0]==='assets'){
  if(path[1]==='merge'&&method==='POST')return NextResponse.json(await mergeAccounts(u.id,body));
  if(path[1]==='report'&&method==='GET')return NextResponse.json(await accountReport(u.id,req.nextUrl.searchParams));
  if(path[1]==='history'&&method==='GET')return NextResponse.json(await accountHistory(u.id,uuid.parse(req.nextUrl.searchParams.get('account'))));
  if(method==='GET')return NextResponse.json(await listAssets(u.id));
  if(method==='POST')return NextResponse.json(await createAccount(u.id,body));
  if(method==='PATCH')return NextResponse.json(await changeAccount(u.id,body));
 }
 if(path[0]==='overview'&&method==='GET')return NextResponse.json(await overview(u.id,req.nextUrl.searchParams));
 if(path[0]==='ai-settings'){
  if(!u.admin)throw new Failure('需要管理员权限',403);
  if(method==='GET'){const {rows}=await db.query('SELECT base_url AS "baseUrl",model,vision_model AS "visionModel",true AS "hasKey" FROM ai_settings WHERE id=1');return NextResponse.json(rows[0]||{});}
  if(method==='PUT'){const b=z.object({baseUrl:z.string().url().refine(s=>s.startsWith('https://'),'模型地址需使用HTTPS'),model:name,visionModel:name,key:z.string().max(500).optional()}).parse(body);const old=(await db.query('SELECT encrypted_key FROM ai_settings WHERE id=1')).rows[0];if(!b.key&&!old)throw new Failure('首次配置需要填写API Key');await db.query('INSERT INTO ai_settings VALUES(1,$1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET base_url=$1,model=$2,vision_model=$3,encrypted_key=$4',[b.baseUrl,b.model,b.visionModel,b.key?encrypt(b.key):old.encrypted_key]);return NextResponse.json({ok:true});}
  if(method==='POST'){const id=await enqueue(u,null,'connection',{});return body.background?NextResponse.json({jobId:id},{status:202}):watchJob(id,req.signal);}
 }
 if(path[0]!=='books')throw new Failure('页面不存在',404);
 if(path.length===1){
  if(method==='GET')return NextResponse.json((await db.query('SELECT b.*,m.role,f.name AS family_name FROM books b JOIN members m ON m.book_id=b.id LEFT JOIN families f ON f.id=b.family_id WHERE m.user_id=$1 ORDER BY b.created_at',[u.id])).rows);
  if(method==='POST'){const b=z.object({name,kind:z.enum(['private','shared'])}).parse(body);const id=randomUUID();await transaction(async c=>{await c.query('INSERT INTO books(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[id,b.name,b.kind,u.id]);await c.query('INSERT INTO members VALUES($1,$2,$3)',[id,u.id,'owner']);if(locale==='en')for(const [label,icon] of defaultCategories){await c.query('INSERT INTO category_preferences(book_id,name,icon,archived,deleted) VALUES($1,$2,$3,false,false),($1,$4,$3,true,true)',[id,tr(label),icon,label]);}});return NextResponse.json({id});}
 }
 const book=uuid.parse(path[1]);const resource=path[2];await member(book,u,method!=='GET'&&resource!=='chat',['members','metadata'].includes(resource)&&method!=='GET');
 if(resource==='chat'){const result=await financeChat(book,u,method,body,req.nextUrl.searchParams,req.signal);return result instanceof Response?result:NextResponse.json(result);}
 if(resource==='organize'){if(method==='GET')return NextResponse.json(await movePreview(book,req.nextUrl.searchParams.getAll('id')));if(method==='POST')return NextResponse.json(await organize(book,u.id,body));}
 if(resource==='move'){if(method==='GET')return NextResponse.json(await movePreview(book,req.nextUrl.searchParams.get('id')||''));if(method==='POST')return NextResponse.json(await moveEntry(book,u.id,body));}
 if(resource==='reuse'&&method==='POST')return NextResponse.json(await reuse(book,u.id,body));
 if(resource==='metadata'&&method==='PUT')return NextResponse.json(await bookMetadata(book,body));
 if(resource==='allocations'&&(method==='GET'||method==='PUT'))return NextResponse.json(await allocations(book,method,body,req.nextUrl.searchParams));
 if(resource==='chart-details'&&method==='GET'){const ids=z.array(z.string().uuid()).min(1).parse(req.nextUrl.searchParams.getAll('book'));for(const id of ids)await member(id,u);return NextResponse.json(await report(ids,req.nextUrl.searchParams));}
 if(resource==='report'&&method==='GET')return NextResponse.json(await report(book,req.nextUrl.searchParams));
 if(resource==='export'&&method==='GET')return new Response(await exportCSV(book,req.nextUrl.searchParams,locale),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=ledger.csv','Cache-Control':'no-store'}});
 if(resource==='categories'){if(method==='GET')return NextResponse.json(await listCategories(book));if(method==='PUT')return NextResponse.json(await changeCategory(book,body));}
 if(resource==='schedules')return NextResponse.json(await schedules(book,u.id,method,body));
 if(resource==='templates')return NextResponse.json(await templates(book,u.id,method,body));
 if(resource==='drafts'){if(method==='GET')return NextResponse.json(await getDraft(book,u.id,req.nextUrl.searchParams.get('section')));if(method==='PUT')return NextResponse.json(await saveDraft(book,u.id,body));}
 if(resource==='members'){
  if(method==='GET')return NextResponse.json((await db.query('SELECT u.id,u.name,u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.book_id=$1',[book])).rows);
  if(method==='POST'){const b=z.object({username:name,role:z.enum(['editor','viewer'])}).parse(body);const type=(await db.query('SELECT kind FROM books WHERE id=$1',[book])).rows[0];if(type.kind!=='shared')throw new Failure('私人账本不能添加其他成员');const target=(await db.query('SELECT id FROM users WHERE username=$1',[b.username])).rows[0];if(!target)throw new Failure('账号不存在，请管理员先创建账号');if(target.id===u.id)throw new Failure('不能更改自己的所有者权限');await db.query('INSERT INTO members VALUES($1,$2,$3) ON CONFLICT(book_id,user_id) DO UPDATE SET role=$3',[book,target.id,b.role]);return NextResponse.json({ok:true});}
  if(method==='DELETE'){const id=uuid.parse(body.id);await db.query("DELETE FROM members WHERE book_id=$1 AND user_id=$2 AND role<>'owner'",[book,id]);return NextResponse.json({ok:true});}
 }
 if(resource==='refund-options'&&method==='GET'){
  const q=z.string().max(200).parse(req.nextUrl.searchParams.get('q')||'');const idValue=req.nextUrl.searchParams.get('id'),excludeValue=req.nextUrl.searchParams.get('exclude');const id=idValue?uuid.parse(idValue):null,exclude=excludeValue?uuid.parse(excludeValue):null;
  return NextResponse.json((await db.query("SELECT t.id,t.kind,t.payee,t.product,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,(t.amount-COALESCE((SELECT sum(r.amount) FROM transactions r WHERE r.refund_of=t.id AND NOT r.deleted AND ($4::uuid IS NULL OR r.id<>$4)),0))::float8 AS remaining FROM transactions t WHERE t.book_id=$1 AND t.kind='expense' AND NOT t.deleted AND ($3::uuid IS NULL OR t.id=$3) AND ($2='' OR strpos(lower(concat_ws(' ',t.payee,t.product,t.order_id,t.date::text)),lower($2))>0) ORDER BY t.date DESC,t.created_at DESC,t.id DESC LIMIT 30",[book,q,id,exclude])).rows);
 }

 if(resource==='accounts'&&method==='GET')return NextResponse.json(await listAccounts(book,u.id));
 if(resource==='attention'&&method==='GET'){const trash=req.nextUrl.searchParams.get('mode')==='trash';const offset=z.coerce.number().int().min(0).parse(req.nextUrl.searchParams.get('offset')||0);return NextResponse.json((await db.query(`SELECT t.*,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,a.name AS account_name,u.name AS creator_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by WHERE t.book_id=$1 AND t.deleted=$2 AND ($2 OR (jsonb_array_length(t.line_items)>0 AND (EXISTS(SELECT 1 FROM jsonb_array_elements(t.line_items) item WHERE item->>'amount' IS NULL) OR (SELECT sum((item->>'amount')::bigint) FROM jsonb_array_elements(t.line_items) item)<>t.amount))) ORDER BY t.created_at DESC,t.id LIMIT $4 OFFSET $3`,[book,trash,offset,LIST_PAGE_SIZE])).rows);}
 if(resource==='receipts'&&method==='GET')return NextResponse.json((await db.query('SELECT f.id,f.name,r.purpose FROM receipt_files f JOIN transaction_receipts r ON r.file_id=f.id JOIN transactions t ON t.id=r.transaction_id WHERE t.book_id=$1 AND t.id=$2',[book,uuid.parse(req.nextUrl.searchParams.get('transaction'))])).rows);
 if(resource==='photos'&&(method==='POST'||method==='DELETE')){
  const b=z.object({transaction:uuid,ids:z.array(uuid)}).parse(body);
  await transaction(async c=>{
   const t=await c.query('SELECT id FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted FOR UPDATE',[b.transaction,book]);if(!t.rowCount)throw new Failure('账目不存在',404);
   if(method==='POST')await linkReceipts(c,book,u.id,b.transaction,b.ids,true,'photo');
   else for(const id of b.ids){await c.query("DELETE FROM transaction_receipts WHERE transaction_id=$1 AND file_id=$2 AND purpose='photo'",[b.transaction,id]);await c.query('UPDATE receipt_files SET temporary=true,created_at=now() WHERE id=$1 AND book_id=$2 AND NOT EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=$1)',[id,book]);}
  });return NextResponse.json({ok:true});
 }
 if(resource==='transactions'){
  if(method==='GET'){const month=req.nextUrl.searchParams.get('month');const args:unknown[]=[book];let filter='';if(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Failure('月份无效');args.push(month+'-01');filter=" AND t.date >= $2::date AND t.date < $2::date+interval '1 month'";}return NextResponse.json((await db.query('SELECT t.*,t.amount::float8 AS amount,to_char(t.date,\'YYYY-MM-DD\') AS date,a.name AS account_name,a.type AS account_type,a.holder AS account_holder,a.institution AS account_institution,a.suffix AS account_suffix,a.ownership AS account_ownership,(SELECT json_build_object(\'name\',dest.name,\'type\',dest.type,\'holder\',dest.holder,\'institution\',dest.institution,\'suffix\',dest.suffix,\'ownership\',dest.ownership) FROM accounts dest WHERE dest.id=t.target_id) AS target_account,(SELECT name FROM accounts dest WHERE dest.id=t.target_id) AS target_name,u.name AS creator_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by WHERE t.book_id=$1 AND NOT t.deleted'+filter+' ORDER BY t.date DESC,t.created_at DESC LIMIT 10000',args)).rows);}
  if(method==='POST'){
   const items=z.array(z.object({action:z.enum(['create','skip','merge']).default('create'),mergeId:uuid.optional(),mergeVersion:z.number().int().optional()}).passthrough()).min(1).max(1000).parse(body.entries);const targetBook=body.targetBook?uuid.parse(body.targetBook):book;const destinations=new Map(items.map(raw=>[raw.id,raw.targetBook?uuid.parse(raw.targetBook):targetBook]));let added=0,merged=0;
   await withReceiptTransaction(async(c,copied)=>{for(const id of [...new Set([book,...destinations.values()])].sort())await lockBook(c,id);const created:string[]=[];
    for(const raw of [...items].sort((a,b)=>Number(a.kind==='refund')-Number(b.kind==='refund'))){
     if(raw.action==='skip')continue;
     if(raw.action==='merge'){
      if(destinations.get(raw.id)!==book)throw new Failure('补充已有记录请保留原账本，随后使用整理账单移动');
      if(!raw.mergeId||!raw.mergeVersion)throw new Failure('请选择要补充的已有记录');
      const d=z.object({...details,payee:z.string().max(120).default(''),category:z.string().max(60).default('其他'),note:z.string().max(2000).default('')}).parse(raw);
      const old=(await c.query('SELECT * FROM transactions WHERE book_id=$1 AND id=$2 AND version=$3 AND NOT deleted',[book,raw.mergeId,raw.mergeVersion])).rows[0];if(!old)throw new Failure('原记录已改变，请重新检查重复',409);
      if(!old.title&&d.title)await c.query('UPDATE transactions SET title=$1 WHERE id=$2',[d.title,raw.mergeId]);
      // Enrichment never changes an existing amount, account, date or transaction type.
      checkVerification(old.line_items?.length?old.line_items:d.lineItems,Number(old.amount),d.verificationReason||old.verification_reason);await linkReceipts(c,book,u.id,raw.mergeId!,d.attachmentIds,d.retainReceipts);await linkReceipts(c,book,u.id,raw.mergeId!,d.photoIds,true,'photo');if(d.verificationReason)await c.query('UPDATE transactions SET verification_reason=$1 WHERE id=$2',[d.verificationReason,raw.mergeId]);
      const result=await c.query("UPDATE transactions SET product=$1,order_id=$2,platform=$3,occurred_at=$4,note=$5,payee=$6,category=$7,line_items=$10::jsonb,version=version+1 WHERE book_id=$8 AND id=$9",[old.product||d.product,old.order_id||d.orderId,old.platform||d.platform,old.occurred_at||d.occurredAt,old.note||d.note,old.payee||d.payee,old.category==='其他'?d.category:old.category,book,raw.mergeId,JSON.stringify(old.line_items?.length?old.line_items:d.lineItems)]);await c.query("UPDATE transactions SET scene=$1::jsonb WHERE id=$2",[JSON.stringify({...d.scene,...Object.fromEntries(Object.entries(old.scene||{}).filter(([k,v])=>v&&!(k==='type'&&v==='general')))}),raw.mergeId]);merged+=result.rowCount||0;if(old.kind==='expense')await c.query('UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND refund_of=$3 AND NOT deleted',[old.category==='其他'?d.category:old.category,book,raw.mergeId]);continue;
     }
     const e=entry.parse(raw);const count=await insertEntry(c,book,u.id,e);added+=count;if(count)created.push(e.id);
    }
    const groups=new Map<string,any[]>();for(const id of created){const dest=destinations.get(id)!;if(dest===book)continue;const rows=await selectedGroup(c,book,[id]);if(rows.some(r=>created.includes(r.id)&&destinations.get(r.id)!==dest))throw new Failure('同一笔原消费与退款请选择相同账本');if(dest!==book){const previous=groups.get(dest)||[];groups.set(dest,[...new Map([...previous,...rows].map(r=>[r.id,r])).values()]);}}for(const [dest,rows] of groups)await moveInTransaction(c,book,u.id,dest,rows,copied);
   });return NextResponse.json({added,merged,skipped:items.length-added-merged});
  }
  if(method==='PUT'){const targetBook=body.targetBook?uuid.parse(body.targetBook):book;const e=entry.parse(body);checkVerification(e.lineItems,e.amount,e.verificationReason);const version=z.number().int().parse(body.version);const result=await withReceiptTransaction(async(c,copied)=>{await lockRelatedBooks(c,book,e.id,u.id,targetBook);const previous=(await c.query("SELECT account_id,target_id,category,line_items,verification_reason,amount::float8 AS amount,kind,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE book_id=$1 AND id=$2",[book,e.id])).rows[0];if(body.lineItems===undefined&&previous)e.lineItems=previous.line_items;if(body.verificationReason===undefined&&previous)e.verificationReason=previous.verification_reason;checkVerification(e.lineItems,e.amount,e.verificationReason);await validateActiveAccounts(c,book,e,u.id,previous?[previous.account_id,previous.target_id].filter(Boolean):[]);if(previous&&(previous.amount!==e.amount||previous.kind!==e.kind||previous.date!==e.date||previous.account_id!==e.accountId||previous.target_id!==(e.targetId||null))){if((await c.query(`SELECT 1 FROM accounts a WHERE a.id=ANY($1::uuid[]) AND NOT ${accountAccess('$2')}`,[[previous.account_id,previous.target_id].filter(Boolean),u.id])).rowCount)throw new Failure('只有资产所有者或家庭成员可以修改实际收付款信息',403);await validateActiveAccounts(c,book,e,u.id);}await validateRefund(c,book,e);await checkCategory(c,book,e.category,previous?.category);await syncFinancialFacts(c,book,e,u.id);const r=await c.query('UPDATE transactions SET account_id=$1,target_id=$2,kind=$3,amount=$4,date=$5,payee=$6,category=$7,note=$8,product=$12,platform=$13,order_id=$14,occurred_at=$15,refund_of=$16,line_items=COALESCE($17::jsonb,line_items),version=version+1 WHERE id=$9 AND book_id=$10 AND version=$11 AND NOT deleted RETURNING version',[e.accountId,e.kind==='transfer'?e.targetId:null,e.kind,e.amount,e.date,e.payee,e.category,e.note,e.id,book,version,e.product,e.platform,e.orderId,e.occurredAt,e.refundOf||null,body.lineItems===undefined?null:JSON.stringify(e.lineItems)]);if(!r.rowCount)throw new Failure('记录已被其他成员修改，请刷新后再试',409);await c.query('UPDATE transactions SET verification_reason=$1,title=COALESCE($3,title),scene=COALESCE($4::jsonb,scene) WHERE id=$2',[e.verificationReason,e.id,body.title===undefined?null:e.title,body.scene===undefined?null:JSON.stringify(e.scene)]);await linkReceipts(c,book,u.id,e.id,e.attachmentIds,e.retainReceipts);await linkReceipts(c,book,u.id,e.id,e.photoIds,true,'photo');if(e.kind==='expense')await c.query('UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND refund_of=$3 AND NOT deleted',[e.category,book,e.id]);if(targetBook!==book)await moveInTransaction(c,book,u.id,targetBook,await selectedGroup(c,book,[e.id]),copied);return {...r.rows[0],book:targetBook};});return NextResponse.json(result);}
  if(method==='DELETE'||method==='PATCH'){const b=z.object({id:uuid,version:z.number().int(),deleted:z.boolean().optional()}).parse(body);const deleted=method==='DELETE'?true:b.deleted??false;const result=await transaction(async c=>{await lockBook(c,book);const assetEntry=(await c.query('SELECT account_id AS "accountId",target_id AS "targetId",kind FROM transactions WHERE id=$1 AND book_id=$2',[b.id,book])).rows[0];if(assetEntry)await validateActiveAccounts(c,book,assetEntry,u.id,[assetEntry.accountId,assetEntry.targetId].filter(Boolean));if(deleted){const links=await c.query('SELECT id FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted',[book,b.id]);if(links.rowCount)throw new Failure('原消费关联了退款，请先处理退款记录');}else{const row=(await c.query(`SELECT *,account_id AS "accountId",target_id AS "targetId",refund_of AS "refundOf",amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE book_id=$1 AND id=$2`,[book,b.id])).rows[0];if(row)await validateRefund(c,book,row);}
   const r=await c.query('UPDATE transactions SET deleted=$1,version=version+1 WHERE id=$2 AND book_id=$3 AND version=$4 RETURNING version',[deleted,b.id,book,b.version]);if(!r.rowCount)throw new Failure('记录已被其他成员修改，请刷新后再试',409);return r.rows[0];});return NextResponse.json(result);}

 }
 if(resource==='budgets'){
  const month=method==='GET'?req.nextUrl.searchParams.get('month'):body.month;if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Failure('月份无效');
  if(method==='GET')return NextResponse.json((await db.query('SELECT category,amount::float8 AS amount FROM budgets WHERE book_id=$1 AND month=$2',[book,month])).rows);
  if(method==='DELETE'){const category=name.parse(body.category);await db.query('DELETE FROM budgets WHERE book_id=$1 AND month=$2 AND category=$3',[book,month,category]);return NextResponse.json({ok:true});}
  if(method==='PUT'){const b=z.object({category:name,amount:z.number().int().nonnegative().max(100000000000)}).parse(body);await db.query('INSERT INTO budgets VALUES($1,$2,$3,$4) ON CONFLICT(book_id,month,category) DO UPDATE SET amount=$4',[book,month,b.category,b.amount]);return NextResponse.json({ok:true});}
 }
 if(resource==='review'&&method==='POST')return NextResponse.json(await review(book,body));
 if(resource==='assistant'&&method==='POST'){
  const id=await enqueue(u,book,'assistant',body);return body.background===true?NextResponse.json({jobId:id},{status:202}):watchJob(id,req.signal);
 }

 throw new Failure('操作不存在',404);
}catch(e){if(e instanceof Error&&e.name==='VerificationError')return NextResponse.json({error:tr(e.message)},{status:400});if(e instanceof z.ZodError)return NextResponse.json({error:e.issues[0]?.message||'填写内容无效'},{status:400});if(e instanceof Failure)return NextResponse.json({error:tr(e.message)},{status:e.status});const code=(e as {code?:string}).code;if(code==='P0001')return NextResponse.json({error:tr((e as Error).message)},{status:409});if(code==='23505')return NextResponse.json({error:tr('名称或账号已存在')},{status:409});if(code==='23503')return NextResponse.json({error:tr('账户不存在或不属于当前账本')},{status:400});console.error('API operation failed',e instanceof Error?e.name:'unknown');return NextResponse.json({error:tr('操作未完成，请稍后重试')},{status:500});}}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE};
