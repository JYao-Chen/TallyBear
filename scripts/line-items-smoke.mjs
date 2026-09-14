import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,user=randomUUID(),token=randomBytes(32).toString('hex'),books=[];
async function req(path,method='GET',body){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:'bubu_session='+token},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200,!r.ok?await r.text():'');return r.headers.get('content-type')?.includes('json')?r.json():r.text();}
try{
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1,$2,'明细测试','unused')",[user,'items_'+randomBytes(5).toString('hex')]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
 for(let i=0;i<2;i++)books.push((await req('books','POST',{name:'商品明细测试'+i,kind:'private'})).id);
 const book=books[0],accounts=await req(`books/${book}/accounts`),accountId=accounts[0].id;
 const lineItems=[{name:'牛肉面测试商品',quantity:2,unitPrice:1800,amount:3600},{name:'优惠',quantity:1,unitPrice:-500,amount:-500},{name:'免费茶水',quantity:1,unitPrice:0,amount:0}];
 const e={id:randomUUID(),kind:'expense',amount:3100,date:'2026-09-13',accountId,payee:'餐馆',category:'餐饮',lineItems};
 await req(`books/${book}/transactions`,'POST',{entries:[e]});
 let rows=await req(`books/${book}/transactions`);assert.deepEqual(rows[0].line_items,lineItems);
 assert.equal((await req(`books/${book}/accounts`)).find(a=>a.id===accountId).balance,-3100);
 const report=await req(`books/${book}/report?from=2026-09-01&to=2026-09-30&q=${encodeURIComponent('牛肉面测试商品')}`);assert.equal(report.totals.expense,3100);assert.equal(report.rows.length,1);assert.deepEqual(report.rows[0].line_items,lineItems);
 const {lineItems:omitted,...oldClient}=e;await req(`books/${book}/transactions`,'PUT',{...oldClient,version:1,note:'仅改备注'});rows=await req(`books/${book}/transactions`);assert.deepEqual(rows[0].line_items,lineItems);
 const other=(await req(`books/${books[1]}/accounts`))[0];await req(`books/${book}/reuse`,'POST',{id:e.id,version:2,targetBook:books[1],accountId:other.id});assert.deepEqual((await req(`books/${books[1]}/transactions`))[0].line_items,lineItems);
 rows=await req(`books/${book}/transactions`);await req(`books/${book}/transactions`,'PUT',{...e,lineItems:[],version:rows[0].version});rows=await req(`books/${book}/transactions`);assert.deepEqual(rows[0].line_items,[]);
 await req(`books/${book}/transactions`,'POST',{entries:[{action:'merge',mergeId:e.id,mergeVersion:rows[0].version,lineItems}]});rows=await req(`books/${book}/transactions`);assert.deepEqual(rows[0].line_items,lineItems);assert.equal(rows[0].amount,3100);
 await req(`books/${book}/transactions`,'POST',{entries:[{action:'merge',mergeId:e.id,mergeVersion:rows[0].version,lineItems:[{name:'不能覆盖',amount:99}]}]});assert.deepEqual((await req(`books/${book}/transactions`))[0].line_items,lineItems);
 const csv=await req(`books/${book}/export?from=2026-09-01&to=2026-09-30`);assert.ok(csv.includes('牛肉面测试商品'));assert.equal((await req(`books/${book}/accounts`)).find(a=>a.id===accountId).balance,-3100);
 console.log('PASS: 商品明细保存、整单仅扣款一次、按商品搜索、编辑保留/清空、跨本复用、补充不覆盖、CSV导出');
}finally{for(const book of books){await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM accounts WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);}await db.query('DELETE FROM users WHERE id=$1',[user]);await db.end();}
