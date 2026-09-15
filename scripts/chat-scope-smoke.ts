import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {report} from '../src/server/reports';
import {executeFinanceTool} from '../src/server/finance-agent';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_scope_test'));
const u=randomUUID(),a=randomUUID(),books=[randomUUID(),randomUUID()],event=randomUUID();
await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$2)',[u,u]);
for(const b of books){await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'test','private',$2)",[b,u]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[b,u]);}
await db.query("INSERT INTO accounts(id,name,owner_id,ownership) VALUES($1,'test',$2,'personal')",[a,u]);
for(const b of books)await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,created_by,event_id) VALUES($1,$2,$3,'expense',1200,'2026-09-15',$4,$5)",[randomUUID(),b,a,u,event]);
await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,created_by,event_id) VALUES($1,$2,$3,'expense',800,'2026-09-15',$4,$1)",[randomUUID(),books[1],a,u]);
const p=new URLSearchParams({from:'2026-09-01',to:'2026-09-30'});
assert.equal((await report(books[0],p)).totals.expense,1200);
assert.equal((await report(books,p)).totals.expense,2000);
await assert.rejects(()=>executeFinanceTool('financial_summary',{from:'2026-09-01',to:'2026-09-30'},{book:books[0],analysisBooks:[randomUUID()],user:{id:u} as any,images:[],signal:new AbortController().signal},{charts:[],tools:[],drafts:[]}),/无权/);
console.log('PASS: single-book 1200; multi-book deduplicated 2000; unauthorized book rejected');await db.end();
