import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import pg from 'pg';
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/tallybear_operations_test');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const [uid,book,conversation,turn,action,token]=Array.from({length:6},()=>randomUUID());
const origin='http://localhost:3119',dir=process.env.TEST_ARTIFACT_DIR;
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir(dir,{recursive:true});
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'浏览器测试','unused')",[uid]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'测试账本','private',$2)",[book,uid]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,uid]);await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,uid]);
 await db.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'管理操作测试')",[conversation,book,uid]);
 const artifacts={charts:[],tools:[],drafts:[],links:[{page:'profile',title:'个人资料与密码'}],actions:[{id:action,kind:'management',bookId:book,title:'创建钱包',status:'pending',data:{operation:'wallet_create',params:{name:'手机确认测试钱包',opening:12345}},summary:[{label:'操作',value:'创建钱包'},{label:'名称',value:'手机确认测试钱包'},{label:'期初余额',value:'¥123.45'}],missing:[],warnings:['确认后执行，请核对目标和金额。']}]};
 await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,status,artifacts) VALUES($1,$2,'创建钱包','请核对确认卡。','complete',$3)",[turn,conversation,artifacts]);
 await page.context().addCookies([{name:'bubu_session',value:token,domain:'localhost',path:'/'}]);
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
  if(width>730)await page.locator('#primary-navigation').getByRole('button',{name:'小熊对话',exact:true}).click();else{await page.getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'小熊对话',exact:true}).click();}
  await page.getByRole('button',{name:'打开对话历史和报告'}).click();await page.getByText('管理操作测试',{exact:true}).click();
  await page.getByRole('button',{name:'确认执行',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'确认执行',exact:true}).isEnabled(),true);
  await page.screenshot({path:`${dir}/assistant-management-${width}.png`,fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.getByRole('button',{name:'确认执行',exact:true}).click();await page.getByText('已执行',{exact:true}).waitFor();
 assert.equal((await db.query('SELECT count(*)::int AS count FROM accounts WHERE owner_id=$1',[uid])).rows[0].count,1);
 await page.getByRole('button',{name:'打开 · 个人资料与密码',exact:true}).click();await page.getByRole('heading',{name:'个人资料',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: 1440/390/360 layout, confirmation click, single wallet created, profile handoff, no browser errors');
}finally{await browser.close();await db.query('DELETE FROM books WHERE owner_id=$1',[uid]);await db.query('DELETE FROM accounts WHERE owner_id=$1',[uid]);await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.end();}
