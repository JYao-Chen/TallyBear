import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_memory_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),report=JSON.parse(await readFile(process.env.LIVE_REPORT,'utf8'));
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
await c.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
const user=(await c.query("SELECT id FROM users WHERE name='真实模型五案例' ORDER BY created_at DESC LIMIT 1")).rows[0];
const book=(await c.query('SELECT id FROM books WHERE owner_id=$1 LIMIT 1',[user.id])).rows[0];
const account=(await c.query('SELECT id FROM accounts WHERE owner_id=$1 LIMIT 1',[user.id])).rows[0];
const suggestions=report.cases[2].suggestions;
const draft={id:randomUUID(),kind:'expense',amount:220,date:'2026-09-26',accountId:account.id,category:'餐饮',categorySource:'model',payee:'生活超市',title:'维他 原味豆奶',product:'维他 原味豆奶 250ml',platform:'',note:'',lineItems:[],scene:{type:'general'},memorySuggestions:suggestions};
await c.query("INSERT INTO entry_drafts(book_id,user_id,section,value) VALUES($1,$2,'intake',$3) ON CONFLICT(book_id,user_id,section) DO UPDATE SET value=$3,version=entry_drafts.version+1",[book.id,user.id,{text:'',history:true,entries:[draft]}]);
const token=randomUUID();await c.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user.id]);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const origin=process.env.TEST_ORIGIN||'http://localhost:3119';await page.context().addCookies([{name:'bubu_session',value:token,domain:new URL(origin).hostname,path:'/'}]);await page.goto(origin);
 await page.getByRole('navigation').getByRole('button',{name:'记一笔',exact:true}).click();
 await page.getByText('商品记忆 · 已匹配历史商品',{exact:true}).click();
 const merchant=page.locator('.memory-field-change').filter({hasText:'商家：'});
 await merchant.getByRole('button',{name:'撤回填充',exact:true}).click();
 await page.getByText('商家、商品与订单详情',{exact:true}).click();
 assert.equal(await page.getByLabel('交易对方',{exact:true}).inputValue(),'');
 await merchant.getByRole('button',{name:'采用此字段',exact:true}).click();
 assert.equal(await page.getByLabel('交易对方',{exact:true}).inputValue(),'生活超市');
 assert.equal(await page.getByLabel('金额（元）',{exact:true}).inputValue(),'2.2');
 await mkdir(process.env.TEST_ARTIFACT_DIR,{recursive:true});
 for(const width of [360,390,844,1280]){await page.setViewportSize({width,height:width===844?390:900});await merchant.scrollIntoViewIfNeeded();await page.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/fields-'+width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'overflow '+width);}
 assert.deepEqual(errors,[]);console.log('PASS: actual draft field undo/apply, unchanged price, 360/390/landscape/desktop layouts');
}finally{await browser.close();await c.query('DELETE FROM sessions WHERE id=$1',[token]);await c.end();}
