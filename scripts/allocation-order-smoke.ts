import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,transaction} from '../src/server/db';
import {insertEntry} from '../src/server/ledger';
import {entry} from '../src/server/model';
import {report} from '../src/server/reports';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_order_test');
const user=randomUUID(),book=randomUUID(),wallet=randomUUID(),allocation=randomUUID(),real=randomUUID();
try{
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'排序测试','not-a-login')",[user]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'排序测试','private',$2)",[book,user]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership,opening) VALUES($1,'测试钱包','cash',$2,'personal',100000)",[wallet,user]);
 for(const data of [{id:allocation,amount:12000,date:'2026-10-15',occurredAt:'21:30',title:'未来覆盖分摊'},{id:real,amount:500,date:'2026-11-01',occurredAt:'10:30',title:'实时消费'}])await transaction(c=>insertEntry(c,book,user,entry.parse({...data,accountId:wallet,kind:'expense',category:'购物'})));
 await db.query("INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,'2026-11-01',12,'2026-11-27','day',365)",[allocation]);
 const params=new URLSearchParams({from:'2026-11-01',to:'2026-11-30',limit:'1'});
 const first=await report(book,params,user);assert.equal(first.rows[0].id,real);assert.equal(first.totals.count,2);
 params.set('offset','1');const second=await report(book,params,user);assert.ok(second.rows[0].cost_row_key);assert.equal(second.rows[0].occurred_at,'00:00:00');assert.equal(second.rows[0].date,'2026-11-27');
 params.set('sort','date_asc');params.set('offset','0');assert.equal((await report(book,params,user)).rows[0].id,real);
 const original=(await db.query('SELECT occurred_at,amount::float8 amount FROM transactions WHERE id=$1',[allocation])).rows[0];assert.equal(original.occurred_at,'21:30');assert.equal(original.amount,12000);
 params.set('sort','amount_desc');assert.deepEqual((await report(book,params,user)).totals,first.totals);
 params.set('basis','cashflow');const cash=await report(book,params,user);assert.equal(cash.totals.expense,500);assert.equal(cash.rows[0].id,real);
 console.log('PASS: real transactions precede allocations before pagination, allocated time is midnight, future coverage remains correct, totals and source payment/cashflow are unchanged.');
}finally{await db.end();}
