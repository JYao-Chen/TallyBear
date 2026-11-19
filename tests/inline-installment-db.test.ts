import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test('支出一并建立分期：新消费、旧消费、助手卡、重复提交与事务回滚',{skip:!process.env.INLINE_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.INLINE_TEST_DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.ok(url.pathname.endsWith('_test'));process.env.DATABASE_URL=url.toString();
 const {db,withConnection}=await import('../src/server/db'),{insertEntry}=await import('../src/server/ledger'),{entry}=await import('../src/server/model'),{accountBalance}=await import('../src/server/accounts'),{applyTransactionChange}=await import('../src/server/transaction-changes'),{prepareChatAction,parseAction}=await import('../src/server/chat-actions');
 const c=await db.connect();try{
 for(const schema of ['schema','memory-schema','profile-schema','discussions-schema','expense-claims-schema'])await c.query(await readFile('scripts/'+schema+'.sql','utf8'));
 await c.query('BEGIN');await withConnection(c,async()=>{
 const [user,book,bank,credit]=Array.from({length:4},()=>randomUUID());
 await c.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'测试','unused')",[user]);await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'测试','private',$2)",[book,user]);await c.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
 await c.query("INSERT INTO accounts(id,name,type,owner_id,opening) VALUES($1,'银行卡','bank',$3,200000),($2,'信用卡','credit',$3,0)",[bank,credit,user]);
 const value=entry.parse({id:randomUUID(),kind:'expense',accountId:credit,amount:35228,date:'2026-11-20',title:'衣服分期',category:'其他',installment:{terms:6,firstDate:'2026-12-19',fees:600}});
 assert.equal(await insertEntry(c,book,user,value),1);assert.equal(await insertEntry(c,book,user,value),0);
 const plan=(await c.query('SELECT * FROM installment_plans WHERE id=$1',[value.id])).rows[0];assert.equal(Number(plan.principal),35228);assert.equal(plan.schedule.length,6);assert.equal(plan.schedule.reduce((n:number,r:any)=>n+r.fee,0),600);
 assert.equal(Number((await c.query(`SELECT ${accountBalance} AS balance FROM accounts a WHERE id=$1`,[credit])).rows[0].balance),-35228);assert.equal((await c.query('SELECT count(*)::int AS n FROM installment_payments')).rows[0].n,0);assert.equal((await c.query('SELECT count(*)::int AS n FROM transactions WHERE id=$1',[value.id])).rows[0].n,1);
 const old=entry.parse({...value,id:randomUUID(),installment:undefined});await insertEntry(c,book,user,old);const version=(await c.query('SELECT version FROM transactions WHERE id=$1',[old.id])).rows[0].version;
 const changed=await applyTransactionChange(c,book,user,{operation:'update',transactionId:old.id,version,...old,installment:value.installment});assert.ok(changed.version>version);assert.equal((await c.query('SELECT count(*)::int AS n FROM installment_plans')).rows[0].n,2);
 const actions:any[]=[];const actor=(await c.query('SELECT * FROM users WHERE id=$1',[user])).rows[0];const card=await prepareChatAction({kind:'entry',bookId:book,data:{...value,id:undefined,title:'助手分期'}},{book,user:actor},actions);assert.equal(card.missing.length,0);assert.ok(card.summary.some((s:any)=>s.label==='分期期数'));const parsed=entry.parse(parseAction(card));assert.equal(parsed.installment?.terms,6);await insertEntry(c,book,user,parsed);assert.equal((await c.query('SELECT count(*)::int AS n FROM installment_plans')).rows[0].n,3);
 await c.query('SAVEPOINT invalid');const bad=entry.parse({...value,id:randomUUID(),accountId:bank});await assert.rejects(()=>insertEntry(c,book,user,bad),/负债账户/);await c.query('ROLLBACK TO SAVEPOINT invalid');assert.equal((await c.query('SELECT count(*)::int AS n FROM transactions WHERE id=$1',[bad.id])).rows[0].n,0);
 assert.throws(()=>entry.parse({...value,installment:{terms:6}}),/分期/);
 });
 }finally{await c.query('ROLLBACK');c.release();await db.end();}
});
