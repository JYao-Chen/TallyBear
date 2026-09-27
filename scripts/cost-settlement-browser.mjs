import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_cost_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const project=(await db.query("SELECT * FROM cost_projects WHERE title='结算集成测试房租' ORDER BY created_at DESC LIMIT 1")).rows[0];assert.ok(project);
const sender=project.active_plan.shares.find(s=>s.userId!==project.owner_id).userId;
const out='/home/yao/artifacts/tallybear/cost-settlement-20260927';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),tokens=[],errors=[];
try{
 for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  async function open(user){
   const token=randomUUID();tokens.push(token);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await context.addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(r.url()+':'+r.status());});
   await page.goto('http://localhost:3018');await page.locator('#primary-navigation').waitFor({state:'attached'});
   if(device==='desktop')await page.locator('#primary-navigation').getByRole('button',{name:'计划与分摊',exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'计划与分摊',exact:true}).click();}
   await page.locator('.cost-project-row').filter({hasText:'结算集成测试房租'}).click({timeout:10000}).catch(async e=>{console.log(await page.locator('main').innerText());throw e;});await page.locator('.cost-transfer').waitFor();
   return {context,page,surface:page.locator('.cost-transfer')};
  }
  async function capture(page,target,name){await page.waitForLoadState('networkidle');await target.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.evaluate(()=>window.scrollBy(0,-20));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${out}/${device}-${name}.png`,animations:'disabled'});}
  const s=await open(sender);await s.surface.getByRole('button',{name:'向成员结算',exact:true}).click();
  await s.surface.getByLabel(/^收款成员/).selectOption(project.owner_id);
  await s.surface.getByLabel(/^我的付款钱包/).selectOption({label:'付款微信'});
  await s.surface.getByLabel('实际转款金额',{exact:true}).fill(device==='desktop'?'101':'102');
  await s.surface.getByLabel('转款备注（选填）',{exact:true}).fill('浏览器合成结算测试 '+device);
  await capture(s.page,s.surface.locator('legend'),'send');
  await s.surface.getByRole('button',{name:'已转款，等待对方确认',exact:true}).click();await s.surface.getByRole('status').waitFor({timeout:5000}).catch(async e=>{console.log(await s.page.locator('main').innerText(),errors);throw e;});
  await s.context.close();
  const r=await open(project.owner_id),row=r.surface.locator('.cost-offset').filter({hasText:'浏览器合成结算测试 '+device});
  await row.getByRole('button',{name:'确认到账',exact:true}).click();await row.getByLabel(/^我的到账钱包/).selectOption({label:'收款银行卡'});
  await capture(r.page,row,'receive');
  await row.getByRole('button',{name:'确已到账，确认结算',exact:true}).click();await r.surface.getByRole('status').waitFor();
  assert.equal((await db.query("SELECT status FROM family_movements WHERE note=$1 AND family_id=$2",['浏览器合成结算测试 '+device,project.family_id])).rows[0].status,'confirmed');
  await r.context.close();
  await db.query('UPDATE accounts SET archived=true WHERE owner_id=$1',[project.owner_id]);
  try{
   const empty=await open(project.owner_id);await empty.surface.getByRole('button',{name:'确认到账',exact:true}).first().click();
   await empty.surface.getByText('请先在资金资产中添加个人钱包，再回来确认到账。',{exact:true}).waitFor();
   assert.equal(await empty.surface.getByRole('button',{name:'确已到账，确认结算',exact:true}).isDisabled(),true);
   await capture(empty.page,empty.surface.locator('form'),'no-wallet');await empty.context.close();
  }finally{await db.query('UPDATE accounts SET archived=false WHERE owner_id=$1',[project.owner_id]);}
 }
 assert.deepEqual(errors,[]);console.log('Desktop/mobile send and receipt interactions passed; screenshots: '+out);
}finally{await browser.close();await db.query('DELETE FROM sessions WHERE id=ANY($1::text[])',[tokens]);await db.end();}
