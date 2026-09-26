import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_memory_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
await c.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
const user=(await c.query("SELECT id FROM users WHERE name='真实模型五案例' ORDER BY created_at DESC LIMIT 1")).rows[0];
const book=(await c.query('SELECT id FROM books WHERE owner_id=$1 LIMIT 1',[user.id])).rows[0];
const account=(await c.query('SELECT id FROM accounts WHERE owner_id=$1 LIMIT 1',[user.id])).rows[0];
const item=(name,amount,kind='item')=>({id:randomUUID(),name,amount,kind,quantity:null,unitPrice:null});
const items=[...Array.from({length:8},(_,n)=>item('商品'+(n+1),2000)),item('满减',-1000,'discount'),item('平台红包',-500,'discount'),item('手续费',300,'fee')];
const draft={id:randomUUID(),kind:'expense',amount:14800,date:'2026-09-26',accountId:account.id,category:'购物',payee:'测试商家',title:'测试订单',product:'本次商品',note:'',lineItems:items,scene:{type:'general'}};
await c.query("INSERT INTO entry_drafts(book_id,user_id,section,value) VALUES($1,$2,'intake',$3) ON CONFLICT(book_id,user_id,section) DO UPDATE SET value=$3,version=entry_drafts.version+1",[book.id,user.id,{text:'',history:true,entries:[draft]}]);
const token=randomUUID();await c.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user.id]);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const origin=process.env.TEST_ORIGIN||'http://localhost:3119';await page.context().addCookies([{name:'bubu_session',value:token,domain:new URL(origin).hostname,path:'/'}]);await page.goto(origin);
 await page.getByRole('navigation').getByRole('button',{name:'记一笔',exact:true}).click();
 const goods=page.getByRole('region',{name:'商品明细',exact:true}),adjustments=page.getByRole('region',{name:'优惠与费用',exact:true});
 await adjustments.waitFor();assert.equal(await goods.locator('.line-item-edit').count(),6);assert.equal(await adjustments.locator('.line-item-edit').count(),3);
 assert.equal((await goods.locator('input').evaluateAll(inputs=>inputs.map(i=>i.value))).includes('满减'),false);
 await goods.getByRole('button',{name:'下一页',exact:true}).click();assert.equal(await goods.locator('.line-item-edit').count(),2);
 await adjustments.getByLabel('第9项小计',{exact:true}).fill('20');assert.equal(await page.getByLabel('金额（元）',{exact:true}).inputValue(),'148');
 await page.getByRole('button',{name:'按结算合计填写实付',exact:true}).click();assert.equal(await page.getByLabel('金额（元）',{exact:true}).inputValue(),'138');
 await mkdir(process.env.TEST_ARTIFACT_DIR,{recursive:true});
 for(const width of [360,390,844,1280]){
  await page.setViewportSize({width,height:width===844?390:900});await adjustments.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'overflow '+width);
  await adjustments.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/settlement-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);console.log('PASS: separated goods/adjustments, pagination, discount sign, explicit total update, mobile and landscape layout');
}finally{await browser.close();await c.query('DELETE FROM sessions WHERE id=$1',[token]);await c.end();}
