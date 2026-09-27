import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {Failure} from './access';
import {familyFinance} from './family-finance';
import {calculateCostPlan,costReport,costPlanSchema,type CostPlan} from '@/lib/cost-attribution';

const uuid=z.string().uuid();
type Project={id:string;owner_id:string;family_id:string|null;title:string;version:number;archived:boolean;active_stale?:boolean;active_plan:CostPlan|null;proposed_plan:CostPlan|null};
async function authorized(c:PoolClient,user:string,id:string){
 const p=(await c.query(`SELECT p.* FROM cost_projects p WHERE p.id=$1 AND (p.owner_id=$2 OR EXISTS(SELECT 1 FROM cost_project_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=p.family_id WHERE m.project_id=p.id AND m.user_id=$2)) FOR UPDATE OF p`,[id,user])).rows[0] as Project|undefined;
 if(!p)throw new Failure('费用项目不存在或无权访问',404);return p;
}
async function source(c:PoolClient,user:string,id:string,kind:string){
 let row=(await c.query(`SELECT t.*,a.owner_id,a.family_id FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE t.id=$1 AND NOT t.deleted AND t.kind=$3 AND m.role<>'viewer'`,[id,user,kind])).rows[0];
 if(!row||row.owner_id!==user)throw new Failure('请选择本人钱包支付或收到、且可编辑的原始账单',403);
 // Lock all display copies, so two different books cannot reserve the same payment twice.
 await c.query('SELECT id FROM transactions WHERE COALESCE(event_id,id)=$1 ORDER BY id FOR UPDATE',[row.event_id||row.id]);
 row=(await c.query(`SELECT t.*,a.owner_id,a.family_id FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN members m ON m.book_id=t.book_id AND m.user_id=$2 WHERE t.id=$1 AND NOT t.deleted AND t.kind=$3 AND m.role<>'viewer'`,[id,user,kind])).rows[0];
 if(!row||row.owner_id!==user)throw new Failure('原账单已变化，请重新选择',409);
 const refunded=kind==='expense'?Number((await c.query(`SELECT COALESCE(sum(amount),0) AS value FROM (SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions original ON original.id=r.refund_of WHERE COALESCE(original.event_id,original.id)=$1 AND r.kind='refund' AND NOT r.deleted ORDER BY COALESCE(r.event_id,r.id),r.created_at) x`,[row.event_id||row.id])).rows[0].value):0;
 return {...row,amount:Number(row.amount),available:Math.max(0,Number(row.amount)-refunded)};
}
async function claims(c:PoolClient,p:Project,plans:CostPlan[]){
 const required=new Map<string,{transactionId:string;amount:number;kind:string}>();
 for(const plan of plans){
  const one=new Map<string,{transactionId:string;amount:number;kind:string}>();
  for(const s of plan.sources)one.set(s.transactionId,{...s,kind:'expense'});
  for(const o of plan.offsets.filter(o=>o.transactionId)){const id=o.transactionId!;one.set(id,{transactionId:id,kind:'income',amount:(one.get(id)?.amount||0)+o.amount});}
  for(const [id,r] of one){if(r.amount>(required.get(id)?.amount||0))required.set(id,r);}
 }
 const reservations=new Map<string,{row:any;amount:number;kind:string}>();
 for(const r of [...required.values()].sort((a,b)=>a.transactionId.localeCompare(b.transactionId))){
  const row=await source(c,p.owner_id,r.transactionId,r.kind),event=row.event_id||row.id;
  if(reservations.has(event))throw new Failure('同一笔付款的不同账本副本不能重复关联');
  if(r.kind==='expense'&&(await c.query('SELECT 1 FROM expense_allocations a JOIN transactions t ON t.id=a.transaction_id WHERE COALESCE(t.event_id,t.id)=$1',[event])).rowCount)throw new Failure('该账单已有旧版费用分摊，请先取消旧分摊再关联');
  const used=Number((await c.query('SELECT COALESCE(sum(amount),0) AS amount FROM (SELECT amount FROM cost_source_claims WHERE event_id=$1 AND project_id<>$2 UNION ALL SELECT amount FROM cost_member_income_claims WHERE event_id=$1) claims',[event,p.id])).rows[0].amount);
  if(used+r.amount>row.available)throw new Failure('关联金额超过原交易尚可分配的金额');
  reservations.set(event,{row,amount:r.amount,kind:r.kind});
 }
 await c.query('DELETE FROM cost_source_claims WHERE project_id=$1',[p.id]);
 for(const [event,{row,amount,kind}] of reservations)await c.query('INSERT INTO cost_source_claims(project_id,transaction_id,event_id,kind,amount,source_amount,account_id,date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.id,row.id,event,kind,amount,row.available,row.account_id,row.date]);
}
export async function validSources(c:PoolClient,p:Project){
 const rows=(await c.query('SELECT * FROM cost_source_claims WHERE project_id=$1 ORDER BY transaction_id',[p.id])).rows;
 if(!rows.length)return false;
 for(const r of rows){try{const current=await source(c,p.owner_id,r.transaction_id,r.kind);if(current.available!==Number(r.source_amount)||current.account_id!==r.account_id||String(current.date)!==String(r.date))return false;}catch(e){if(e instanceof Failure)return false;throw e;}}
 return true;
}
async function eligible(c:PoolClient,user:string,plan:CostPlan){
 const ids=plan.shares.map(s=>s.userId);
 if(!ids.includes(user))throw new Failure('承担成员中须包含项目所有者');
 if(ids.some(id=>id!==user)){
  if(!plan.familyId)throw new Failure('多人分担请选择家庭');
  const members=(await c.query('SELECT user_id FROM family_members WHERE family_id=$1 AND user_id=ANY($2::uuid[])',[plan.familyId,ids])).rows;
  if(members.length!==ids.length)throw new Failure('承担人必须仍在所选家庭中');
 }
 if(plan.offsets.some(o=>o.userId!==user&&!o.shared))throw new Failure('抵减他人的费用需要明确共享');
}
async function record(c:PoolClient,p:Project,user:string,operation:string){await c.query('INSERT INTO cost_project_changes(project_id,actor_id,operation,version) VALUES($1,$2,$3,$4)',[p.id,user,operation,p.version]);}
async function memberOffsets(c:PoolClient,p:Project,user:string,sharedOnly=false){
 const rows=(await c.query('SELECT * FROM cost_member_offsets WHERE project_id=$1',[p.id])).rows;
 const offsets:CostPlan['offsets']=[];
 for(const row of rows){
  const entries=(row.entries as CostPlan['offsets']).filter(o=>sharedOnly?o.shared:row.user_id===user||o.shared);
  if(!entries.length)continue;
  let valid=true;
  for(const claim of (await c.query('SELECT * FROM cost_member_income_claims WHERE project_id=$1 AND user_id=$2',[p.id,row.user_id])).rows){try{const s=await source(c,row.user_id,claim.transaction_id,'income');if(s.available!==Number(claim.source_amount)||s.account_id!==claim.account_id||String(s.date)!==String(claim.date))valid=false;}catch(e){if(e instanceof Failure)valid=false;else throw e;}}
  // A changed income ceases to be a realized offset; its intended amount remains an estimate.
  offsets.push(...entries.map(o=>valid?o:{...o,transactionId:null}));
 }return offsets;
}
async function detail(c:PoolClient,p:Project,user:string,params:URLSearchParams){
 const plan=p.active_plan||p.proposed_plan!,preview=calculateCostPlan(plan),valid=!p.active_stale&&await validSources(c,p);
 const members=(await c.query('SELECT m.user_id,m.accepted_version,m.display_book_id,u.name FROM cost_project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=$1 ORDER BY u.name',[p.id])).rows;
 const from=params.get('from')||preview.periods[0].start,to=params.get('to')||new Date(Date.parse(preview.periods.at(-1)!.end)-86400000).toISOString().slice(0,10);
 const extra=await memberOffsets(c,p,user);
 const personal=costReport({...plan,offsets:[...plan.offsets,...extra]},from,to,user),household=costReport({...plan,offsets:[...plan.offsets,...extra.filter(o=>o.shared)]},from,to,undefined,true);
 const movements=(await c.query(`SELECT s.movement_id,s.amount::float8 AS amount,m.sender_id,m.recipient_id,m.status,to_char(m.date,'YYYY-MM-DD') AS date,m.note FROM cost_settlements s JOIN family_movements m ON m.id=s.movement_id WHERE s.project_id=$1 ORDER BY m.created_at DESC,m.id`,[p.id])).rows;
 const paid=preview.total; // Sources in this release are owned and paid by the project owner.
 const settlement=plan.shares.map(s=>{
  const assigned=plan.offsets.filter(o=>o.transactionId&&o.userId===s.userId).reduce((n,o)=>n+o.amount,0);
  const income=s.userId===p.owner_id?plan.offsets.filter(o=>o.transactionId).reduce((n,o)=>n+o.amount,0):0;
  const transfers=movements.filter(m=>m.status==='confirmed').reduce((n,m)=>n+(m.sender_id===s.userId?m.amount:0)-(m.recipient_id===s.userId?m.amount:0),0);
  return {userId:s.userId,balance:(s.userId===p.owner_id?paid:0)-income-(s.amount-assigned)+transfers};
 });
 const changes=(await c.query('SELECT operation,version,created_at FROM cost_project_changes WHERE project_id=$1 ORDER BY id DESC LIMIT 100',[p.id])).rows;
 return {id:p.id,title:p.title,version:p.version,archived:p.archived,ownerId:p.owner_id,familyId:p.family_id,pending:!!p.proposed_plan,active:!!p.active_plan,valid,members,
  plan:user===p.owner_id?plan:undefined,proposedPlan:user===p.owner_id?p.proposed_plan:undefined,
  coverageStart:plan.coverageStart,coverageEnd:plan.coverageEnd,category:plan.category,total:preview.total,
  periods:preview.periods,proposedPeriods:p.proposed_plan?calculateCostPlan(p.proposed_plan).periods:undefined,
  proposedOffsets:p.proposed_plan?.offsets.filter(o=>o.shared||user===p.owner_id).map(({transactionId,...o})=>({...o,realized:!!transactionId})),
  sourceNames:user===p.owner_id?Object.fromEntries((await c.query(`SELECT t.id,COALESCE(NULLIF(t.title,''),NULLIF(t.payee,''),t.category) AS title FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$1 WHERE t.id=ANY($2::uuid[])`,[user,[...(p.proposed_plan||plan).sources.map(s=>s.transactionId),...(p.proposed_plan||plan).offsets.map(o=>o.transactionId).filter(Boolean)]])).rows.map(r=>[r.id,r.title])):undefined,
  personal,household,settlement,movements,changes,
  personalOffsets:(await c.query('SELECT entries FROM cost_member_offsets WHERE project_id=$1 AND user_id=$2',[p.id,user])).rows[0]?.entries||[],
  // Never expose private income IDs, amounts or inferred household net to another member.
  offsets:plan.offsets.filter(o=>o.shared||user===p.owner_id).map(({transactionId,...o})=>({...o,realized:!!transactionId})),
 };
}
export async function costProjects(user:string,method:string,path:string[],body:any,params:URLSearchParams){
 return transaction(async c=>{
  if(path[1]==='report'&&method==='GET'){
   const from=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(params.get('from')),to=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(params.get('to'));
   if(!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||to<from||(Date.parse(to)-Date.parse(from))/86400000>36600)throw new Failure('查询日期范围无效');
   const scope=z.enum(['personal','shared']).parse(params.get('scope')||'personal'),q=z.string().max(200).parse(params.get('q')||''),offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
   const projects=(await c.query(`SELECT p.* FROM cost_projects p WHERE p.active_plan IS NOT NULL AND p.title ILIKE '%'||$2||'%' AND (p.owner_id=$1 OR EXISTS(SELECT 1 FROM cost_project_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=p.family_id WHERE m.project_id=p.id AND m.user_id=$1)) ORDER BY p.id`,[user,q])).rows as Project[];
   const bookId=params.get('bookId');
   if(bookId){uuid.parse(bookId);if(!(await c.query('SELECT 1 FROM members WHERE book_id=$1 AND user_id=$2',[bookId,user])).rowCount)throw new Failure('账本不可访问',403);}
   const assigned=new Set(bookId?(await c.query('SELECT project_id FROM cost_project_members WHERE user_id=$1 AND display_book_id=$2',[user,bookId])).rows.map(r=>r.project_id):[]);
   const rows:any[]=[],excluded:{id:string;title:string}[]=[];
   if(bookId&&scope!=='personal')throw new Failure('账本归属筛选仅用于我的承担');
   const filteredProjects=bookId?projects.filter(p=>assigned.has(p.id)):projects;
   for(const p of filteredProjects){if(p.active_stale||!await validSources(c,p)){excluded.push({id:p.id,title:p.title});continue;}const extra=await memberOffsets(c,p,user,scope==='shared');for(const r of costReport({...p.active_plan,offsets:[...p.active_plan!.offsets,...extra]},from,to,scope==='personal'?user:undefined,scope==='shared'))if(r.cost||r.offset||r.expected)rows.push({...r,id:p.id,title:p.title,category:p.active_plan!.category});}
   const totals=rows.reduce((a,r)=>({cost:a.cost+r.cost,offset:a.offset+r.offset,expected:a.expected+r.expected,net:a.net+r.net}),{cost:0,offset:0,expected:0,net:0});
   const monthly=new Map<string,number>();for(const r of rows)monthly.set(r.month,(monthly.get(r.month)||0)+r.net);
   return {basis:'allocated_projects',scope,from,to,totals,total:rows.length,rows:rows.slice(offset,offset+20),monthly:[...monthly].sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>({name,value:value/100})),excluded};
  }
  if(path[1]==='options'&&method==='GET'){
   const people=(await c.query(`SELECT f.id AS family_id,f.name AS family_name,u.id,u.name FROM families f JOIN family_members mine ON mine.family_id=f.id AND mine.user_id=$1 JOIN family_members m ON m.family_id=f.id JOIN users u ON u.id=m.user_id ORDER BY f.name,u.name`,[user])).rows;
   return {userId:user,people};
  }
  if(path[1]==='sources'&&method==='GET'){
   const q=z.string().max(200).parse(params.get('q')||''),kind=z.enum(['expense','income']).parse(params.get('kind')||'expense'),offset=z.coerce.number().int().min(0).parse(params.get('offset')||0);
   return (await c.query(`SELECT candidates.*,count(*) OVER()::int AS total FROM (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.id,t.book_id,t.title,t.payee,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,b.name AS book_name FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$1 AND m.role<>'viewer' JOIN books b ON b.id=t.book_id JOIN accounts a ON a.id=t.account_id WHERE a.owner_id=$1 AND t.kind=$2 AND NOT t.deleted AND concat_ws(' ',t.title,t.payee,t.product,t.note,t.order_id,t.external_id) ILIKE '%'||$3||'%' ORDER BY COALESCE(t.event_id,t.id),t.created_at DESC) candidates ORDER BY date DESC,id LIMIT 21 OFFSET $4`,[user,kind,q,offset])).rows;
  }
  if(path[1]==='preview'&&method==='POST')return {...calculateCostPlan(body.plan),cashflowDelta:0};
  if(!path[1]&&method==='GET'){
   const q=z.string().max(120).parse(params.get('q')||''),offset=z.coerce.number().int().min(0).parse(params.get('offset')||0),archived=params.get('archived')==='true';
   return (await c.query(`SELECT p.id,p.title,p.version,p.archived,p.owner_id,p.active_plan IS NOT NULL AS active,p.proposed_plan IS NOT NULL AS pending,count(*) OVER()::int AS total FROM cost_projects p WHERE p.archived=$3 AND p.title ILIKE '%'||$4||'%' AND (p.owner_id=$1 OR EXISTS(SELECT 1 FROM cost_project_members m JOIN family_members f ON f.user_id=m.user_id AND f.family_id=p.family_id WHERE m.project_id=p.id AND m.user_id=$1)) ORDER BY p.updated_at DESC,p.id LIMIT 20 OFFSET $2`,[user,offset,archived,q])).rows;
  }
  if(!path[1]&&method==='POST'){
   const plan=calculateCostPlan(body.plan).plan;await eligible(c,user,plan);
   const p:Project={id:body.id?uuid.parse(body.id):randomUUID(),owner_id:user,family_id:plan.familyId,title:plan.title,version:1,archived:false,active_plan:null,proposed_plan:plan};
   if(body.id){const existing=(await c.query('SELECT owner_id,active_plan,proposed_plan FROM cost_projects WHERE id=$1',[p.id])).rows[0];if(existing){if(existing.owner_id===user&&JSON.stringify(calculateCostPlan(existing.proposed_plan||existing.active_plan).plan)===JSON.stringify(plan))return {id:p.id};throw new Failure('费用项目编号已使用，请重新打开',409);}}
   await c.query('INSERT INTO cost_projects(id,owner_id,family_id,title,proposed_plan) VALUES($1,$2,$3,$4,$5)',[p.id,user,p.family_id,p.title,JSON.stringify(plan)]);
   await claims(c,p,[plan]);
   for(const s of plan.shares)await c.query('INSERT INTO cost_project_members(project_id,user_id,accepted_version) VALUES($1,$2,$3)',[p.id,s.userId,s.userId===user?1:null]);
   if(plan.shares.length===1)await c.query('UPDATE cost_projects SET active_plan=proposed_plan,proposed_plan=NULL WHERE id=$1',[p.id]);
   await record(c,p,user,'created');return {id:p.id};
  }
  const p=await authorized(c,user,uuid.parse(path[1]));
  if(path[2]==='movements'&&method==='GET'){
   const ids=(p.active_plan||p.proposed_plan)!.shares.map(s=>s.userId);
   return (await c.query(`SELECT m.id,m.amount::float8 AS amount,to_char(m.date,'YYYY-MM-DD') AS date,s.name AS sender,r.name AS recipient FROM family_movements m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id WHERE m.family_id=$1 AND m.status='confirmed' AND m.kind IN ('transfer','aa') AND m.expense_id IS NULL AND m.sender_id=ANY($2::uuid[]) AND m.recipient_id=ANY($2::uuid[]) AND $3 IN(m.sender_id,m.recipient_id) ORDER BY m.date DESC,m.id LIMIT 100`,[p.family_id,ids,user])).rows;
  }
  if(method==='GET')return detail(c,p,user,params);
  if(path[2]==='settlement-transfer'&&method==='POST'){
   const b=z.object({operation:z.enum(['create','confirm','cancel']),id:uuid,sourceId:uuid.optional(),recipientId:uuid.optional(),targetId:uuid.optional(),amount:z.number().int().positive().max(100000000000).optional(),date:z.string().optional(),note:z.string().max(500).default(''),allowSimilar:z.boolean().default(false)}).parse(body);
   if(!p.family_id)throw new Failure('成员结算需要关联家庭');
   const linked=(await c.query("SELECT m.*,to_char(m.date,'YYYY-MM-DD') AS date FROM cost_settlements s JOIN family_movements m ON m.id=s.movement_id WHERE s.project_id=$1 AND s.movement_id=$2",[p.id,b.id])).rows[0];
   if(b.operation==='create'&&linked){
    if(linked.sender_id!==user||linked.recipient_id!==b.recipientId||linked.source_id!==b.sourceId||Number(linked.amount)!==b.amount||String(linked.date).slice(0,10)!==b.date)throw new Failure('请刷新后核对已有结算',409);
    return {ok:true,movementId:b.id};
   }
   if(b.operation!=='create'){
    if(!linked)throw new Failure('项目内没有这笔结算',404);
    if(b.operation==='confirm'&&linked.status==='cancelled')throw new Failure('这笔转款已取消，不能确认到账',409);
    if(b.operation==='cancel'&&linked.status==='confirmed')throw new Failure('这笔转款已到账，不能作为待确认转款取消',409);
    // The existing family receipt workflow remains the authority for who may confirm.
    await familyFinance(user,p.family_id,'POST',{operation:b.operation,id:b.id,targetId:b.targetId},c);
    if(linked.status==='pending')await record(c,p,user,b.operation==='confirm'?'settlement_confirmed':'settlement_cancelled');
    return {ok:true};
   }
   if(z.number().int().parse(body.version)!==p.version)throw new Failure('记录已更新，请重新打开后设置',409);
   if(p.archived||!p.active_plan||p.active_stale||!await validSources(c,p))throw new Failure('请先确认有效且未归档的费用分担');
   const ids=p.active_plan.shares.map(s=>s.userId);
   if(!ids.includes(user)||!ids.includes(b.recipientId||'')||b.recipientId===user)throw new Failure('请选择本项目的其他承担成员');
   if(!(await c.query('SELECT 1 FROM accounts WHERE id=$1 AND owner_id=$2 AND NOT archived',[b.sourceId,user])).rowCount)throw new Failure('请选择自己的付款钱包',403);
   if((await c.query('SELECT 1 FROM family_movements WHERE id=$1',[b.id])).rowCount)throw new Failure('该转账已存在，请使用关联已有结算',409);
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
   if(!b.date||b.date>today)throw new Failure('仅记录已经发生的成员转款');
   await familyFinance(user,p.family_id,'POST',{...b,kind:'transfer'},c);
   await c.query('INSERT INTO cost_settlements(project_id,movement_id,amount) VALUES($1,$2,$3)',[p.id,b.id,b.amount]);
   await record(c,p,user,'settlement_sent');return {ok:true,movementId:b.id};
  }
  if(z.number().int().parse(body.version)!==p.version)throw new Failure('记录已更新，请重新打开后设置',409);
  if(path[2]==='personal-offsets'&&method==='POST'){
   if(p.archived)throw new Failure('请先恢复项目');
   const entries=costPlanSchema.shape.offsets.parse(body.entries);
   if(entries.some(o=>o.userId!==user)||new Set(entries.map(o=>o.id)).size!==entries.length)throw new Failure('个人抵减只能用于本人，且不能重复');
   const amounts=new Map<string,number>();for(const o of entries)if(o.transactionId)amounts.set(o.transactionId,(amounts.get(o.transactionId)||0)+o.amount);
   const claimsToSave:any[]=[];const events=new Set<string>();
   for(const [id,amount] of [...amounts].sort(([a],[b])=>a.localeCompare(b))){
    const s=await source(c,user,id,'income'),event=s.event_id||s.id;if(events.has(event))throw new Failure('不能重复关联同一收入的账本副本');events.add(event);
    const used=Number((await c.query('SELECT COALESCE(sum(amount),0) AS n FROM (SELECT amount FROM cost_source_claims WHERE event_id=$1 UNION ALL SELECT amount FROM cost_member_income_claims WHERE event_id=$1 AND NOT(project_id=$2 AND user_id=$3)) claims',[event,p.id,user])).rows[0].n);
    if(used+amount>s.available)throw new Failure('抵减金额超过收入尚可分配金额');claimsToSave.push({...s,event,allocated:amount});
   }
   await c.query('DELETE FROM cost_member_income_claims WHERE project_id=$1 AND user_id=$2',[p.id,user]);
   for(const s of claimsToSave)await c.query('INSERT INTO cost_member_income_claims VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.id,user,s.id,s.event,s.allocated,s.available,s.account_id,s.date]);
   await c.query('INSERT INTO cost_member_offsets VALUES($1,$2,$3) ON CONFLICT(project_id,user_id) DO UPDATE SET entries=$3',[p.id,user,JSON.stringify(entries)]);
   await c.query('UPDATE cost_projects SET version=version+1,updated_at=now() WHERE id=$1',[p.id]);
   if(p.proposed_plan)await c.query('UPDATE cost_project_members SET accepted_version=CASE WHEN accepted_version=$2 THEN $2+1 ELSE accepted_version END WHERE project_id=$1',[p.id,p.version]);
   await record(c,p,user,'personal_offsets');return {ok:true};
  }
  if(path[2]==='respond'&&method==='POST'){
   if(p.archived)throw new Failure('请先恢复项目');
   if(!p.proposed_plan)throw new Failure('没有待确认的分担');
   await eligible(c,p.owner_id,p.proposed_plan);
   if(!await validSources(c,p))throw new Failure('原账单已变化，请所有者重新核对分摊');
   const accepted=z.boolean().parse(body.accept);
   if(!accepted){
    if(!p.active_plan){await c.query('UPDATE cost_projects SET archived=true,version=version+1 WHERE id=$1',[p.id]);await c.query('DELETE FROM cost_source_claims WHERE project_id=$1',[p.id]);await record(c,p,user,'rejected');return {ok:true};}
    if(p.active_stale)throw new Failure('旧规则的原账单已变化，请所有者修订，不能恢复为有效规则');
    await c.query('UPDATE cost_projects SET proposed_plan=NULL,version=version+1 WHERE id=$1',[p.id]);await claims(c,p,[p.active_plan]);
   }else{
    await c.query('UPDATE cost_project_members SET accepted_version=$3 WHERE project_id=$1 AND user_id=$2',[p.id,user,p.version]);
    const missing=Number((await c.query('SELECT count(*) AS n FROM cost_project_members WHERE project_id=$1 AND accepted_version IS DISTINCT FROM $2',[p.id,p.version])).rows[0].n);
    if(!missing){await c.query('UPDATE cost_projects SET active_plan=proposed_plan,proposed_plan=NULL,active_stale=false WHERE id=$1',[p.id]);await claims(c,p,[p.proposed_plan]);}
   }await record(c,p,user,accepted?'accepted':'rejected');return {ok:true};
  }
  if(path[2]==='display'&&method==='POST'){
   const book=body.bookId?uuid.parse(body.bookId):null;
   if(book&&!(await c.query("SELECT 1 FROM books WHERE id=$1 AND owner_id=$2 AND kind='private'",[book,user])).rowCount)throw new Failure('请选择自己的个人账本');
   await c.query('UPDATE cost_project_members SET display_book_id=$3 WHERE project_id=$1 AND user_id=$2',[p.id,user,book]);return {ok:true};
  }
  if(path[2]==='settlements'&&method==='POST'){
   if(!p.active_plan||p.active_stale||!await validSources(c,p))throw new Failure('请先确认有效的费用分担');
   const movementId=uuid.parse(body.movementId),amount=z.number().int().positive().max(100000000000).parse(body.amount);
   const m=(await c.query('SELECT * FROM family_movements WHERE id=$1 FOR UPDATE',[movementId])).rows[0];
   const ids=p.active_plan.shares.map(s=>s.userId);
   if(!m||![m.sender_id,m.recipient_id].includes(user)||!ids.includes(m.sender_id)||!ids.includes(m.recipient_id)||m.family_id!==p.family_id||!['transfer','aa'].includes(m.kind)||m.status!=='confirmed')throw new Failure('请选择参与人之间已确认的转账或 AA 结算');
   if(m.kind==='aa'&&m.expense_id)throw new Failure('该 AA 已关联旧消费，不能再次用于新项目结算');
   const used=Number((await c.query('SELECT COALESCE(sum(amount),0) AS n FROM cost_settlements WHERE movement_id=$1 AND project_id<>$2',[movementId,p.id])).rows[0].n);
   if(used+amount>Number(m.amount))throw new Failure('结算关联金额超过转账可用金额');
   await c.query('INSERT INTO cost_settlements(project_id,movement_id,amount) VALUES($1,$2,$3) ON CONFLICT(project_id,movement_id) DO UPDATE SET amount=$3',[p.id,movementId,amount]);await record(c,p,user,'settlement');return {ok:true};
  }
  if(p.owner_id!==user)throw new Failure('请由项目所有者修改',403);
  if(path[2]==='archive'&&method==='POST'){await c.query('UPDATE cost_projects SET archived=$2,version=version+1,updated_at=now() WHERE id=$1',[p.id,z.boolean().parse(body.archived)]);if(p.proposed_plan)await c.query('UPDATE cost_project_members SET accepted_version=CASE WHEN accepted_version=$2 THEN $2+1 ELSE accepted_version END WHERE project_id=$1',[p.id,p.version]);await record(c,p,user,'archive');return {ok:true};}
  if(method==='PUT'){
   if(p.archived)throw new Failure('请先恢复项目');
   const plan=calculateCostPlan(body.plan).plan;await eligible(c,user,plan);
   if(plan.familyId!==p.family_id||plan.shares.map(s=>s.userId).sort().join(',')!==(p.active_plan||p.proposed_plan)!.shares.map(s=>s.userId).sort().join(','))throw new Failure('已有项目请保留原参与成员，新增成员请创建新的费用项目');
   const stale=!!p.active_plan&&(!!p.active_stale||!await validSources(c,p));
   await claims(c,p,stale?[plan]:p.active_plan?[p.active_plan,plan]:[plan]);
   await c.query('UPDATE cost_projects SET active_stale=$2 WHERE id=$1',[p.id,stale]);
   p.version++;await c.query('UPDATE cost_projects SET title=$2,proposed_plan=$3,version=$4,updated_at=now() WHERE id=$1',[p.id,plan.title,JSON.stringify(plan),p.version]);
   await c.query('UPDATE cost_project_members SET accepted_version=CASE WHEN user_id=$2 THEN $3::integer ELSE NULL END WHERE project_id=$1',[p.id,user,p.version]);
   if(plan.shares.length===1){await c.query('UPDATE cost_projects SET active_plan=proposed_plan,proposed_plan=NULL,active_stale=false WHERE id=$1',[p.id]);await claims(c,p,[plan]);}
   await record(c,p,user,'revised');return {ok:true};
  }
  throw new Failure('操作不存在',404);
 });
}
