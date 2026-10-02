import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const origin=process.env.TEST_ORIGIN,dir=process.env.TEST_ARTIFACT_DIR;await mkdir(dir,{recursive:true});
try{
 await page.context().addCookies([{name:'bubu_session',value:process.env.TEST_SESSION,domain:'localhost',path:'/'}]);
 await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
 await page.locator('#primary-navigation').getByRole('button',{name:'小熊对话',exact:true}).click();
 await page.getByRole('button',{name:/历史.*报告/}).click();await page.getByRole('button').filter({hasText:'查询验收'}).first().click();
 await page.locator('.finance-chart').nth(1).waitFor();
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});
  const spending=page.locator('.finance-chart').first(),prices=page.locator('.finance-chart').nth(1);
  assert.match(await spending.textContent(),/奶茶咖啡/);assert.match(await prices.textContent(),/加权/);assert.match(await prices.textContent(),/缺少单价/);
  await prices.locator('.chart-data-legend button').filter({hasText:'2026-09-22'}).click();
  const dialog=page.getByRole('dialog');await dialog.locator('.chart-drill-list button').first().waitFor();assert.match(await dialog.textContent(),/10\.00/);assert.ok(!/1459|1,459/.test(await dialog.textContent()));
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${dir}/price-drill-${width}.png`,fullPage:true});await dialog.getByRole('button',{name:'关闭弹窗'}).click();
  await page.screenshot({path:`${dir}/charts-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS: assistant filtered spending/price charts and drilldown at 1440/390/360px');
}finally{await browser.close();}
