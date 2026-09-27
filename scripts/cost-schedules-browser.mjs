import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_cost_test'));
const origin='http://localhost:3018',output='/home/yao/artifacts/tallybear/cost-schedules-20260927';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const s=(await db.query("SELECT * FROM cost_schedules WHERE rule->>'title'='季度房租' ORDER BY created_at DESC LIMIT 1")).rows[0];assert.ok(s);
await db.query("INSERT INTO deployment_settings VALUES(1,'CNY') ON CONFLICT(id) DO NOTHING");
const token=randomUUID();await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,s.owner_id]);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),errors=[];
try{
 for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await context.addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(r.url()+':'+r.status());});
  await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
  if(device==='desktop')await page.locator('#primary-navigation').getByRole('button',{name:'计划与分摊',exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'计划与分摊',exact:true}).click();}
  const surface=page.locator('.cost-schedules');await surface.getByText('季度房租',{exact:true}).waitFor();
  async function capture(name){await page.waitForLoadState('networkidle');await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,device+' '+name);await page.screenshot({path:`${output}/${device}-${name}.png`,fullPage:true,animations:'disabled'});}
  await capture('list');
  await surface.getByRole('button',{name:'新建周期计划',exact:true}).click();
  await surface.getByLabel('名称',{exact:true}).fill('季度房租');await surface.getByLabel('首次付款日').fill('2026-10-15');
  await surface.getByLabel('参与家庭').selectOption(s.family_id);await surface.getByLabel('参与人',{exact:true}).check();
  await surface.getByLabel('付款人',{exact:true}).fill('2900');
  await surface.locator('input[type=number]').last().fill('1400');
  await capture('editor');await surface.getByRole('button',{name:'取消',exact:true}).click();
  const row=surface.locator('.cost-edit-row').filter({has:page.getByText('季度房租',{exact:true})});
  async function viewport(name){await surface.locator('h4').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.evaluate(()=>window.scrollBy(0,-80));await page.screenshot({path:`${output}/${device}-${name}-viewport.png`,animations:'disabled'});}
  await row.getByRole('button',{name:'我的归属与确认',exact:true}).click();await capture('accept');await viewport('accept');await surface.getByRole('button',{name:'返回计划',exact:true}).click();
  await row.getByRole('button',{name:'确认本期付款',exact:true}).click();await capture('payment');await viewport('payment');await surface.getByRole('button',{name:'返回计划',exact:true}).click();
  await row.getByRole('button',{name:'账期记录',exact:true}).click();await surface.getByText('2026-04-15',{exact:true}).waitFor();await capture('history');await viewport('history');
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Cost schedule desktop/mobile screenshots and overflow passed: '+output);
}finally{await browser.close();await db.query('DELETE FROM sessions WHERE id=$1',[token]);await db.end();}
