import {z} from 'zod';
import {db} from './db';
import {familyFinance} from './family-finance';
import type {ChatAction} from '@/lib/chat-actions';
const uuid=z.string().uuid(),amount=z.number().int().positive().max(100000000000);
export const familyActionSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('create'),familyId:uuid,sourceId:uuid,targetId:uuid.optional(),recipientId:uuid.optional(),kind:z.enum(['transfer','gift','aa','loan','repayment','contribution']),amount,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),note:z.string().max(500).default(''),expenseId:uuid.optional(),loanId:uuid.optional(),externalId:z.string().trim().max(200).optional(),platform:z.string().trim().max(60).optional(),allowSimilar:z.boolean().default(false)}),
 z.object({operation:z.literal('confirm'),familyId:uuid,movementId:uuid,targetId:uuid}),
 z.object({operation:z.literal('shares'),familyId:uuid,transactionId:uuid,shares:z.array(z.object({userId:uuid,amount:z.number().int().nonnegative()})).min(1)})]);
export const familyKinds:Record<string,string>={transfer:'成员转账',gift:'红包／赠与',aa:'AA结算',loan:'借款',repayment:'归还借款',contribution:'共同钱包入金'};
export async function familyOptions(user:string,familyId?:string){const families=(await db.query('SELECT f.id,f.name FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=$1 ORDER BY f.created_at',[user])).rows;return {userId:user,families,...(familyId?await familyFinance(user,familyId,'GET',null):{})};}
export async function prepareFamilySummary(a:ChatAction,user:string){const d=a.data;const options:any=await familyOptions(user,d.familyId);a.summary=[];const add=(label:string,value:any)=>{if(value!=null&&value!=='')a.summary.push({label,value:String(value)});};
 add('家庭',options.families.find((f:any)=>f.id===d.familyId)?.name);add('操作',d.operation==='confirm'?'确认收到':d.operation==='shares'?'设置费用分担':familyKinds[d.kind]);
 if(!d.familyId)return;
 if(d.operation==='create'){
  if(!options.wallets.some((w:any)=>w.id===d.sourceId))a.missing.push('转出钱包');
  if(!d.targetId&&!d.recipientId)a.missing.push('收款成员或共同钱包');
  if(d.targetId&&d.recipientId)a.missing.push('收款成员与转入钱包请选择其中一个');
  if(d.targetId===d.sourceId&&d.targetId)a.missing.push('转入与转出钱包不能相同');
  if(['gift','aa','loan','repayment'].includes(d.kind)&&!d.recipientId)a.missing.push('收款成员');
  if(d.kind==='contribution'&&!options.wallets.some((w:any)=>w.id===d.targetId&&w.family_id===d.familyId))a.missing.push('家庭共同钱包');
  if(d.kind!=='transfer'&&!options.wallets.some((w:any)=>w.id===d.sourceId&&w.owner_id===user))a.missing.push('自己的转出钱包');
  if(d.recipientId&&!options.people.some((p:any)=>p.id===d.recipientId&&p.id!==user))a.missing.push('收款成员');
  if(d.kind==='aa'&&!d.expenseId)a.missing.push('原消费');if(d.kind==='repayment'&&!d.loanId)a.missing.push('原借款');
  if(d.externalId&&options.movements.some((m:any)=>m.status!=='cancelled'&&m.external_id===d.externalId&&m.platform===(d.platform||'')))a.missing.push('这笔流水已经记录，请使用已有往来记录');
  const similar=options.movements.filter((m:any)=>m.status!=='cancelled'&&m.sender_id===user&&m.source_id===d.sourceId&&m.amount===d.amount&&m.date===d.date&&((d.recipientId&&m.recipient_id===d.recipientId)||(d.targetId&&m.target_id===d.targetId)));
  if(similar.length){add('相似记录',similar.map((m:any)=>`${m.date} ${m.amount/100} ${m.status==='confirmed'?'已到账':'待到账'}`).join('；'));a.warnings.push('已有同日同金额的家庭往来，请优先使用已有记录。只有确定是另一笔转账才勾选另记。');if(!d.allowSimilar)a.missing.push('核对相似转账');}
  if(!d.targetId)a.warnings.push('保存后等待收款成员选择自己的钱包并确认到账，不计作家庭收入或支出。');
 }
 if(d.operation==='confirm'){const m=options.movements.find((m:any)=>m.id===d.movementId&&m.recipient_id===user&&m.status==='pending');if(!m)a.missing.push('本人待确认的收款记录');else{add('付款人',m.sender_name);add('金额',(m.amount/100).toFixed(2));add('交易日期',m.date);}}
 for(const [key,label] of [['sourceId','转出钱包'],['targetId','到账钱包']])if(d[key]){const w=options.wallets.find((w:any)=>w.id===d[key]);if(!w)a.missing.push(label);else a.summary.push({label,value:[w.name,w.suffix].filter(Boolean).join(' · '),account:[w.institution,w.name].filter(Boolean).join(' ')});}
 add('收款成员',options.people.find((p:any)=>p.id===d.recipientId)?.name);if(d.amount!=null)add('金额',(d.amount/100).toFixed(2));add('交易日期',d.date);add('交易流水号',d.externalId);add('备注',d.note);
 if(d.expenseId||d.transactionId)add('原消费',options.expenses.find((e:any)=>e.id===(d.expenseId||d.transactionId))?.title);
 for(const share of d.shares||[])add(options.people.find((p:any)=>p.id===share.userId)?.name||'家庭成员',(share.amount/100).toFixed(2));
}
