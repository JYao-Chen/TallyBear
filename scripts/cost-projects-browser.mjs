import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import pg from 'pg';
const url=process.env.DATABASE_URL;
assert.ok(new URL(url).pathname.endsWith('_cost_test'));
const origin=process.env.COST_TEST_ORIGIN||'http://127.0.0.1:3018';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const output=process.env.COST_SCREENSHOT_DIR||'/home/yao/artifacts/tallybear/cost-projects-20260927';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const db=new pg.Client({connectionString:url});await db.connect();
await db.query(await readFile('scripts/memory-schema.sql','utf8'));
await db.query("INSERT INTO deployment_settings VALUES(1,'CNY') ON CONFLICT(id) DO NOTHING");
const p=(await db.query('SELECT * FROM cost_projects WHERE active_plan IS NOT NULL ORDER BY created_at DESC LIMIT 1')).rows[0];assert.ok(p);
await db.query("UPDATE users SET name='小悠' WHERE id=$1",[p.owner_id]);
await db.query("UPDATE cost_projects SET title='季度房租 · 两人分担' WHERE id=$1",[p.id]);
const token=randomUUID();await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,p.owner_id]);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH});
const failures=[];
try{
 for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:device==='mobile',hasTouch:device==='mobile'});
  await context.addCookies([{name:'bubu_session',value:token,domain:new URL(origin).hostname,path:'/'}]);
  const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)failures.push(r.status()+':'+r.url());});
  await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
  const navigate=async name=>{if(device==='desktop')await page.locator('#primary-navigation').getByRole('button',{name,exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();}await page.waitForLoadState('networkidle');};
  await navigate('计划与分摊');await page.getByRole('heading',{name:'费用归属与分担',exact:true}).waitFor();
  await page.getByRole('button',{name:/季度房租/}).click();await page.getByRole('heading',{name:'我的月度承担'}).waitFor();
  await page.waitForLoadState('networkidle');await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,device+' detail overflow');
  await page.screenshot({path:output+'/'+device+'-detail.png',fullPage:true,animations:'disabled'});
  await page.screenshot({path:output+'/'+device+'.png',animations:'disabled'});
  await page.getByRole('button',{name:'编辑规则',exact:true}).click();await page.getByRole('heading',{name:'原始付款'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,device+' editor overflow');
  await page.screenshot({path:output+'/'+device+'-editor.png',fullPage:true,animations:'disabled'});
  await navigate('收支分析');await page.getByRole('button',{name:'分摊项目成本',exact:true}).click();await page.getByRole('heading',{name:'分摊项目成本与净承担'}).waitFor();await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:/选择月份:/}).click();await page.getByRole('textbox',{name:'手动输入日期'}).fill('2026-10');await page.getByRole('button',{name:'确定',exact:true}).click();
  await page.locator('.cost-report-totals').waitFor();await page.getByText('正在汇总…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,device+' report overflow');
  await page.screenshot({path:output+'/'+device+'-report.png',fullPage:true,animations:'disabled'});
  await context.close();
 }
 assert.deepEqual(failures,[]);console.log('Desktop/mobile cost views passed. Screenshots: '+output);
}finally{await browser.close();await db.query('DELETE FROM sessions WHERE id=$1',[token]);await db.end();}
