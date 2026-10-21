import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/tallybear_rename_test');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
const [user,book,wallet,old,changed,historical,token]=Array.from({length:7},()=>randomUUID());
const origin='http://localhost:3119';
try{
 await c.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'预算改名测试','unused')",[user]);
 await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'改名测试','shared',$2)",[book,user]);await c.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
 await c.query("INSERT INTO accounts(id,name,type,ownership,owner_id) VALUES($1,'钱包','cash','personal',$2)",[wallet,user]);await c.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
 for(const [id,date] of [[old,'2026-10-01'],[changed,'2026-10-02'],[historical,'2026-09-01']])await c.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,category) VALUES($1,$2,$3,$4,'expense',2000,$5,'旧奶茶')",[id,book,wallet,user,date]);
 await c.query("UPDATE transactions SET category='其他',version=version+1 WHERE id=$1",[changed]);await c.query("INSERT INTO budgets VALUES($1,'2026-10','旧奶茶',10000)",[book]);
 const request=async body=>fetch(origin+'/api/books/'+book+'/budgets',{method:'PUT',headers:{Origin:origin,Cookie:'bubu_session='+token,'Content-Type':'application/json'},body:JSON.stringify({month:'2026-10',...body})});
 let r=await request({previousCategory:'旧奶茶',category:'奶茶',amount:12000});assert.equal(r.status,200,await r.text());
 for(const id of [old,historical]){const row=(await c.query('SELECT * FROM transactions WHERE id=$1',[id])).rows[0];assert.equal(row.category,'奶茶');assert.equal(row.version,2);assert.equal(Number(row.amount),2000);assert.equal(row.account_id,wallet);}
 const preserved=(await c.query('SELECT * FROM transactions WHERE id=$1',[changed])).rows[0];assert.equal(preserved.category,'其他');assert.equal(preserved.version,2);
 assert.equal((await c.query('SELECT category FROM budgets WHERE book_id=$1',[book])).rows[0].category,'奶茶');
 await c.query("INSERT INTO budgets VALUES($1,'2026-10','其他',5000)",[book]);r=await request({previousCategory:'奶茶',category:'其他',amount:1});assert.equal(r.status,409);assert.equal((await c.query('SELECT category FROM transactions WHERE id=$1',[old])).rows[0].category,'奶茶');
 console.log('PASS: budget rename API updates still-old current/historical entries, preserves manually changed records and money/wallets, and does not change records on budget conflict');
}finally{await c.query('DELETE FROM budgets WHERE book_id=$1',[book]);await c.query('DELETE FROM transactions WHERE book_id=$1',[book]);await c.query('DELETE FROM books WHERE id=$1',[book]);await c.query('DELETE FROM accounts WHERE id=$1',[wallet]);await c.query('DELETE FROM users WHERE id=$1',[user]);await c.end();}
