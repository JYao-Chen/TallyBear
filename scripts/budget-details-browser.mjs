import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/tallybear_detail_test');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const [uid,book,wallet,tid,token]=Array.from({length:5},()=>randomUUID());
const origin='http://localhost:3119',dir=process.env.TEST_ARTIFACT_DIR;
const browser=await chromium.launch({headless:true}),page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.request().method()==='PUT'&&r.url().includes('/transactions'))console.log('save response',r.status(),await r.text());});
try{
 await mkdir(dir,{recursive:true});
 await db.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'详情测试用户','unused')",[uid]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'详情测试账本','shared',$2)",[book,uid]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,uid]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,uid]);
 await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership) VALUES($1,'微信','wechat',$2,'personal')",[wallet,uid]);
 const items=[{name:'烤肉套餐',kind:'item',quantity:1,unitPrice:30000,amount:30000},{name:'满减优惠',kind:'discount',quantity:null,unitPrice:null,amount:-3000},{name:'服务费',kind:'fee',quantity:null,unitPrice:null,amount:200}];
 await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,title,payee,kind,amount,date,category,product,platform,order_id,external_id,occurred_at,note,line_items) VALUES($1,$2,$3,$4,'卡里烤肉 · 三里屯店 · 晚餐','卡里烤肉','expense',27200,current_date,'餐饮','双人烤肉套餐','美团',$5,'PAY20260926000001','19:30:25','周末聚餐\n套餐含饮料。',$6)",[tid,book,wallet,uid,'ORDER-'+ '1234567890'.repeat(8),JSON.stringify(items)]);
 await page.context().addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
 const month=(await db.query("SELECT to_char(current_date,'YYYY-MM') AS month")).rows[0].month;
 for(let i=0;i<11;i++)await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,category,title) VALUES(gen_random_uuid(),$1,$2,$3,'expense',100,current_date,'餐饮',$4)",[book,wallet,uid,'分页消费'+i]);
 await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,category,title) VALUES(gen_random_uuid(),$1,$2,$3,'refund',1200,current_date,'餐饮','退款抵扣')",[book,wallet,uid]);
 async function navigateBudget(width){await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});if(width<600){await page.locator('.mobile-nav').getByRole('button',{name:'更多功能'}).click();await page.getByRole('dialog').getByRole('button',{name:'每月预算',exact:true}).click();}else await page.locator('#primary-navigation').getByRole('button',{name:'每月预算',exact:true}).click();}
 for(const width of [1440,390]){
  await db.query('DELETE FROM budgets WHERE book_id=$1',[book]);await db.query("INSERT INTO budgets VALUES($1,$2,'餐饮旧',10000)",[book,month]);
  await page.setViewportSize({width,height:1000});await navigateBudget(width);
  await page.locator('.budget-card').filter({hasText:'餐饮旧'}).click();
  await page.getByText('本月此分类暂无消费。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'修改预算',exact:true}).click();
  const edit=page.getByRole('dialog');await edit.locator('.visual-trigger').click();await page.getByRole('button',{name:'餐饮',exact:true}).click();
  await page.getByRole('dialog').locator('input[name=amount]').fill('300');
  await page.screenshot({path:dir+'/edit-'+width+'.png'});
  await page.getByRole('button',{name:'保存预算',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  const card=page.locator('.budget-card').filter({hasText:'餐饮'});await card.waitFor();assert.match(await card.innerText(),/271.00/);assert.match(await card.innerText(),/300.00/);
  const rows=(await db.query('SELECT category,amount FROM budgets WHERE book_id=$1',[book])).rows;assert.equal(rows.length,1);assert.equal(rows[0].category,'餐饮');assert.equal(Number(rows[0].amount),30000);
  await page.screenshot({path:dir+'/cards-'+width+'.png'});await card.click();
  const detail=page.getByRole('dialog');await detail.locator('.transaction-row').first().waitFor();assert.match(await detail.innerText(),/271.00/);assert.equal(await detail.locator('.transaction-row').count(),10);
  assert(await detail.evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:dir+'/details-'+width+'.png'});
  await detail.getByRole('button',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dialog .transaction-row').length===3);
  await detail.getByRole('button',{name:'上一页',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dialog .transaction-row').length===10);
  if(!await detail.locator('.transaction-row').filter({hasText:'卡里烤肉'}).count()){await detail.getByRole('button',{name:'下一页',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dialog .transaction-row').length===3);}
  await detail.locator('.transaction-row').filter({hasText:'卡里烤肉'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'修改记录',exact:true}).waitFor();
  assert.match(await page.getByRole('dialog').locator('.detail-amount').innerText(),/272.00/);
  await page.getByRole('dialog').getByRole('button',{name:'删除记录',exact:true}).waitFor();
  await page.screenshot({path:dir+'/entry-'+width+'.png'});
  await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗'}).click();
 }
 // Renaming cannot overwrite an existing budget, and a missing source cannot create a replacement.
 await db.query("INSERT INTO budgets VALUES($1,$2,'已有预算',5000)",[book,month]);
 let response=await page.request.put(origin+'/api/books/'+book+'/budgets',{headers:{Origin:origin},data:{month,previousCategory:'餐饮',category:'已有预算',amount:1}});assert.equal(response.status(),409);
 assert.equal(Number((await db.query("SELECT amount FROM budgets WHERE book_id=$1 AND category='已有预算'",[book])).rows[0].amount),5000);
 response=await page.request.put(origin+'/api/books/'+book+'/budgets',{headers:{Origin:origin},data:{month,previousCategory:'不存在',category:'新分类',amount:1}});assert.equal(response.status(),409);
 const viewer=randomUUID(),viewerToken=randomUUID();await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'只读用户','unused')",[viewer]);await db.query("INSERT INTO members VALUES($1,$2,'viewer')",[book,viewer]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[viewerToken,viewer]);await page.context().addCookies([{name:'bubu_session',value:viewerToken,domain:'localhost',path:'/'}]);
 await navigateBudget(390);await page.locator('.budget-card').filter({hasText:'餐饮'}).click();await page.getByRole('dialog').locator('.transaction-row').first().waitFor();assert.equal(await page.getByRole('button',{name:'修改预算',exact:true}).count(),0);
 response=await page.request.put(origin+'/api/books/'+book+'/budgets',{headers:{Origin:origin},data:{month,category:'餐饮',amount:1}});assert.equal(response.status(),403);
 await db.query('DELETE FROM users WHERE id=$1',[viewer]);assert.deepEqual(errors,[]);
 console.log('PASS: category/amount edit and refresh, old category removed, refund net spending, monthly category details and pagination, unified canonical entry with actions, readonly view/403, conflict and missing-source protection; 1440/390 no overflow or browser errors');
}catch(e){await page.screenshot({path:dir+'/failure.png',fullPage:false});console.log('page errors',await page.locator('.error').allTextContents(),'invalid',await page.locator(':invalid').evaluateAll(els=>els.map(e=>({name:e.name,validation:e.validationMessage,value:e.value}))));throw e;}finally{await browser.close();await db.query('DELETE FROM budgets WHERE book_id=$1',[book]);await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM accounts WHERE id=$1',[wallet]);await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.end();}
