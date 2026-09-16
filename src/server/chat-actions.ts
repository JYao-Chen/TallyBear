import {familyFinance} from './family-finance';
import {familyActionSchema,prepareFamilySummary} from './family-actions';
import {sceneSchema} from '@/lib/entry-scene';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction,lockBook} from './db';
import {Failure,member,type User} from './access';
import {entry} from './model';
import {insertEntry} from './ledger';
import {listAccounts} from './accounts';
import {listCategories,checkCategory} from './categories';
import {review} from './recognize';
import {checkVerification} from '@/lib/verification';
import {schedules} from './schedules';
import {templates} from './templates';
import {allocations} from './allocations';
import {changeInstallment,listInstallments} from './installments';
import {deployment} from '@/lib/deployment';
import {translate} from '@/lib/i18n';
import {actionNames,type ChatAction,type ChatActionKind} from '@/lib/chat-actions';
const uuid=z.string().uuid(),money=z.number().int().positive().max(100000000000),nonnegative=money.or(z.literal(0));
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const name=z.string().trim().min(1).max(80),category=z.string().trim().min(1).max(60);
const units=z.enum(['day','week','month','year']),frequency=z.enum(['daily','weekly','monthly','yearly']);
// The same persisted proposal is validated again at confirmation. Model tools never execute it.
export function parseAction(a:ChatAction){
 const d=a.data;
 switch(a.kind){
 case 'family':return {...familyActionSchema.parse(d),id:d.movementId||a.id};
 case 'entry':z.object({title:name}).parse(d);return entry.parse({...d,id:a.id});
 case 'schedule':return {...z.object({name,frequency,nextDate:date,intervalCount:z.number().int().positive().safe(),amortize:z.boolean().default(false)}).parse(d),value:entry.parse({...d,id:a.id,date:d.nextDate}),operation:'save'};
 case 'template':return {name:name.parse(d.name),value:entry.parse({...d,id:a.id})};
 case 'budget':return z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),category,amount:nonnegative}).parse(d);
 case 'allocation':return {...z.object({transactionId:uuid,version:z.number().int().nonnegative(),startDate:date,periodUnit:units,periodCount:z.number().int().positive().safe()}).parse(d),id:d.transactionId};
 case 'installment':{const p=z.object({name,terms:z.number().int().min(1).max(600),firstDate:date,fees:nonnegative,transactionId:uuid.optional(),allocate:z.boolean().default(false),allocationStart:date.optional(),allocationMonths:z.number().int().positive().max(1200).optional()}).parse(d);if(p.allocate&&(!p.allocationStart||!p.allocationMonths))throw new Failure('请补充费用分摊的开始日期和月数');return {...p,operation:'create',requestId:a.id,book:a.bookId,...(!p.transactionId?{purchase:entry.parse({...d,id:a.id,kind:'expense'})}:{})};}
 case 'repayment':return {...z.object({planId:uuid,version:z.number().int().nonnegative(),accountId:uuid,date,principal:nonnegative,fee:nonnegative,feeCategory:category,settle:z.boolean().default(false)}).parse(d),id:d.planId,operation:'pay',requestId:a.id,book:a.bookId};
 }
}
const fieldNames:Record<string,string>={familyId:'家庭',sourceId:'转出钱包',recipientId:'收款成员',movementId:'待收款记录',expenseId:'原消费',loanId:'原借款',operation:'操作',shares:'费用份额',refundOf:'原消费',title:'账目标题',accountId:'付款／收款钱包',targetId:'转入钱包',amount:'金额',date:'交易日期',kind:'收支类型',category:'分类',name:'名称',nextDate:'首次扣款日期',frequency:'重复周期',intervalCount:'周期间隔',transactionId:'原账单',version:'最新记录版本',startDate:'分摊开始日期',periodUnit:'分摊单位',periodCount:'覆盖周期',month:'预算月份',terms:'分期期数',firstDate:'首次还款日期',fees:'总手续费',planId:'分期计划',principal:'本次还款本金',fee:'本次手续费',feeCategory:'手续费分类'};
export function actionMissing(a:ChatAction){try{parseAction(a);return [];}catch(e){if(e instanceof z.ZodError)return [...new Set(e.issues.map(i=>i.path[0]==='lineItems'?`第${Number(i.path[1])+1}项商品：${({kind:'明细类型（商品、优惠或附加费）',name:'商品名称',amount:'小计金额',quantity:'数量',unitPrice:'单价'} as Record<string,string>)[String(i.path[2])]||i.message}`:fieldNames[String(i.path[0])]||String(i.path.join('.'))||i.message))];return [e instanceof Error?e.message:'信息不完整'];}}
export async function actionOptions(book:string,user:User){await member(book,user);return {bookId:book,books:(await db.query("SELECT b.id,b.name,b.icon FROM books b JOIN members m ON m.book_id=b.id WHERE m.user_id=$1 AND m.role<>'viewer' ORDER BY b.created_at",[user.id])).rows,accounts:(await listAccounts(book,user.id)).filter(a=>a.usable&&!a.archived).map(({id,name,type,institution,suffix,owner_id,family_id,owner_name}:any)=>({id,name,type,institution,suffix,owner_id,family_id,owner_name})),categories:(await listCategories(book)).filter(c=>!c.archived)};}
export async function prepareChatAction(input:unknown,ctx:{book:string;user:User;deviceTime?:string},actions:ChatAction[],recognizedId?:string){
 const b=z.object({actionId:uuid.optional(),kind:z.enum(['family','entry','schedule','template','budget','allocation','installment','repayment']),bookId:uuid.optional(),data:z.record(z.unknown())}).parse(input);
 const old=b.actionId?actions.find(a=>a.id===b.actionId):undefined;if(b.actionId&&(!old||old.status!=='pending'))throw new Failure('只能修改仍待确认的操作，请读取当前待办');
 const book=b.bookId||old?.bookId||ctx.book;await member(book,ctx.user,b.kind!=='family');
 const a:ChatAction={id:old?.id||(recognizedId?uuid.parse(recognizedId):randomUUID()),kind:b.kind,bookId:book,title:actionNames[b.kind],status:'pending',data:{...(old?.data||{}),...b.data},missing:[],warnings:[],summary:[]};
 const d=a.data;if(d.scene)d.scene=sceneSchema.parse(d.scene);for(const key of ['id','action','matches','missing','refundCandidates'])delete d[key];if(!d.title&&d.name)d.title=d.name;if(['entry','template'].includes(a.kind)&&!d.date&&ctx.deviceTime){d.date=ctx.deviceTime.slice(0,10);d.occurredAt||=ctx.deviceTime;}
 if(a.kind==='family'){for(const key of Object.keys(d))if(key!=='displayBookId'&&(d[key]===null||d[key]===''))delete d[key];if(!d.date&&ctx.deviceTime)d.date=ctx.deviceTime.slice(0,10);await prepareFamilySummary(a,ctx.user.id);a.missing=[...new Set([...actionMissing(a),...a.missing])];if(old)actions.splice(actions.indexOf(old),1,a);else actions.push(a);return a;}
 if(d.refundOf&&a.kind==='entry'){const original=(await db.query("SELECT title,payee,category,amount::float8 AS amount FROM transactions WHERE id=$1 AND book_id=$2 AND kind='expense' AND NOT deleted",[uuid.parse(d.refundOf),book])).rows[0]||actions.find(v=>v.id===d.refundOf&&v.bookId===book&&v.kind==='entry'&&v.data.kind==='expense'&&v.status!=='cancelled')?.data;if(!original)throw new Failure('关联的原消费不存在');d.category=original.category;d.refundTitle=original.title||original.payee;}
 a.missing=actionMissing(a);
 const options=await actionOptions(book,ctx.user);const tr=(s:string)=>translate(s,deployment().language);
 const fmt=(v:unknown)=>typeof v==='number'?new Intl.NumberFormat(deployment().language,{style:'currency',currency:deployment().currency}).format(v/100):tr('待补充');
 const add=(label:string,value:unknown,extra:object={})=>{if(value!==undefined&&value!==null&&value!=='')a.summary.push({label:tr(label),value:String(value),...extra});};
 const target=options.books.find(b=>b.id===book);add('记入账本',target?.name,{icon:target?.icon||'📒'});
 add('账目标题',d.title||d.name);add('收支类型',d.kind?tr(({expense:'支出',income:'收入',refund:'退款',transfer:'转账'} as any)[d.kind]||d.kind):undefined);
 for(const [key,label] of [['accountId','资金钱包'],['targetId','转入钱包']]){const wallet=options.accounts.find(v=>v.id===d[key]);if(d[key]&&!wallet)a.missing.push(label);if(wallet)add(label,[wallet.name,wallet.suffix].filter(Boolean).join(' · '),{account:[wallet.institution,wallet.name,wallet.type].filter(Boolean).join(' ')});}
 if(d.category){const c=options.categories.find(c=>c.name===d.category);if(!c)a.missing.push('分类');add('分类',d.category,{icon:c?.icon||'🏷️'});}
 for(const [key,label] of [['amount','金额'],['principal','本次还款本金'],['fee','本次手续费'],['fees','总手续费']])if(d[key]!==undefined)add(label,fmt(d[key]));
 for(const [key,label] of [['date','交易日期'],['occurredAt','交易时间'],['payee','商家'],['nextDate','首次扣款日期'],['month','预算月份'],['startDate','分摊开始日期'],['firstDate','首次还款日期'],['terms','分期期数'],['allocationStart','分摊开始日期'],['allocationMonths','分摊月数'],['product','商品摘要'],['note','备注']])add(label,key==='occurredAt'&&d[key]&&Number.isFinite(Date.parse(d[key]))?new Date(d[key]).toLocaleString(deployment().language,{timeZone:'Asia/Shanghai',hour12:false}):d[key]);
 if(d.scene)for(const [key,label] of [['transport','交通方式'],['origin','始发站'],['destination','终点站'],['merchant','商家简称'],['branch','门店'],['meal','用餐类型']])add(label,d.scene[key]);
 if(d.frequency)add('重复周期',`${d.intervalCount??'?'} ${tr(({daily:'天',weekly:'周',monthly:'月',yearly:'年'} as any)[d.frequency]||d.frequency)}`);
 if(d.periodUnit)add('覆盖周期',`${d.periodCount??'?'} ${tr(({day:'天',week:'周',month:'月',year:'年'} as any)[d.periodUnit]||d.periodUnit)}`);
 add('关联原消费',d.refundTitle);add('核验说明',d.verificationReason);if(d.attachmentIds?.length)add('保留图片凭证',tr(d.retainReceipts?'是':'否'));
 if(a.kind==='schedule'){add('费用分摊',tr(d.amortize?'按覆盖周期分摊':'不分摊'));a.warnings.push(tr('创建周期计划不会立即记账，到期后核对实际扣款。'));}
 if(a.kind==='template')a.warnings.push(tr('只保存常用预设，本次不会产生收支。'));
 if(a.kind==='entry'&&!a.missing.length){const item=entry.parse({...d,id:a.id});const r=await review(book,{entries:[item]});const checked=r.entries[0] as any;if(checked?.matches?.length)a.warnings.push(tr('发现疑似重复账单，请核对是否为另一笔。'));try{checkVerification(item.lineItems,item.amount,item.verificationReason);}catch(e){a.missing.push((e as Error).message);}if(item.kind==='refund'&&!item.refundOf)a.warnings.push(tr('退款尚未关联原消费。'));}
 if(d.transactionId){const row=(await db.query("SELECT title,payee,amount::float8 AS amount,version FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted",[uuid.parse(d.transactionId),book])).rows[0];if(!row)a.missing.push('原账单');else{add('原账单',`${row.title||row.payee} · ${fmt(row.amount)}`);if(a.kind==='allocation')a.data.version=row.version;}}
 if(a.kind==='repayment'&&d.planId){const plan=(await listInstallments(ctx.user.id)).plans.find(p=>p.id===d.planId);if(!plan)a.missing.push('分期计划');else{a.data.version=plan.version;add('分期计划',plan.name);add('剩余本金',fmt(plan.remaining));add('提前结清',tr(d.settle?'是':'否'));}}
 if(a.kind==='budget'&&!a.missing.length){const old=(await db.query('SELECT amount::float8 AS amount FROM budgets WHERE book_id=$1 AND month=$2 AND category=$3',[book,d.month,d.category])).rows[0];a.data.previousAmount=old?.amount??null;if(old)add('当前预算',fmt(old.amount));}
 a.missing=Array.from(new Set([...actionMissing(a),...a.missing.filter(m=>m!=='最新记录版本')]));if(old)actions.splice(actions.indexOf(old),1,a);else actions.push(a);return a;
}
export async function confirmChatAction(book:string,user:User,body:unknown){
 const b=z.object({id:uuid,turnId:uuid,actionId:uuid,operation:z.enum(['confirm_action','cancel_action','edit_action']),data:z.record(z.unknown()).optional(),acknowledgeWarnings:z.boolean().default(false)}).parse(body);
 return transaction(async c=>{
  const conversation=(await c.query('SELECT id FROM finance_conversations WHERE id=$1 AND book_id=$2 AND user_id=$3 FOR UPDATE',[b.id,book,user.id])).rows[0];if(!conversation)throw new Failure('对话不存在',404);
  if((await c.query("SELECT 1 FROM ai_jobs WHERE kind='chat' AND payload->>'id'=$1 AND status IN ('queued','running')",[b.id])).rowCount)throw new Failure('助手正在更新内容，请完成后确认',409);
  const t=(await c.query('SELECT * FROM finance_turns WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[b.id])).rows[0];if(!t||t.id!==b.turnId)throw new Failure('已有更新的对话，请核对最新确认卡片',409);
  const a=(t.artifacts.actions as ChatAction[]|undefined)?.find(a=>a.id===b.actionId);if(!a)throw new Failure('待确认操作不存在',404);if(a.status!=='pending')return {ok:true,status:a.status,result:a.result};
  if(b.operation==='edit_action'){if(t.status!=='complete')throw new Failure('请先让助手完成本轮整理');await prepareChatAction({actionId:a.id,kind:a.kind,bookId:a.bookId,data:b.data||{}},{book,user},t.artifacts.actions);await c.query('UPDATE finance_turns SET artifacts=$1 WHERE id=$2',[t.artifacts,t.id]);return {ok:true};}
  if(b.operation==='cancel_action')a.status='cancelled';else{
   if(t.status!=='complete')throw new Failure('请先让助手完成本轮整理');
   if(a.kind!=='family'){await lockBook(c,a.bookId);const role=(await c.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[a.bookId,user.id])).rows[0]?.role;if(!role||role==='viewer')throw new Failure('没有目标账本的记账权限',403);}
   if(a.missing.length)throw new Failure('请先补充：'+a.missing.join('、'));
   const data=parseAction(a) as any;
   if(data.category||data.value?.category)await checkCategory(c,a.bookId,data.category||data.value.category);
   if(a.kind==='entry'){
    const checked=(await review(a.bookId,{entries:[data]})).entries[0] as any;
    if((checked?.matches?.length||data.kind==='refund'&&!data.refundOf)&&!b.acknowledgeWarnings)throw new Failure('请核对重复或退款关联，再勾选核对确认后保存',409);
    const count=await insertEntry(c,a.bookId,user.id,data);if(!count)throw new Failure('这条账单已存在，请核对已有记录',409);a.result={id:data.id};
   }else if(a.kind==='family')a.result=await familyFinance(user.id,data.familyId,'POST',data,c);
   else if(a.kind==='schedule')a.result=await schedules(a.bookId,user.id,'POST',data,c);
   else if(a.kind==='template')a.result=await templates(a.bookId,user.id,'POST',data,c);
   else if(a.kind==='allocation')a.result=await allocations(a.bookId,'PUT',data,new URLSearchParams(),c);
   else if(a.kind==='installment'||a.kind==='repayment')a.result=await changeInstallment(user.id,data,c);
   else if(a.kind==='budget'){
    const current=(await c.query('SELECT amount::float8 AS amount FROM budgets WHERE book_id=$1 AND month=$2 AND category=$3',[a.bookId,data.month,data.category])).rows[0];if((current?.amount??null)!==a.data.previousAmount)throw new Failure('预算已改变，请让助手读取最新预算后重新准备',409);
    await c.query('INSERT INTO budgets VALUES($1,$2,$3,$4) ON CONFLICT(book_id,month,category) DO UPDATE SET amount=$4',[a.bookId,data.month,data.category,data.amount]);a.result={ok:true};
   }
   a.status='confirmed';a.confirmedAt=new Date().toISOString();
  }
  await c.query('UPDATE finance_turns SET artifacts=$1 WHERE id=$2',[t.artifacts,t.id]);return {ok:true,status:a.status,result:a.result};
 });
}
