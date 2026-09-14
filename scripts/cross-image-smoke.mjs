import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,user=randomUUID(),book=randomUUID(),account=randomUUID(),token=randomBytes(32).toString('hex');
try{
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1,$2,'跨图测试','unused')",[user,'cross_'+randomBytes(5).toString('hex')]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'跨图检查','private',$2)",[book,user]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);await db.query("INSERT INTO accounts(id,book_id,name) VALUES($1,$2,'微信')",[account,book]);
 for(const files of [['order-part1.png','order-part2.png'],['order-long.png']]){
  console.log('Checking',files.length===1?'long screenshot':'overlapping screenshots');
  const images=files.map(f=>'data:image/png;base64,'+readFileSync(new URL('../tests/fixtures/'+f,import.meta.url)).toString('base64'));
  const r=await fetch(`${base}/api/books/${book}/assistant`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:'bubu_session='+token},body:JSON.stringify({text:'这些图片属于同一笔订单，可能有重叠或是长截图。完整归并所有菜品/商品明细、数量、单价及小计，不要把商品拆成多笔交易。',images,orderMode:'single'}),signal:AbortSignal.timeout(180000)});
  assert.equal(r.status,200,!r.ok?await r.text():'');const result=await r.json();assert.equal(result.entries.length,1);const e=result.entries[0];assert.equal(e.amount,7000);assert.equal(e.lineItems.reduce((n,i)=>n+(i.amount??0),0),7000);assert.equal(e.lineItems.filter(i=>i.amount===-700).length,1);
  // Two identical purchased rows may stay separate or be combined with quantity 2.
  const tea=e.lineItems.filter(i=>/tea|茶/i.test(i.name));assert.equal(tea.reduce((n,i)=>n+(i.quantity??0),0),2);assert.equal(tea.reduce((n,i)=>n+(i.amount??0),0),1000);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM transactions WHERE book_id=$1',[book])).rows[0].n,0);
  console.log('PASS:',files.length===1?'long image':'cross-image','one 70 yuan order, full details, discount once, two real teas retained, no transaction written');
 }
}finally{await db.query('DELETE FROM accounts WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM users WHERE id=$1',[user]);await db.end();}
