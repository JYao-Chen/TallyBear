import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {passwordHash} from '../src/server/auth';
const base=process.env.TEST_BASE_URL!;
assert.ok(base&&new URL(process.env.DATABASE_URL!).pathname.endsWith('_organize_test'),'Use the isolated organize test database');
const user=randomUUID(),source=randomUUID(),target=randomUUID(),third=randomUUID(),denied=randomUUID();
const password=randomUUID(),token=randomUUID();
await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$4,$2,$3)',[user,'整理体验',passwordHash(password),user]);
await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '2 hours')",[token,user]);
for(const [id,name] of [[source,'我的日常'],[target,'家庭生活'],[third,'旅行账本'],[denied,'只读账本']]){await db.query("INSERT INTO books(id,name,kind,owner_id,icon) VALUES($1,$2,'shared',$3,'📒')",[id,name,user]);await db.query('INSERT INTO members VALUES($1,$2,$3)',[id,user,id===denied?'viewer':'owner']);}
const cookie=`bubu_session=${token}`;
async function req(p:string,method='GET',body?:unknown,status=200){const r=await fetch(base+'/api/'+p,{method,headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const account=(await req('assets','POST',{name:'我的支付宝',opening:100000})).id;
const value=(id=randomUUID(),amount=1200)=>({id,accountId:account,kind:'expense',amount,date:'2026-09-14',category:'餐饮',title:'午餐',payee:'街角食堂'});
const a=value(),b=value(undefined,1800),refund={...value(undefined,200),kind:'refund',refundOf:a.id,title:'午餐退款'};
await req(`books/${source}/transactions`,'POST',{entries:[a,b,refund]});
const upload=await fetch(base+`/api/receipts?book=${source}`,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'image/png','x-file-name':'receipt.png'},body:await readFile(new URL('../tests/fixtures/itemized-receipt.png',import.meta.url))});assert.equal(upload.status,200);const fileId=(await upload.json()).data.split('/').at(-1);
await req(`books/${source}/transactions`,'PUT',{...a,version:1,attachmentIds:[fileId],retainReceipts:true});
await req(`books/${source}/allocations`,'PUT',{id:a.id,version:2,start:'2026-09',months:3});
const balance=async()=>(await req('assets')).find((x:any)=>x.id===account).balance;
const rows=async(book:string)=>await req(`books/${book}/transactions`);
const preview=async(ids:string[])=>await req(`books/${source}/organize?`+ids.map(id=>'id='+id).join('&'));
const versions=(p:any)=>Object.fromEntries(p.records.map((r:any)=>[r.id,r.version]));
const before=await balance();assert.equal(before,97200);
let p=await preview([a.id,b.id]);assert.equal(p.records.length,3);
await req(`books/${source}/organize`,'POST',{ids:[a.id,b.id],operation:'copy',targetBook:denied,versions:versions(p)},403);
await req(`books/${source}/organize`,'POST',{ids:[a.id,b.id],operation:'copy',targetBook:target,versions:versions(p)});
assert.equal(await balance(),before);assert.equal((await rows(target)).length,3);
const copiedExpense=(await rows(target)).find((r:any)=>r.kind==='expense'&&r.amount===1200);const attachments=await req(`books/${target}/receipts?transaction=${copiedExpense.id}`);assert.equal(attachments.length,1);assert.notEqual(attachments[0].id,fileId);assert.equal((await fetch(base+'/api/receipts/'+attachments[0].id,{headers:{Cookie:cookie}})).status,200);assert.equal((await req(`books/${target}/allocations?month=2026-09`)).items.length,1);
p=await preview([a.id,b.id]);const repeat=await req(`books/${source}/organize`,'POST',{ids:[a.id,b.id],operation:'copy',targetBook:target,versions:versions(p)});assert.equal(repeat.skipped,3);
await req(`books/${source}/organize`,'POST',{ids:[a.id,b.id],operation:'move',targetBook:third,versions:{...versions(p),[b.id]:-1}},409);assert.equal((await rows(source)).length,3);
await req(`books/${source}/organize`,'POST',{ids:[a.id,b.id],operation:'move',targetBook:third,versions:versions(p)});assert.equal((await rows(source)).length,0);assert.equal(await balance(),before);
// Direct destination entry and atomic edit + destination change.
const direct=value(undefined,500);await req(`books/${source}/transactions`,'POST',{entries:[direct],targetBook:target});assert.ok((await rows(target)).some((r:any)=>r.id===direct.id));
let row=(await rows(target)).find((r:any)=>r.id===direct.id);
await req(`books/${target}/transactions`,'PUT',{...direct,title:'不应保存',version:row.version,targetBook:denied},403);assert.equal((await rows(target)).find((r:any)=>r.id===direct.id).title,'午餐');
await req(`books/${target}/transactions`,'PUT',{...direct,title:'已改名并移动',version:row.version,targetBook:source});assert.equal((await rows(source)).find((r:any)=>r.id===direct.id).title,'已改名并移动');
// Separate destinations in a single intake save.
const c=value(undefined,300),d=value(undefined,400);await req(`books/${source}/transactions`,'POST',{entries:[{...c,targetBook:source},{...d,targetBook:target}]});assert.ok((await rows(source)).some((r:any)=>r.id===c.id));assert.ok((await rows(target)).some((r:any)=>r.id===d.id));
// Refund/original conflicts roll back the entire intake.
const conflict=value(),cr={...value(undefined,50),kind:'refund',refundOf:conflict.id};await req(`books/${source}/transactions`,'POST',{entries:[{...conflict,targetBook:target},{...cr,targetBook:third}]},400);assert.equal((await db.query('SELECT 1 FROM transactions WHERE id=$1',[conflict.id])).rowCount,0);
// Group removal from a copied book leaves the actual expense and balance intact.
const targetRows=await rows(target),copy=targetRows.find((r:any)=>r.event_id&&r.kind==='expense'&&r.amount===1200);
const dp=await req(`books/${target}/organize?id=${copy.id}`);const preDelete=await balance();await req(`books/${target}/organize`,'POST',{ids:[copy.id],operation:'delete',versions:versions(dp)});assert.equal(await balance(),preDelete);
// Transfer cannot be linked-copied; preceding batch operations must roll back.
const second=(await req('assets','POST',{name:'现金',opening:0})).id,transfer={...value(undefined,100),kind:'transfer',targetId:second};await req(`books/${source}/transactions`,'POST',{entries:[transfer]});p=await preview([c.id,transfer.id]);await req(`books/${source}/organize`,'POST',{ids:[c.id,transfer.id],operation:'copy',targetBook:third,versions:versions(p)},400);assert.equal((await db.query('SELECT event_id FROM transactions WHERE id=$1',[c.id])).rows[0].event_id,null);
console.log('PASS: batch copy/move/delete, refunds, deduplicated balances, permissions, stale versions, atomic edits, intake destinations, batch rollback');
console.log(JSON.stringify({browserSession:token,user,source,target}));await db.end();
