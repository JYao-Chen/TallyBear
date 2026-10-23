import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {db} from '../src/server/db';
import {allocations} from '../src/server/allocations';
import {createAccount,listAssets} from '../src/server/accounts';
import {report} from '../src/server/reports';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_range_test'),'Use an isolated range_test database');
const user=randomUUID(),book=randomUUID(),expense=randomUUID(),refund=randomUUID();
try{
 for(const file of ['schema.sql','memory-schema.sql','discussions-schema.sql','expense-claims-schema.sql'])await db.query(readFileSync(new URL(file,import.meta.url),'utf8'));
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$2)',[user,user]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'Range test','private',$2)",[book,user]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
 const account=(await createAccount(user,{name:'Test cash',opening:100000,type:'cash'})).id;
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id) VALUES($1,$2,$3,'expense',37200,'2026-10-23','Range expense',$4,$1)",[expense,book,account,user]);
 const balance=JSON.stringify(await listAssets(user));
 await allocations(book,'PUT',{id:expense,version:1,startDate:'2026-10-23',endDate:'2027-10-29'},new URLSearchParams());
 const stored=(await db.query("SELECT to_char(start_date,'YYYY-MM-DD') AS start,period_unit,period_count FROM expense_allocations WHERE transaction_id=$1",[expense])).rows[0];assert.deepEqual(stored,{start:'2026-10-23',period_unit:'day',period_count:372});
 async function check(month:string,expected:number){
  const a=await allocations(book,'GET',{},new URLSearchParams({month}));assert.ok('allocated' in a);assert.equal(a.allocated,expected);assert.equal(a.ordinary,0);assert.equal(a.items[0].end,'2027-10-29');
  const from=month+'-01',next=new Date(Date.parse(from));next.setUTCMonth(next.getUTCMonth()+1);const to=new Date(next.getTime()-86400000).toISOString().slice(0,10);
  const r=await report(book,new URLSearchParams({from,to}));assert.equal(r.totals.expense-r.totals.refund,expected,month+' report');
 }
 for(const [month,expected] of [['2026-09',0],['2026-10',900],['2026-11',3000],['2027-10',2900],['2027-11',0]] as const)await check(month,expected);
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id,refund_of) VALUES($1,$2,$3,'refund',3720,'2026-11-01','Range refund',$4,$1,$5)",[refund,book,account,user,expense]);await check('2026-10',810);await check('2027-10',2610);
 const beforeInvalid=JSON.stringify((await db.query('SELECT * FROM expense_allocations WHERE transaction_id=$1',[expense])).rows);await assert.rejects(allocations(book,'PUT',{id:expense,version:2,startDate:'2026-10-23',endDate:'2026-10-22'},new URLSearchParams()));assert.equal(JSON.stringify((await db.query('SELECT * FROM expense_allocations WHERE transaction_id=$1',[expense])).rows),beforeInvalid);
 await db.query('DELETE FROM transactions WHERE id=$1',[refund]);assert.equal(JSON.stringify(await listAssets(user)),balance,'Allocations must not change wallet balances');
 await allocations(book,'PUT',{id:expense,version:2,remove:true},new URLSearchParams());assert.equal((await db.query('SELECT * FROM expense_allocations WHERE transaction_id=$1',[expense])).rowCount,0);
 console.log('PASS: exact dates survive PostgreSQL, partial months match reports, refunds, invalid rollback, wallet unchanged and cancellation.');
}finally{await db.end();}
