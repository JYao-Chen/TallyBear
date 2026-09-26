import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_memory_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const [user,book,wallet,token,family]=Array.from({length:5},()=>randomUUID());
await db.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT(id) DO UPDATE SET currency='CNY'");
await db.query("INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,'测试小熊','unused',true)",[user,user]);
await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'日常生活与旅行账本','private',$2)",[book,user]);
await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
await db.query("INSERT INTO families(id,name,owner_id) VALUES($1,'周末旅行家庭',$2)",[family,user]);
await db.query('INSERT INTO family_members VALUES($1,$2)',[family,user]);
await db.query("INSERT INTO accounts(id,name,owner_id,ownership,opening) VALUES($1,'微信钱包',$2,'personal',100000)",[wallet,user]);
await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
for(let i=0;i<16;i++)await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,payee,category,created_by) VALUES($1,$2,$3,'expense',$4,current_date,$5,'餐饮',$6)",[randomUUID(),book,wallet,1800+i*120,'日常午餐与咖啡 '+i,user]);
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
const errors=[],findings=[];page.on('pageerror',e=>errors.push(e.message));
const origin=process.env.TEST_ORIGIN||'http://localhost:3119',dir=process.env.TEST_ARTIFACT_DIR;
await mkdir(dir,{recursive:true});
async function shot(name){await page.waitForFunction(()=>![...document.querySelectorAll('main p,main [role=status],main .empty')].some(e=>/^正在(读取|加载|汇总)/.test(e.textContent.trim())));await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>e.className)}));findings.push({name,...overflow});}
try{
 await page.context().addCookies([{name:'bubu_session',value:token,domain:new URL(origin).hostname,path:'/'}]);
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
  async function navigate(name){if(width>730)await page.locator('#primary-navigation').getByRole('button',{name,exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();}await page.waitForLoadState('networkidle');}
  for(const [name,key] of [['我的账本','home'],['记一笔','entry'],['收支分析','analysis'],['活动账','activities'],['资金资产','assets'],['每月预算','budget'],['账本设置','settings'],['计划与分摊','plans'],['账本管理','books'],['家庭管理','families'],['个人资料','profile'],['用户管理','users'],['小熊对话','chat'],['使用说明','help']]){
   await navigate(name);await shot(key+'-'+width);
   if(key==='entry'){await page.getByRole('button',{name:'手动记账',exact:true}).click();await shot('manual-'+width);await page.getByRole('button',{name:'家庭往来',exact:true}).click();await shot('family-entry-'+width);}
   if(key==='profile'){await page.getByRole('button',{name:'记忆中心',exact:true}).click();await page.waitForLoadState('networkidle');await shot('memory-'+width);}
   if(key==='chat'){assert.equal(await page.locator('.finance-composer').getByText('个人记忆',{exact:true}).count(),0);const box=await page.locator('.finance-composer').boundingBox();assert.ok(box.y+box.height<=900,'composer off screen');await page.locator('.finance-composer textarea').fill('请核对这次旅行的交通、住宿和餐饮支出，并保留我上传的账单。');await shot('chat-input-'+width);}
   if(key==='help'){await page.getByRole('searchbox',{name:'搜索使用说明'}).fill('退款');await page.locator('.help-content').getByText('退款增加到账账户余额',{exact:false}).waitFor();await shot('help-search-'+width);}
  }
 }
 await writeFile(dir+'/findings.json',JSON.stringify({errors,findings},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(findings.filter(f=>f.scroll>f.width),[]);
 console.log('PASS: all navigation pages, entry modes, memory, help search and composer at 1440/390/360px');
}finally{await browser.close();await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM accounts WHERE id=$1',[wallet]);await db.query('DELETE FROM families WHERE id=$1',[family]);await db.query('DELETE FROM users WHERE id=$1',[user]);await db.end();}
