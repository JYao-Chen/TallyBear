import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {prepareChatAction,confirmChatAction} from '../src/server/chat-actions';
import {createAccount} from '../src/server/accounts';
import {listInstallments} from '../src/server/installments';
import type {ChatAction} from '../src/lib/chat-actions';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_chat_test'));
const user={id:randomUUID(),username:'chat-test',name:'对话测试',admin:true,avatar:'🧸',theme:'bear' as const};
const book=randomUUID(),conversation=randomUUID();
await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$3,$4,true)',[user.id,user.username,user.name,'unused']);
await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'对话测试账本','private',$2)",[book,user.id]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user.id]);
await db.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'交互式记账测试')",[conversation,book,user.id]);
const account=(await createAccount(user.id,{name:'工资卡',institution:'工商银行',type:'bank',opening:1000000})).id;
const credit=(await createAccount(user.id,{name:'白条',type:'credit'})).id;
const ctx={book,user,deviceTime:'2026-09-15T18:30:00+08:00'},actions:ChatAction[]=[];
let turn='';
async function persist(){turn=randomUUID();await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,artifacts,status) VALUES($1,$2,'帮我填写','请核对卡片后保存',$3,'complete')",[turn,conversation,{actions,charts:[],drafts:[],tools:[]}]);}
async function confirm(a:ChatAction,extra:object={}){const r=await confirmChatAction(book,user,{id:conversation,turnId:turn,actionId:a.id,operation:'confirm_action',...extra});a.status=r.status as any;return r;}
const amount=async()=>Number((await db.query('SELECT count(*) AS n FROM transactions WHERE book_id=$1',[book])).rows[0].n);
let a=await prepareChatAction({kind:'entry',data:{title:'午餐',kind:'expense',amount:3200,category:'餐饮'}},ctx,actions);assert.ok(a.missing.includes('付款／收款钱包'));await persist();await assert.rejects(()=>confirm(a));assert.equal(await amount(),0);
a=await prepareChatAction({actionId:a.id,kind:'entry',data:{accountId:account,payee:'七鲜',title:'七鲜午餐',amount:3000}},ctx,actions);assert.equal(actions.length,1);assert.deepEqual(a.missing,[]);assert.equal(a.data.date,'2026-09-15');await persist();await Promise.all([confirm(a),confirm(a)]);assert.equal(await amount(),1);
await assert.rejects(()=>prepareChatAction({actionId:a.id,kind:'entry',data:{amount:4000}},ctx,actions));
const duplicate=await prepareChatAction({kind:'entry',data:{...a.data}},ctx,actions);assert.ok(duplicate.warnings.some(w=>w.includes('重复')));await persist();await assert.rejects(()=>confirm(duplicate),/核对/);await confirm(duplicate,{acknowledgeWarnings:true});assert.equal(await amount(),2);
const schedule=await prepareChatAction({kind:'schedule',data:{name:'云盘年费',kind:'expense',amount:19800,accountId:account,category:'其他',frequency:'yearly',intervalCount:1,nextDate:'2026-10-01',amortize:true}},ctx,actions);assert.deepEqual(schedule.missing,[]);await persist();await Promise.all([confirm(schedule),confirm(schedule)]);assert.equal(Number((await db.query('SELECT count(*) AS n FROM bill_schedules WHERE book_id=$1',[book])).rows[0].n),1);assert.equal(await amount(),2);
const template=await prepareChatAction({kind:'template',data:{name:'通勤地铁',title:'地铁 · 五道口 → 中关村',kind:'expense',amount:400,accountId:account,category:'交通'}},ctx,actions);await persist();await confirm(template);assert.equal(await amount(),2);
const budget=await prepareChatAction({kind:'budget',data:{month:'2026-09',category:'餐饮',amount:100000}},ctx,actions);await persist();await confirm(budget);
const allocation=await prepareChatAction({kind:'allocation',data:{transactionId:a.id,startDate:'2026-09-01',periodUnit:'month',periodCount:3}},ctx,actions);assert.deepEqual(allocation.missing,[]);await persist();await confirm(allocation);
const installment=await prepareChatAction({kind:'installment',data:{name:'手机分期',title:'手机',amount:600000,accountId:credit,date:'2026-09-15',category:'购物',terms:12,firstDate:'2026-10-15',fees:0}},ctx,actions);assert.deepEqual(installment.missing,[]);await persist();await confirm(installment);let plan=(await listInstallments(user.id)).plans[0];assert.equal(plan.remaining,600000);
const repayment=await prepareChatAction({kind:'repayment',data:{planId:plan.id,accountId:account,date:'2026-09-15',principal:50000,fee:0,feeCategory:'其他'}},ctx,actions);assert.deepEqual(repayment.missing,[]);await persist();await confirm(repayment);assert.equal((await listInstallments(user.id)).plans[0].remaining,550000);
const rejected=await prepareChatAction({kind:'schedule',data:{...schedule.data,name:'失败回滚'}},ctx,actions);await db.query('UPDATE accounts SET archived=true WHERE id=$1',[account]);await persist();await assert.rejects(()=>confirm(rejected));assert.equal(Number((await db.query("SELECT count(*) AS n FROM bill_schedules WHERE name='失败回滚'")).rows[0].n),0);assert.equal((await db.query('SELECT artifacts FROM finance_turns WHERE id=$1',[turn])).rows[0].artifacts.actions.find((v:any)=>v.id===rejected.id).status,'pending');await db.query('UPDATE accounts SET archived=false WHERE id=$1',[account]);
const stranger={...user,id:randomUUID()};await assert.rejects(()=>confirmChatAction(book,stranger,{id:conversation,turnId:turn,actionId:rejected.id,operation:'confirm_action'}),/不存在/);
const stale=turn;await persist();await assert.rejects(()=>confirmChatAction(book,user,{id:conversation,turnId:stale,actionId:rejected.id,operation:'confirm_action'}),/更新/);
await db.query("UPDATE members SET role='viewer' WHERE book_id=$1 AND user_id=$2",[book,user.id]);await assert.rejects(()=>confirm(rejected),/权限/);await db.query("UPDATE members SET role='owner' WHERE book_id=$1 AND user_id=$2",[book,user.id]);
// Receipt-local IDs must survive into cards so a same-batch refund links to its purchase.
const receiptId=randomUUID();const receipt=await prepareChatAction({kind:'entry',data:{id:receiptId,title:'原消费',kind:'expense',amount:2000,date:'2026-09-14',accountId:account,category:'购物'}},ctx,actions,receiptId);assert.equal(receipt.id,receiptId);assert.equal(receipt.data.id,undefined);
const refund=await prepareChatAction({kind:'entry',data:{title:'原消费退款',kind:'refund',amount:500,date:'2026-09-15',accountId:account,category:'其他',refundOf:receiptId}},ctx,actions,randomUUID());assert.equal(refund.data.category,'购物');await persist();await confirm(receipt);await confirm(refund);assert.equal((await db.query('SELECT refund_of FROM transactions WHERE id=$1',[refund.id])).rows[0].refund_of,receiptId);
// Leave only a fresh unfinished proposal for browser interaction, with no private production data.
const pending=await prepareChatAction({kind:'entry',data:{title:'七鲜晚餐',kind:'expense',amount:5600,accountId:account,category:'餐饮',payee:'七鲜',lineItems:[{name:'牛肉饭',amount:3600},{name:'水果',amount:2000}]}},ctx,[]);
const sub=await prepareChatAction({kind:'schedule',data:{...schedule.data,name:'云盘续费'}},ctx,[]);
await db.query('INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval \'1 day\')',['chat-ui-session',user.id]);
await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,artifacts,status) VALUES($1,$2,'帮我记晚餐56元，再建立一个云盘年费订阅','晚餐和云盘订阅已整理好，请核对后分别确认。',$3,'complete')",[randomUUID(),conversation,{actions:[pending,sub],charts:[],drafts:[],tools:[]}]);
console.log(JSON.stringify({ok:true,book,conversation,user:user.id,checks:'seven operations, missing information, revisions, exactly-once, duplicates, rollback, stale cards, permissions'}));await db.end();
