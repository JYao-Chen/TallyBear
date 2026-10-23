import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {db} from '../src/server/db';import {prepareChatAction,confirmChatAction} from '../src/server/chat-actions';import {createAccount,listAssets} from '../src/server/accounts';import type {ChatAction} from '../src/lib/chat-actions';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_range_test'),'Use an isolated range_test database');
const user={id:randomUUID(),username:randomUUID(),name:'Assistant range test',admin:false,avatar:'',theme:'bear' as const},book=randomUUID(),expense=randomUUID(),conversation=randomUUID();
try{
 for(const file of ['schema.sql','memory-schema.sql','profile-schema.sql','discussions-schema.sql','expense-claims-schema.sql'])await db.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$3,$4)',[user.id,user.username,user.name,'test']);await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'Assistant range','private',$2)",[book,user.id]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user.id]);
 await db.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'Range')",[conversation,book,user.id]);
 const account=(await createAccount(user.id,{name:'Test cash',opening:100000,type:'cash'})).id;
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id) VALUES($1,$2,$3,'expense',37200,'2026-10-23','Range expense',$4,$1)",[expense,book,account,user.id]);
 const balance=JSON.stringify(await listAssets(user.id)),ctx={book,user},actions:ChatAction[]=[];
 let a=await prepareChatAction({kind:'allocation',data:{transactionId:expense,startDate:'2026-10-23',endDate:'2027-10-29',periodUnit:'month',periodCount:12}},ctx,actions);
 assert.deepEqual(a.missing,[]);assert.equal(a.data.startDate,'2026-10-23');assert.equal(a.data.periodCount,372);assert.ok(a.summary.some(x=>x.value==='2027-10-29'));assert.ok(a.summary.some(x=>x.value.includes('9.00')));assert.ok(a.warnings.some(x=>x.includes('首尾')||x.includes('开始和结束当天')||x.includes('boundary')));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM expense_allocations WHERE transaction_id=$1',[expense])).rows[0].n,0,'Preparing must not write');
 a=await prepareChatAction({actionId:a.id,kind:'allocation',data:{endDate:'2027-10-30'}},ctx,actions);assert.equal(actions.length,1);assert.equal(a.data.periodCount,373);
 a=await prepareChatAction({actionId:a.id,kind:'allocation',data:{endDate:'2027-10-29'}},ctx,actions);
 const turn=randomUUID();await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,artifacts,status) VALUES($1,$2,'Allocate the supplied date range','Confirm the card',$3,'complete')",[turn,conversation,{actions}]);
 const confirm=()=>confirmChatAction(book,user,{id:conversation,turnId:turn,actionId:a.id,operation:'confirm_action'});
 await confirm();await confirm();
 const row=(await db.query("SELECT to_char(start_date,'YYYY-MM-DD') AS start,period_unit,period_count FROM expense_allocations WHERE transaction_id=$1",[expense])).rows[0];assert.deepEqual(row,{start:'2026-10-23',period_unit:'day',period_count:372});
 assert.equal((await db.query('SELECT version FROM transactions WHERE id=$1',[expense])).rows[0].version,2,'Repeated confirmation must not write twice');assert.equal(JSON.stringify(await listAssets(user.id)),balance);
 const legacy=await prepareChatAction({kind:'allocation',data:{transactionId:expense,startDate:'2026-10-23',periodUnit:'month',periodCount:12}},ctx,[]);assert.equal(legacy.data.startDate,'2026-10-01');
 const range=await prepareChatAction({actionId:legacy.id,kind:'allocation',data:{startDate:'2026-10-23',endDate:'2027-10-29'}},ctx,[legacy]);assert.equal(range.data.startDate,'2026-10-23');
 const fixed=await prepareChatAction({actionId:range.id,kind:'allocation',data:{endDate:null,periodUnit:'month',periodCount:12}},ctx,[range]);assert.equal(fixed.data.startDate,'2026-10-01');assert.deepEqual(fixed.missing,[]);
 console.log('PASS: assistant exact dates, card summary, draft edits, explicit confirmation, exactly once, fixed-period compatibility and wallet unchanged; no model API called.');
}finally{await db.end();}
