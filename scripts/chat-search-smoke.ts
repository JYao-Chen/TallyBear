import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {executeFinanceTool,type AgentArtifact} from '../src/server/finance-agent';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_chat_test');
const [u,other,shared,personal,hidden,wallet,id]=Array.from({length:7},()=>randomUUID());
try{
 for(const user of [u,other])await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'test','unused')",[user]);
 for(const [book,owner] of [[shared,u],[personal,u],[hidden,other]]){await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1::uuid,$1::text,'private',$2)",[book,owner]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,owner]);}
 await db.query("INSERT INTO accounts(id,name,owner_id,ownership) VALUES($1,'test',$2,'personal')",[wallet,u]);
 for(const [tid,book] of [[id,personal],[randomUUID(),hidden]])await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,title) VALUES($1,$2,$3,$4,'expense',96437,'2026-09-22','京东白条还款')",[tid,book,wallet,book===hidden?other:u]);
 const ctx={book:shared,analysisBooks:[shared],user:{id:u,username:'test',name:'test',admin:false,avatar:'',theme:'bear' as const},images:[],signal:new AbortController().signal};
 const a:AgentArtifact={charts:[],drafts:[],tools:[]};
 const local=await executeFinanceTool('find_transactions',{from:'2026-09-01',to:'2026-09-30',query:'白条'},ctx,a);
 assert.equal(local.totals.count,0);
 const global=await executeFinanceTool('search_system',{query:'白条',entity:'transaction',min:96437,max:96437},ctx,a);
 assert.equal(global.total,1);assert.equal(global.rows[0].id,id);assert.equal(global.rows[0].book_id,personal);
 const exact=await executeFinanceTool('search_system',{id,entity:'transaction'},ctx,a);assert.equal(exact.rows[0].detail.amount,96437);
 assert.deepEqual(ctx.analysisBooks,[shared]);
 await executeFinanceTool('prepare_transaction_change',{operation:'update',bookId:personal,transactionId:id,changes:{title:'已核对的白条还款'}},ctx,a);
 assert.equal(a.actions?.[0].data.amount,96437);assert.equal(a.actions?.[0].bookId,personal);
 assert.equal((await db.query('SELECT title FROM transactions WHERE id=$1',[id])).rows[0].title,'京东白条还款');
 console.log('PASS: scoped miss, cross-book recovery, exact ID, amount filter, inaccessible book exclusion, scope unchanged');
}finally{await db.query('DELETE FROM transactions WHERE book_id=ANY($1::uuid[])',[[shared,personal,hidden]]);await db.query('DELETE FROM accounts WHERE id=$1',[wallet]);await db.query('DELETE FROM books WHERE id=ANY($1::uuid[])',[[shared,personal,hidden]]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[u,other]]);await db.end();}
