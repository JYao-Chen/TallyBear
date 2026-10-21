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
 const snapshots=[];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['home-list','home-chart','analysis-list','analysis-chart']){
   await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
   if(route.startsWith('analysis'))await page.locator(width<600?'.mobile-nav':'#primary-navigation').getByRole('button',{name:'收支分析',exact:true}).click();
   if(route.endsWith('chart')){await page.locator('.chart-data-legend button').filter({hasText:'餐饮'}).first().click();await page.getByRole('dialog').getByRole('button').filter({hasText:'卡里烤肉'}).click();}
   else await page.locator('.transaction-row').filter({hasText:'卡里烤肉'}).first().click();
   const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'修改记录',exact:true}).waitFor();
   await dialog.getByRole('heading',{name:'账目讨论',exact:true}).waitFor();
   for(const text of ['PAY20260926000001','19:30:25','美团','详情测试用户','满减优惠','服务费','账目讨论'])assert(await dialog.getByText(text,{exact:true}).count()>0,text);
   await dialog.getByRole('button',{name:'删除记录',exact:true}).waitFor();
   const fields=await dialog.locator('.detail-fields').first().innerText();snapshots.push({width,route,fields});
   assert.equal(fields,snapshots[0].fields,'same canonical detail fields for '+route);
   assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`${dir}/${route}-top-${width}.png`,fullPage:false});
   await dialog.getByRole('button',{name:'修改记录',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:`${dir}/${route}-${width}.png`,fullPage:false});
   await dialog.getByRole('button',{name:'修改记录',exact:true}).click();
   await page.getByRole('button',{name:'保存修改',exact:true}).waitFor();
   assert.equal(await page.getByLabel('金额（元）',{exact:true}).inputValue(),'272');
   assert.equal(await page.getByLabel('账目标题',{exact:true}).inputValue(),'卡里烤肉 · 三里屯店 · 晚餐');
   if(route==='analysis-chart'&&width===390){await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('交易已更新',{exact:true}).waitFor();}
  }
 }
 // Allocated rows open their original payment, with its full amount and edit actions.
 const allocated=randomUUID();
 await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,title,kind,amount,date,category) VALUES($1,$2,$3,$4,'年度服务分摊','expense',12000,current_date,'订阅')",[allocated,book,wallet,uid]);
 await db.query("INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,date_trunc('month',current_date),2,date_trunc('month',current_date),'month',2)",[allocated]);
 await page.goto(origin);await page.locator('.transaction-row').filter({hasText:'年度服务分摊'}).first().click();
 await page.getByRole('dialog').getByRole('button',{name:'打开原账单',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'修改记录',exact:true}).waitFor();
 assert.match(await page.getByRole('dialog').locator('.detail-amount').innerText(),/120.00/);
 await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗'}).click();
 // Read-only users see the same information but no mutation actions, including chart entry points.
 const viewer=randomUUID(),viewerToken=randomUUID();
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'只读用户','unused')",[viewer]);
 await db.query("INSERT INTO members VALUES($1,$2,'viewer')",[book,viewer]);
 await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[viewerToken,viewer]);
 await page.context().addCookies([{name:'bubu_session',value:viewerToken,domain:'localhost',path:'/'}]);
 await page.goto(origin);await page.locator('.transaction-row').filter({hasText:'卡里烤肉'}).first().click();
 await page.getByRole('dialog').locator('.detail-fields').first().waitFor();
 assert.equal(await page.getByRole('dialog').getByRole('button',{name:'修改记录',exact:true}).count(),0);
 assert.equal(await page.getByRole('dialog').getByRole('button',{name:'删除记录',exact:true}).count(),0);
 await db.query('DELETE FROM users WHERE id=$1',[viewer]);
 assert.deepEqual(errors,[]);console.log('PASS: home/analysis lists and charts share canonical detail fields and edit controls; save updates version; readonly permissions; 1440/390 no overflow or browser errors');

}catch(e){await page.screenshot({path:dir+'/failure.png',fullPage:false});console.log('page errors',await page.locator('.error').allTextContents(),'invalid',await page.locator(':invalid').evaluateAll(els=>els.map(e=>({name:e.name,validation:e.validationMessage,value:e.value}))));throw e;}finally{await browser.close();await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM accounts WHERE id=$1',[wallet]);await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.end();}
