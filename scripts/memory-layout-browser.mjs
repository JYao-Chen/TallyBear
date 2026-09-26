import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_memory_test'));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const user=randomUUID(),book=randomUUID(),token=randomUUID(),ids=[];
await db.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT(id) DO UPDATE SET currency='CNY'");
await db.query("INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,'界面测试','unused',true)",[user,user]);
await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'测试账本','private',$2)",[book,user]);
await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);
for(let i=0;i<25;i++){const id=randomUUID();ids.push(id);await db.query("INSERT INTO memories(id,owner_id,kind,title,content,attributes,status,explicit) VALUES($1,$2,'product',$3,$4,$5,'active',true)",[id,user,i===24?'iCloud 云空间家庭套餐 · 200GB':'日常商品 '+i,'仅复用商品信息，不继承旧价格与付款信息。',JSON.stringify({brand:'Apple',specification:'200GB',category:'会员订阅'})]);}
const browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM_PATH?{executablePath:process.env.TEST_CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const origin=process.env.TEST_ORIGIN||'http://localhost:3119';
 await page.context().addCookies([{name:'bubu_session',value:token,domain:new URL(origin).hostname,path:'/'}]);
 await page.goto(origin);await page.getByRole('button',{name:'个人资料',exact:true}).click();
 await page.getByRole('button',{name:'记忆中心',exact:true}).click();
 await page.getByText('共 25 条',{exact:false}).waitFor();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.locator('.memory-collection').getByRole('button',{name:'下一页',exact:true}).click();
 await page.getByText('2 / 2 · 共 25 条').waitFor();
 await page.locator('.memory-collection').getByRole('button',{name:'上一页',exact:true}).click();
 await page.getByText('1 / 2 · 共 25 条').waitFor();
 await mkdir(process.env.TEST_ARTIFACT_DIR,{recursive:true});
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:1000});
  await page.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/collection-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'查看与管理'}).first().click();
  await page.getByLabel('名称',{exact:true}).waitFor();
  await page.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/detail-'+width+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'detail overflow '+width);
  await page.getByRole('button',{name:'← 返回记忆列表'}).click();
 }
 await page.getByRole('button',{name:'新增明确偏好'}).click();
 await page.getByLabel('名称',{exact:true}).fill('会员服务分类');
 await page.getByLabel('描述',{exact:true}).fill('云空间归为会员订阅');
 await page.getByLabel('匹配的商品／商家名称').fill('iCloud');
 await page.getByLabel('分类偏好').fill('会员订阅');
 await page.locator('.memory-detail').getByRole('button',{name:'保存',exact:true}).click();
 await page.getByText('已保存',{exact:true}).waitFor();
 await page.getByRole('button',{name:'学习与设置',exact:true}).click();
 await page.getByText('启用个人记忆学习',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('搜索记忆',{exact:true}).count(),0);
 await page.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/settings-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'变更记录',exact:true}).click();
 await page.getByRole('heading',{name:'变更记录',exact:true}).waitFor();
 await page.getByText('还没有变更记录',{exact:true}).waitFor();
 for(let i=0;i<24;i++){
  const memory=(await db.query('UPDATE memories SET version=2 WHERE id=$1 RETURNING *',[ids[i]])).rows[0];
  const operation=i%4===0?'status':'save';
  await db.query('INSERT INTO memory_events(user_id,memory_id,operation,previous) VALUES($1,$2,$3,$4)',[user,ids[i],operation,{...memory,title:'变更前的商品 '+i,version:1}]);
 }
 await db.query("UPDATE memories SET status='forgotten',title='',content='',attributes='{}' WHERE id=$1",[ids[0]]);
 await db.query('UPDATE memory_events SET previous=NULL WHERE memory_id=$1',[ids[0]]);
 await db.query("INSERT INTO memory_events(user_id,memory_id,operation) VALUES($1,$2,'forget')",[user,ids[0]]);
 await page.getByRole('button',{name:'我的记忆',exact:true}).click();
 await page.getByRole('button',{name:'变更记录',exact:true}).click();
 await page.getByText('共 25 条记录',{exact:true}).waitFor();
 assert.equal(await page.locator('.memory-history-row').count(),20);
 assert.equal(await page.locator('.memory-history-row').first().locator('button').count(),0);
 assert.equal(await page.locator('.memory-history-row').first().getByText('不再展示记忆内容').count(),1);
 for(const width of [1440,768,390,360]){
  await page.setViewportSize({width,height:1000});
  await page.screenshot({path:process.env.TEST_ARTIFACT_DIR+'/history-'+width+'.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'history overflow '+width);
  assert.equal(await page.locator('.memory-history').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'history panel overflow '+width);
 }
 await page.getByRole('button',{name:'下一页记录',exact:true}).click();
 await page.getByText('21–25 / 25 条',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.memory-history-row').length===5);
 assert.equal(await page.locator('.memory-history-row').count(),5);
 await page.getByRole('button',{name:'上一页记录',exact:true}).click();
 await page.getByText('1–20 / 25 条',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.memory-history-row').length===20);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'撤销变更',exact:true}).first().click();
 await page.getByText('已撤销，记忆已恢复到此次变更前。',{exact:true}).waitFor();
 await page.getByText('共 26 条记录',{exact:true}).waitFor();
 await page.locator('.memory-history-row').first().getByText('已撤销',{exact:true}).waitFor();
 assert.equal(await page.locator('.memory-history-row').filter({hasText:'变更前的商品 23'}).getByRole('button').count(),0);
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('tallybear:memory',{detail:id})),ids[24]);
 await page.getByLabel('名称',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('名称',{exact:true}).inputValue(),'iCloud 云空间家庭套餐 · 200GB');
 assert.deepEqual(errors,[]);
 console.log('PASS: navigation, editing, settings, history pagination, undo refresh, forgotten privacy, deep link and 1440/768/390/360 layouts');
}finally{
 await browser.close();
 await db.query('DELETE FROM books WHERE id=$1',[book]);
 await db.query('DELETE FROM users WHERE id=$1',[user]);
 await db.end();
}
