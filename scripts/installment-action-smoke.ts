import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
import {db} from '../src/server/db';import {prepareChatAction,confirmChatAction} from '../src/server/chat-actions';import {createAccount,listAssets} from '../src/server/accounts';import type {ChatAction} from '../src/lib/chat-actions';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_range_test'),'Use an isolated range_test database');
const user={id:randomUUID(),username:randomUUID(),name:'Assistant range test',admin:false,avatar:'',theme:'bear' as const},book=randomUUID(),expense=randomUUID(),conversation=randomUUID();
try{
 for(const file of ['schema.sql','memory-schema.sql','profile-schema.sql','discussions-schema.sql','expense-claims-schema.sql'])await db.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$3,$4)',[user.id,user.username,user.name,'test']);await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'Assistant range','private',$2)",[book,user.id]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user.id]);
 await db.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'Range')",[conversation,book,user.id]);
 const account=(await createAccount(user.id,{name:'Test cash',opening:0,type:'credit'})).id;
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id) VALUES($1,$2,$3,'expense',37200,'2026-10-23','Range expense',$4,$1)",[expense,book,account,user.id]);
 const balance=JSON.stringify(await listAssets(user.id)),ctx={book,user},actions:ChatAction[]=[];
 const a=await prepareChatAction({kind:'installment',data:{transactionId:expense,name:'Test installment',terms:6,firstDate:'2026-11-19',fees:0,allocate:true}},ctx,actions);
 assert.ok(a.missing.includes('费用分摊起始月份'));assert.ok(a.missing.includes('费用分摊月数'));
 const turn=randomUUID();await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,artifacts,status) VALUES($1,$2,'Prepare installment','Confirm the card',$3,'complete')",[turn,conversation,{actions}]);
 const request={id:conversation,turnId:turn,actionId:a.id};
 await confirmChatAction(book,user,{...request,operation:'edit_action',data:{allocationStart:'2026-10-01',allocationMonths:12}});
 const updated=(await db.query('SELECT artifacts FROM finance_turns WHERE id=$1',[turn])).rows[0].artifacts.actions[0];assert.deepEqual(updated.missing,[]);assert.equal(updated.data.terms,6);assert.equal(updated.data.firstDate,'2026-11-19');
 await confirmChatAction(book,user,{...request,operation:'confirm_action'});await confirmChatAction(book,user,{...request,operation:'confirm_action'});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM installment_plans WHERE id=$1',[a.id])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM installment_payments')).rows[0].n,0);
 const allocation=(await db.query("SELECT to_char(start_date,'YYYY-MM-DD') AS start,period_count FROM expense_allocations WHERE transaction_id=$1",[expense])).rows[0];assert.deepEqual(allocation,{start:'2026-10-01',period_count:12});
 assert.equal(JSON.stringify(await listAssets(user.id)),balance);assert.equal((await db.query('SELECT count(*)::int AS n FROM transactions WHERE book_id=$1',[book])).rows[0].n,1);
 console.log('PASS: incomplete existing installment card edited, missing cleared, confirmed once, independent allocation persisted, no duplicate purchase or repayment, wallet unchanged.');
}finally{await db.end();}
