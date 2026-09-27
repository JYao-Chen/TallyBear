import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_cost_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const user=(await db.query("SELECT owner_id FROM cost_projects WHERE title='季度房租统一统计测试' ORDER BY created_at DESC LIMIT 1")).rows[0].owner_id;
const out='/home/yao/artifacts/tallybear/unified-report-20260927';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),tokens=[],errors=[];
try{
 for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const token=randomUUID();tokens.push(token);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await context.addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3018');await page.locator('#primary-navigation').waitFor({state:'attached'});
  await page.getByRole('button',{name:'切换账本',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/布布统计测试/}).click();
  if(device==='desktop')await page.locator('#primary-navigation').getByRole('button',{name:'收支分析',exact:true}).click();else await page.locator('.mobile-nav').getByRole('button',{name:/分析/}).click();
  await page.locator('.report-period-picker').getByRole('button',{name:/选择月份/}).click();await page.getByRole('dialog').getByRole('textbox',{name:'手动输入日期'}).fill('2026-10');await page.getByRole('dialog').getByRole('button',{name:'确定',exact:true}).click();
  await page.locator('#analysis-records .transaction-after-balance').first().waitFor();
  assert.equal(await page.getByRole('button',{name:'分摊项目成本',exact:true}).count(),0);
  await page.locator('#analysis-records').scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`${out}/${device}-list.png`,animations:'disabled'});
  await page.locator('#analysis-records .transaction-row').filter({has:page.locator('.transaction-after-balance')}).first().click();
  await page.getByRole('dialog').getByRole('heading',{name:'交易后账面余额'}).waitFor();await page.getByRole('dialog').locator('.transaction-balance-detail').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/${device}-detail.png`,animations:'disabled'});
  assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Desktop/mobile unified list and balance details passed: '+out);
}finally{await browser.close();await db.query('DELETE FROM sessions WHERE id=ANY($1::text[])',[tokens]);await db.end();}
