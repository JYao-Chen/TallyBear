import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_cost_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const s=(await db.query("SELECT * FROM cost_schedules WHERE rule->>'title'='未来房租' ORDER BY created_at DESC LIMIT 1")).rows[0];assert.ok(s);
const token=randomUUID(),output='/home/yao/artifacts/tallybear/cost-schedule-edit-20260927';
await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,s.owner_id]);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),errors=[];
try{
 for(const width of [1440,390,360]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},reducedMotion:'reduce'});
  await context.addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3018');await page.locator('#primary-navigation').waitFor({state:'attached'});
  if(width===1440)await page.locator('#primary-navigation').getByRole('button',{name:'计划与分摊',exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'计划与分摊',exact:true}).click();}
  const surface=page.locator('.cost-schedules');
  await surface.locator('.cost-schedule-card').filter({hasText:'未来房租'}).getByRole('button',{name:'编辑计划',exact:true}).click();
  await surface.getByLabel('首次付款日').fill('2026-10-15');await surface.getByLabel('结束规则').selectOption('limited');await surface.getByLabel('总期数（含已处理）').fill('5');
  await surface.getByText(/覆盖结束日（不含当天）：2028-01-15/).waitFor();
  await surface.getByLabel('结束规则').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${output}/${width}-edit.png`,animations:'disabled'});
  await surface.getByRole('button',{name:'保存计划修改',exact:true}).click();
  const row=surface.locator('.cost-schedule-card').filter({hasText:'未来房租'});await row.getByText(/已处理 0 \/ 5/).waitFor();
  await row.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${width}-saved.png`,animations:'disabled'});
  const rule=(await db.query('SELECT rule FROM cost_schedules WHERE id=$1',[s.id])).rows[0].rule;assert.equal(rule.totalCycles,5);assert.equal(rule.firstDate,'2026-10-15');
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Recurring plan edit/save and responsive layout passed at 1440, 390 and 360px.');
}finally{await browser.close();await db.query('DELETE FROM sessions WHERE id=$1',[token]);await db.end();}
