// Real app + disposable PostgreSQL. Never loads production configuration or calls AI.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import pg from 'pg';
import sharp from 'sharp';

const root=process.cwd(),output=resolve(process.env.SCREENSHOT_DIR||'docs/screenshots/v2');
const runtime=process.env.SCREENSHOT_RUNTIME;
assert.ok(runtime,'Set SCREENSHOT_RUNTIME to a disposable build directory');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const translations=JSON.parse(await readFile('src/lib/locales/en.json','utf8'));
const container='tallybear-readme-'+Date.now(),password=randomBytes(20).toString('hex');
const services=[],captures=[],errors=[],untranslated=[];
let browser;
await mkdir(output,{recursive:true});await mkdir(runtime,{recursive:true});
await cp('.next/standalone',runtime,{recursive:true});
await cp('.next/static',resolve(runtime,'.next/static'),{recursive:true});
await cp('public',resolve(runtime,'public'),{recursive:true});
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8'}).trim();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn){for(let n=0;n<60;n++){try{if(await fn())return;}catch{}await pause(500);}throw Error('Local screenshot service did not become ready');}
const month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,7);
async function seed(db,lang){
 const en=lang==='en',label=(zh,enText)=>en?enText:zh;
 const user=randomUUID(),sam=randomUUID(),book=randomUUID(),privateBook=randomUUID(),family=randomUUID(),token=randomUUID();
 await db.query(await readFile('scripts/schema.sql','utf8'));await db.query(await readFile('scripts/memory-schema.sql','utf8'));
 await db.query(await readFile('scripts/profile-schema.sql','utf8'));
 await db.query("INSERT INTO deployment_settings VALUES(1,$1)",[en?'USD':'CNY']);
 for(const [id,name,username] of [[user,label('小悠','Alex'),'alex.demo'],[sam,label('小林','Sam'),'sam.demo']])await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$3,$4,true)',[id,username,name,'demo-login-disabled']);
 await db.query('INSERT INTO families(id,name,owner_id) VALUES($1,$2,$3)',[family,label('我们的家','Our household'),user]);
 for(const id of [user,sam])await db.query('INSERT INTO family_members VALUES($1,$2)',[family,id]);
 for(const [id,name,kind,icon] of [[book,label('一起过日子','Everyday together'),'shared','🏡'],[privateBook,label('我的小账本','Personal journal'),'private','📒']]){
  await db.query('INSERT INTO books(id,name,kind,owner_id,icon,family_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,name,kind,user,icon,kind==='shared'?family:null,kind==='shared'?'2026-01-01':'2026-02-01']);
  await db.query("INSERT INTO members VALUES($1,$2,'owner')",[id,user]);
 }
 await db.query("INSERT INTO members VALUES($1,$2,'editor')",[book,sam]);
 const wallets=[];
 for(const [name,type,opening] of [[label('微信钱包','Daily wallet'),'cash',350000],[label('储蓄卡','Bank account'),'bank',1250000],[label('信用卡','Credit card'),'credit',-48000]]){
  const id=randomUUID();wallets.push(id);await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership,opening) VALUES($1,$2,$3,$4,'personal',$5)",[id,name,type,user,opening]);
 }
 const sharedWallet=randomUUID();await db.query("INSERT INTO accounts(id,name,type,family_id,ownership,opening) VALUES($1,$2,'cash',$3,'shared',80000)",[sharedWallet,label('家庭共同钱包','Household wallet'),family]);
 const categories=[['餐饮','Dining','🍜'],['买菜','Groceries','🥬'],['交通','Transport','🚇'],['购物','Shopping','🛍️'],['会员订阅','Subscriptions','🎟️'],['旅行','Travel','🧳'],['工资','Salary','💼'],['居家','Home','🏡']];
 for(const [position,[zh,name,icon]] of categories.entries())await db.query('INSERT INTO category_preferences(user_id,name,icon,position) VALUES($1,$2,$3,$4)',[user,label(zh,name),icon,position]);
 const activity=randomUUID();await db.query('INSERT INTO activities(id,owner_id,name,description,category,family_id,starts_on,ends_on,budget) VALUES($1,$2,$3,$4,$5,$6,$7,$8,180000)',[activity,user,label('周末山海之旅','Coast & hills weekend'),label('两天一夜，一起看海与徒步。','A weekend of coastal walks and good food.'),label('旅行','Travel'),family,month+'-18',month+'-20']);
 const data=[['早餐与咖啡','Breakfast & coffee',2800,0],['新鲜水果','Fresh fruit',3650,1],['地铁通勤','Metro commute',600,2],['家庭晚餐','Family dinner',16800,0],['日常用品','Household essentials',8900,3],['iCloud 200GB','iCloud 200GB',2100,4],['周末民宿','Coastal guesthouse',48000,5],['城际火车','Intercity train',15600,2],['山间午餐','Lunch on the trail',7800,0],['蔬菜与牛奶','Vegetables & milk',6380,1],['音乐会员','Music subscription',1800,4],['烤鱼晚餐','Grilled fish dinner',13800,0]];
 const transactions=[];
 for(let n=0;n<30;n++){
  const [zh,name,amount,category]=data[n%data.length],id=randomUUID();transactions.push(id);
  const day=String(n%24+1).padStart(2,'0');
  await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,payee,category,created_by,order_id,occurred_at) VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8,$9,$10,'12:30:00')",[id,n%7===6?privateBook:book,wallets[n%3],amount,month+'-'+day,label(zh,name),label('生活小店','Neighborhood store'),label(categories[category][0],categories[category][1]),user,'DEMO-'+String(n+1).padStart(4,'0')]);
  if([6,7,8].includes(n))await db.query('INSERT INTO activity_entries VALUES($1,$2,$3)',[id,user,activity]);
 }
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,category,created_by) VALUES($1,$2,$3,'income',1200000,$4,$5,$6,$7)",[randomUUID(),book,wallets[1],month+'-05',label('九月工资','Monthly salary'),label('工资','Salary'),user]);
 for(const [index,[zh,name]] of categories.slice(0,6).entries())await db.query('INSERT INTO budgets VALUES($1,$2,$3,$4)',[book,month,label(zh,name),[180000,80000,50000,100000,15000,180000][index]]);
 for(const [name,amount] of [['iCloud 200GB',2100],[label('音乐会员','Music subscription'),1800],[label('房租','Rent'),280000]])await db.query("INSERT INTO bill_schedules(id,book_id,user_id,name,value,frequency,next_date,anchor_day) VALUES($1,$2,$3,$4,$5,'monthly',$6,28)",[randomUUID(),book,user,name,JSON.stringify({kind:'expense',amount,accountId:wallets[1],category:label('会员订阅','Subscriptions'),title:name}),month+'-28']);
 const lineItems=[{id:randomUUID(),kind:'item',name:label('鲜牛奶 1L','Fresh milk 1L'),quantity:2,unitPrice:1590,amount:3180},{id:randomUUID(),kind:'item',name:label('时令蔬菜组合','Seasonal vegetables'),quantity:1,unitPrice:2600,amount:2600},{id:randomUUID(),kind:'discount',name:label('满减优惠','Basket discount'),quantity:null,unitPrice:null,amount:-500},{id:randomUUID(),kind:'fee',name:label('配送费','Delivery fee'),quantity:null,unitPrice:null,amount:300}];
 const draft={id:randomUUID(),kind:'expense',amount:5580,date:month+'-25',occurredAt:'18:42:00',title:label('牛奶与蔬菜','Milk & vegetables'),payee:label('田园生鲜','Green Market'),product:label('鲜牛奶 2瓶，时令蔬菜','Two bottles of milk and seasonal vegetables'),category:label('买菜','Groceries'),accountId:wallets[0],orderId:'DEMO-ORDER-0025',platform:label('生鲜到家','Grocery delivery'),note:label('周末家庭聚餐。','For our weekend dinner.'),lineItems};
 for(const id of [book,privateBook])await db.query("INSERT INTO entry_drafts(book_id,user_id,section,value) VALUES($1,$2,'intake',$3)",[id,user,JSON.stringify({text:label('买了牛奶和蔬菜，实付55.80元。','Milk and vegetables, paid $55.80.'),entries:[draft],history:true})]);
 for(const [title,kind,content,category] of [[label('鲜牛奶 1L','Fresh milk 1L'),'product',label('早餐常买的鲜牛奶，1升装。','The one-liter milk we buy for breakfast.'),1],['iCloud 200GB','product',label('家庭共享云空间，200GB套餐。','Shared cloud storage, 200GB plan.'),4],[label('订阅单独分类','Keep subscriptions separate'),'preference',label('云空间和音乐会员归入会员订阅。','Use Subscriptions for cloud storage and music memberships.'),4],[label('咖啡豆 250g','Coffee beans 250g'),'product',label('中度烘焙，250克装。','Medium roast, 250g bag.'),1],[label('旅行住宿偏好','Travel lodging preference'),'preference',label('住宿单独记录，并关联对应活动。','Keep accommodation separate and link it to the trip.'),5]]){
  const id=randomUUID(),attributes={category:label(categories[category][0],categories[category][1]),specification:title.includes('200GB')?'200GB':'',canonicalName:title};
  await db.query("INSERT INTO memories(id,owner_id,kind,title,content,attributes,status,explicit) VALUES($1,$2,$3,$4,$5,$6,'active',true)",[id,user,kind,title,content,JSON.stringify(attributes)]);
  await db.query("INSERT INTO memory_events(user_id,memory_id,operation) VALUES($1,$2,'save')",[user,id]);
 }
 const movement=randomUUID();await db.query("INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,kind,amount,date,note,status) VALUES($1,$2,$3,$4,$5,'aa',8400,$6,$7,'pending')",[movement,family,user,sam,wallets[0],month+'-24',label('周末晚餐AA','Weekend dinner split')]);
 const conversation=randomUUID();await db.query('INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,$4)',[conversation,book,user,label('演示：准备一笔买菜记录','Demo: prepare a grocery entry')]);
 const action={id:randomUUID(),kind:'entry',bookId:book,title:draft.title,status:'pending',data:{...draft,processingHints:[label('演示草稿，请核对后保存。','Demo draft. Review before saving.')]},missing:[],warnings:[],summary:[{label:'记入账本',value:label('一起过日子','Everyday together')},{label:'资金钱包',value:label('微信钱包','Daily wallet')},{label:'交易日期',value:draft.date},{label:'分类',value:draft.category},{label:'备注',value:draft.note}]};
 await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,status,artifacts,model) VALUES($1,$2,$3,$4,'complete',$5,'demo fixture')",[randomUUID(),conversation,label('帮我记牛奶与蔬菜，优惠5元，配送3元，实付55.80元。','Prepare milk and vegetables: $5 discount, $3 delivery, $55.80 paid.'),label('这是演示对话。请核对下面的草稿，确认后才会入账。','This is a demonstration conversation. Review the draft below; it is saved only after confirmation.'),JSON.stringify({charts:[],tools:[],drafts:[],actions:[action],analysisBooks:[book]})]);
 await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '3 hours')",[token,user]);
 if(process.env.FUNDS_AUDIT_ONLY){
  const other=randomUUID();await db.query("INSERT INTO accounts(id,name,type,opening,owner_id) VALUES($1,$2,'wechat',100000,$3)",[other,label('另一位成员的钱包','Other member wallet'),sam]);
  for(const [sender,recipient,source,target,amount] of [[user,sam,wallets[0],other,14000],[sam,user,other,wallets[0],5700]])await db.query("INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,target_id,kind,amount,date,status) VALUES($1,$2,$3,$4,$5,$6,'transfer',$7,$8,'confirmed')",[randomUUID(),family,sender,recipient,source,target,amount,month+'-04']);
  await db.query("INSERT INTO transactions(id,book_id,account_id,target_id,kind,amount,date,title,created_by) VALUES($1,$2,$3,$4,'transfer',10000,$5,$6,$7)",[randomUUID(),book,wallets[0],wallets[1],month+'-04',label('自有账户互转','Between my wallets'),user]);
  await db.query('UPDATE transactions SET event_id=id WHERE id=$1',[transactions[0]]);
  await db.query('INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id) SELECT $1,$2,account_id,kind,amount,date,title,created_by,event_id FROM transactions WHERE id=$3',[randomUUID(),privateBook,transactions[0]]);
 }
 return {token,book,privateBook,conversation};
}
try{
 docker('run','-d','--name',container,'--label','tallybear.task=readme-screenshots','-e','POSTGRES_PASSWORD='+password,'-p','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data','postgres:16');
 const port=docker('port',container,'5432/tcp').split(':').at(-1);
 await waitFor(()=>{try{return docker('exec',container,'pg_isready','-U','postgres').includes('accepting');}catch{return false;}});
 const admin=new pg.Client({connectionString:`postgres://postgres:${password}@127.0.0.1:${port}/postgres`});await admin.connect();
 browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM_PATH?{executablePath:process.env.TEST_CHROMIUM_PATH}:{})});
 for(const [lang,httpPort] of [['zh-CN',3126],['en',3127]]){
  const database=lang==='en'?'readme_en_test':'readme_zh_test';await admin.query('CREATE DATABASE '+database);
  const databaseUrl=`postgres://postgres:${password}@127.0.0.1:${port}/${database}`;
  const db=new pg.Client({connectionString:databaseUrl});await db.connect();const fixture=await seed(db,lang);await db.end();
  if(process.env.CHAT_AUDIT_ONLY)console.log(execFileSync(resolve(root,'node_modules/.bin/tsx'),['--test','tests/assistant-books-db.test.ts'],{cwd:root,env:{...process.env,CHAT_TEST_DATABASE_URL:databaseUrl,APP_LANGUAGE:lang,APP_CURRENCY:lang==='en'?'USD':'CNY'},encoding:'utf8'}));
  if(process.env.FUNDS_AUDIT_ONLY)console.log(execFileSync(resolve(root,'node_modules/.bin/tsx'),['--test','tests/wallet-funds-db.test.ts'],{cwd:root,env:{...process.env,FUNDS_TEST_DATABASE_URL:databaseUrl,APP_LANGUAGE:lang,APP_CURRENCY:lang==='en'?'USD':'CNY'},encoding:'utf8'}));
  const origin='http://127.0.0.1:'+httpPort;
  const service=spawn(process.execPath,[resolve(runtime,'server.js')],{cwd:runtime,env:{PATH:process.env.PATH,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(httpPort),DATABASE_URL:databaseUrl,APP_ORIGIN:origin,APP_LANGUAGE:lang,APP_CURRENCY:lang==='en'?'USD':'CNY',ENCRYPTION_KEY:randomBytes(32).toString('base64'),RECEIPT_DIR:resolve(runtime,'receipts')},stdio:['ignore','pipe','pipe']});services.push(service);
  service.stdout.on('data',()=>{});service.stderr.on('data',b=>{if(b.toString().includes('Error'))console.error(b.toString());});
  await waitFor(async()=>{const response=await fetch(origin+'/api/health');return response.ok;});
  const t=zh=>lang==='en'?(translations[zh]||zh):zh;
  for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:device==='mobile',hasTouch:device==='mobile',locale:lang,timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
   await context.addCookies([{name:'bubu_session',value:fixture.token,domain:'127.0.0.1',path:'/'}]);
   context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(20000);
   console.log('Starting',lang,device);
   const page=await context.newPage();page.on('pageerror',e=>errors.push({lang,device,error:e.message}));
   page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push({lang,device,status:r.status(),path:new URL(r.url()).pathname});});
   await page.goto(origin);await page.locator('#primary-navigation').waitFor({state:'attached'});
   async function settle(){await page.waitForLoadState('networkidle');await page.evaluate(async()=>{await document.fonts.ready;});await page.waitForTimeout(600);}
   async function navigate(name){if(device==='desktop')await page.locator('#primary-navigation').getByRole('button',{name:t(name),exact:true}).click();else{await page.getByRole('button',{name:t('更多功能'),exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:t(name),exact:true}).click();}await settle();await page.evaluate(()=>window.scrollTo(0,0));}
   async function audit(key){await settle();if(lang==='en'){const text=await page.locator('body').innerText();const lines=text.split('\n').filter(line=>/[\u3400-\u9fff]/.test(line));if(lines.length){untranslated.push({device,feature:key,lines});console.warn('Untranslated UI:',key,JSON.stringify(lines));}}}
   async function shot(key){await audit(key);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${lang}/${device}/${key} overflow`);const filename=`${lang==='en'?'en':'zh'}-${device}-${key}.webp`;await sharp(await page.screenshot({animations:'disabled',fullPage:key==='profile-book-rule'})).webp({quality:90}).toFile(resolve(output,filename));captures.push({file:filename,language:lang,device,width,height,feature:key});console.log(filename);}
   if(process.env.CHAT_AUDIT_ONLY){
    await navigate('小熊对话');assert.equal(await page.locator('.chat-scope').count(),0);await shot('assistant-unified');
    await page.getByRole('button',{name:t('打开对话历史和报告'),exact:true}).click();await page.getByText(lang==='en'?'Demo: prepare a grocery entry':'演示：准备一笔买菜记录',{exact:true}).click();await page.locator('.chat-action-card').waitFor();
    await page.locator('.chat-action-card').getByRole('button',{name:t('继续修改'),exact:true}).click();await page.locator('.chat-inline-editor').waitFor();await shot('assistant-book-editor');
    await page.locator('.chat-inline-editor').getByRole('button',{name:new RegExp('^'+t('记入账本'))}).click();await shot('assistant-book-choices');await page.getByRole('dialog').getByRole('button',{name:lang==='en'?'Personal journal':'我的小账本',exact:false}).click();
    await page.locator('.chat-inline-editor').getByRole('button',{name:t('更新卡片'),exact:true}).click();await page.locator('.chat-inline-editor').waitFor({state:'hidden'});await settle();await page.locator('.chat-action-card').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('assistant-book-updated');
    await navigate('个人资料');await page.getByRole('button',{name:t('个人画像'),exact:true}).click();await page.getByRole('button',{name:lang==='en'?'Habits & rules':'场景与规则',exact:true}).click();await settle();
    await page.getByRole('button',{name:lang==='en'?'Add rule':'新增规则',exact:true}).click();await page.locator('.portrait-rule-editor').waitFor();await page.locator('.portrait-rule-editor fieldset').last().locator('select').first().selectOption('bookId');await page.locator('.portrait-rule-editor').scrollIntoViewIfNeeded();await shot('profile-book-rule');await context.close();continue;
   }
   if(process.env.FUNDS_AUDIT_ONLY){
    await navigate('收支分析');await page.getByRole('button',{name:t('我的个人钱包'),exact:false}).click();await settle();await page.locator('.wallet-funds').waitFor();await page.locator('.funds-list>button').first().waitFor();
    const data=await page.evaluate(async(month)=>{const r=await fetch('/api/assets/report?from='+month+'-01&to='+month+'-28&owner=personal');return r.json();},month);
    assert.equal(data.funds.summary.transferOut,14000);assert.equal(data.funds.summary.transferIn,5700);assert.equal(data.funds.summary.internalTransfer,10000);
    assert.equal(data.funds.summary.closingBalance,data.summary.netAssets);assert.equal(data.funds.count,34);
    await page.locator('.wallet-funds').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('funds-summary');
    await page.locator('.funds-filters select').selectOption('transfer');await settle();assert.equal(await page.locator('.funds-list>button').count(),2);
    await page.locator('.funds-filters').scrollIntoViewIfNeeded();await shot('funds-transfers');await page.locator('.funds-list>button').first().click();await shot('funds-detail');await page.getByRole('dialog').getByRole('button',{name:t('关闭弹窗'),exact:true}).click();
    const chooseSort=async(scope,value)=>{await scope.locator('.detail-sort select').selectOption(value,{force:true});await settle();};
    await page.locator('.funds-filters select').selectOption('all');await chooseSort(page.locator('.wallet-funds'),'amount_desc');
    await page.locator('.wallet-funds .detail-sort').scrollIntoViewIfNeeded();await shot('funds-sorted');
    await page.locator('.records-panel').scrollIntoViewIfNeeded();await chooseSort(page.locator('.records-panel'),'amount_desc');await page.locator('.records-panel .detail-sort').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('records-sorted');
    await page.locator('.interactive-chart:not(.funds-charts .interactive-chart) .chart-data-legend button:not(:disabled)').first().click();await settle();await chooseSort(page.getByRole('dialog'),'amount_asc');await shot('chart-sorted');await page.getByRole('dialog').getByRole('button',{name:t('关闭弹窗'),exact:true}).click();
    await navigate('活动账');await page.locator('.activity-records').waitFor();await chooseSort(page.locator('.activity-records'),'amount_desc');await page.locator('.activity-records .detail-sort').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('activity-sorted');
    await navigate('记一笔');await page.getByRole('button',{name:t('家庭往来'),exact:true}).click();await settle();await page.locator('.family-finance').waitFor();await chooseSort(page.locator('.family-finance'),'amount_desc');await page.locator('.family-finance .detail-sort').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('family-sorted');
    await page.getByRole('button',{name:t('搜索整个账本系统'),exact:true}).click();await settle();await page.locator('.unified-search select').last().selectOption('amount_desc',{force:true});await settle();await shot('search-sorted');await page.getByRole('dialog').getByRole('button',{name:t('关闭弹窗'),exact:true}).click();
    await navigate('资金资产');await page.locator('.wallet-funds').waitFor();await page.locator('.wallet-funds').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('asset-funds');await context.close();continue;
   }
   if(process.env.HELP_FIGURES_ONLY){
    await navigate('记一笔');await page.getByRole('button',{name:t('手动记账'),exact:true}).click();await page.locator('.quick-entry').getByRole('button',{name:t('支出'),exact:true}).click();await page.locator('.entry-modes').scrollIntoViewIfNeeded();await page.locator('.entry-modes').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('manual');
    await page.getByRole('button',{name:t('退款'),exact:true}).click();await page.locator('.refund-picker').scrollIntoViewIfNeeded();await shot('refund');
    await page.getByRole('button',{name:t('微信／支付宝账单'),exact:true}).click();await page.locator('.entry-modes').evaluate(el=>el.scrollIntoView({block:'start'}));await shot('import');
    await navigate('小熊对话');await page.locator('.finance-composer textarea').fill(lang==='en'?'Please reconcile my September payment statements with my recorded transactions. Check references, neighboring order and repeat purchases before suggesting missing entries.':'请核对我九月的支付流水与已记账记录，结合订单号、相邻顺序和重复购买，找出可能漏记的交易。');await shot('reconcile');await context.close();continue;
   }
   if(process.env.HELP_AUDIT_ONLY){
    await navigate('使用说明');await shot('help');
    assert.equal(await page.locator('.help-chapter-header').evaluate(el=>getComputedStyle(el).display),'block');
    assert.ok(await page.locator('.help-chapter-header').evaluate(el=>el.getBoundingClientRect().height>=el.scrollHeight-2),'Chapter header must contain its text');
    const input=page.locator('.help-search input');await input.fill(lang==='en'?'refund':'退款');await page.locator('.help-result').first().waitFor();await settle();assert.ok(await page.locator('.help-result mark').count());await shot('help-search');await page.locator('.help-result').first().click();await page.locator('.help-content article').waitFor();assert.ok(await page.locator('.help-content mark').count());
    await page.locator('.help-section').first().scrollIntoViewIfNeeded();await shot('help-steps');
    await page.locator('.help-figure').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.help-figure img')].every(i=>i.complete&&i.naturalWidth>0));await shot('help-article');
    const firstFigure=page.locator('.help-figure').first();await firstFigure.getByRole('button',{name:device==='mobile'?(lang==='en'?'Desktop':'电脑'):(lang==='en'?'Mobile':'手机'),exact:true}).click();await settle();assert.ok((await firstFigure.locator('img').getAttribute('src')).includes(device==='mobile'?'-desktop-':'-mobile-'));
    await page.locator('.help-feature-link').first().click();await page.locator('.quick-entry').waitFor();assert.equal(await page.getByRole('button',{name:t('手动记账'),exact:true}).getAttribute('aria-pressed'),'true');
    await navigate('使用说明');await page.locator('.help-ask').click();await page.locator('.finance-composer textarea').waitFor();assert.match(await page.locator('.finance-composer textarea').inputValue(),lang==='en'?/help chapter/:/使用说明/);assert.ok(!(await page.locator('.finance-main').innerText()).includes(t('请上传需要核对的支付账单截图，然后发送消息。')));
    await navigate('使用说明');if(device==='mobile')await page.locator('.help-mobile-chapters select').selectOption('memory');else await page.locator('.help-topics button').filter({hasText:lang==='en'?'Personal memory':'个人记忆'}).click();await page.locator('.help-feature-link').first().click();await page.locator('.memory-row').first().waitFor();
    await navigate('使用说明');if(device==='mobile')await page.locator('.help-mobile-chapters select').selectOption('wallets');else await page.locator('.help-topics button').filter({hasText:lang==='en'?'Wallets, repayments':'钱包、还款'}).click();await page.locator('.help-section-toc a').nth(1).click();await shot('help-wallets');
    assert.equal(await page.locator('.help-example').first().evaluate(el=>getComputedStyle(el).position),'static');
    assert.ok(await page.locator('.help-example').first().evaluate(el=>el.clientWidth>el.parentElement.clientWidth*.9),'Example should fill the reading column');await context.close();continue;
   }
   for(const [name,key] of [['我的账本','overview'],['收支分析','analysis'],['资金资产','assets'],['活动账','activities'],['每月预算','budgets'],['账本管理','books'],['家庭管理','family'],['账本设置','categories'],['使用说明','help']]){await navigate(name);await shot(key);if(key==='analysis'){await page.locator('.chart-grid').first().scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.chart-grid').scrollIntoView({block:'start'}));await shot('charts');}}
   await navigate('计划与分摊');await page.getByRole('tab',{name:t('周期收支'),exact:true}).click();await shot('plans');
   await navigate('个人资料');await shot('profile');await page.getByRole('button',{name:t('记忆中心'),exact:true}).click();await page.locator('.memory-row').first().waitFor();await shot('memory');await page.getByRole('button',{name:t('变更记录'),exact:true}).click();await page.locator('.memory-history-row').first().waitFor();await shot('memory-history');
   await page.getByRole('button',{name:t('我的记忆'),exact:true}).click();await page.locator('.memory-row').filter({hasText:lang==='en'?'Fresh milk 1L':'鲜牛奶 1L'}).getByRole('button').click();await page.locator('.memory-detail form').waitFor();await audit('memory-detail');
   for(const summary of await page.locator('.memory-detail summary').all())await summary.click();await audit('memory-detail-expanded');
   await page.getByRole('button',{name:t('学习与设置'),exact:true}).click();await page.getByText(t('记忆模型配置与运行统计（管理员）'),{exact:true}).click();await audit('memory-settings');
   await navigate('记一笔');await shot('intake');await page.locator('.intake-review').scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.intake-review').scrollIntoView({block:'start'}));await shot('draft');
   await page.locator('.line-items-editor').first().scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.line-items-editor').scrollIntoView({block:'start'}));await shot('line-items');
   await navigate('记一笔');await page.getByRole('button',{name:t('家庭往来'),exact:true}).click();await shot('family-entry');await page.getByRole('button',{name:t('记一笔往来'),exact:true}).click();await audit('family-entry-form');
   await navigate('小熊对话');await page.getByRole('button',{name:t('打开对话历史和报告'),exact:true}).click();await page.getByText(lang==='en'?'Demo: prepare a grocery entry':'演示：准备一笔买菜记录',{exact:true}).click();await page.locator('.chat-action-card').waitFor();await settle();await page.locator('.finance-messages').evaluate(el=>el.scrollTo(0,0));await shot('assistant');
   await navigate('我的账本');await page.getByRole('button',{name:t('搜索整个账本系统'),exact:true}).click();await page.getByRole('textbox',{name:t('搜索关键词'),exact:true}).fill(lang==='en'?'milk':'牛奶');await settle();await shot('search');
   await context.close();
  }
 }
 await admin.end();assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'manifest.json'),JSON.stringify({version:'2.0.0',capturedAt:new Date().toISOString(),data:'Synthetic household. Seeded assistant and OCR drafts, no live model calls.',captures},null,2)+'\n');
 console.log(`Captured ${captures.length} real app screenshots.`);
 if(process.env.SCREENSHOT_AUDIT)await writeFile(process.env.SCREENSHOT_AUDIT,JSON.stringify(untranslated,null,2)+'\n');
 assert.deepEqual(untranslated,[],'English demo UI contains untranslated labels');
}finally{
 await browser?.close();for(const service of services){service.kill('SIGTERM');}
 docker('rm','-f',container);
}
