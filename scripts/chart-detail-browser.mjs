import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/tallybear_detail_test');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const [uid,book,wallet,tid,token]=Array.from({length:5},()=>randomUUID());
const origin='http://localhost:3119',dir=process.env.TEST_ARTIFACT_DIR;
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir(dir,{recursive:true});
 await db.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'详情测试用户','unused')",[uid]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'详情测试账本','private',$2)",[book,uid]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,uid]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,uid]);
 await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership) VALUES($1,'微信','wechat',$2,'personal')",[wallet,uid]);
 const items=[{name:'烤肉套餐',kind:'item',quantity:1,unitPrice:30000,amount:30000},{name:'满减优惠',kind:'discount',quantity:null,unitPrice:null,amount:-3000},{name:'服务费',kind:'fee',quantity:null,unitPrice:null,amount:200}];
 await db.query("INSERT INTO transactions(id,book_id,account_id,created_by,title,payee,kind,amount,date,category,product,platform,order_id,external_id,occurred_at,note,line_items) VALUES($1,$2,$3,$4,'卡里烤肉 · 三里屯店 · 晚餐','卡里烤肉','expense',27200,current_date,'餐饮','双人烤肉套餐','美团',$5,'PAY20260926000001','19:30:25','周末聚餐\n套餐含饮料。',$6)",[tid,book,wallet,uid,'ORDER-'+ '1234567890'.repeat(8),JSON.stringify(items)]);
 await page.context().addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
  const category=page.locator('.chart-data-legend button').filter({hasText:'餐饮'}).first();await category.click();
  await page.getByRole('dialog').getByRole('button').filter({hasText:'卡里烤肉'}).click();
  const dialog=page.getByRole('dialog');await dialog.getByText('未保存凭证或附图',{exact:true}).waitFor();
  for(const text of ['交易信息','订单信息','商品与结算','优惠与费用','记录信息','凭证与附图','PAY20260926000001','19:30:25','美团','详情测试用户','满减优惠','服务费'])assert(await dialog.getByText(text,{exact:text!=='优惠与费用'}).count()>0,text);
  assert(await dialog.getByText('ORDER-'+ '1234567890'.repeat(8),{exact:true}).count()>0);
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${dir}/chart-detail-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'返回列表',exact:true}).click();await dialog.getByRole('button').filter({hasText:'卡里烤肉'}).waitFor();await dialog.getByRole('button',{name:'关闭弹窗'}).click();
 }
 assert.deepEqual(errors,[]);console.log('PASS: chart -> transaction fields/settlement/receipts -> list; 1440/390/360 no overflow or browser errors');
}finally{await browser.close();await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM accounts WHERE id=$1',[wallet]);await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.end();}
