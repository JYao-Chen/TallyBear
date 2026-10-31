import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import Workspace from './src/components/Workspace';import {LanguageProvider} from './src/components/LanguageProvider';import {ThemeProvider} from './src/components/ThemeProvider';createRoot(document.getElementById('root')).render(<LanguageProvider initial="zh-CN"><ThemeProvider initial="bear"><Workspace/></ThemeProvider></LanguageProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'fixture',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const layout=await readFile('src/app/layout.tsx','utf8');const css=(await Promise.all([...layout.matchAll(/import ['"]\.\/(.+?\.css)['"]/g)].map(m=>readFile('src/app/'+m[1],'utf8')))).join('\n')+'\n'+result.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url.startsWith('/fonts/'))readFile(resolve('public','.'+req.url)).then(b=>res.end(b)).catch(()=>{res.statusCode=404;res.end()});else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>main{max-width:1440px;margin:32px auto;padding:16px;width:100%}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),errors=[];
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',U='33333333-3333-4333-8333-333333333333',W='44444444-4444-4444-8444-444444444444';
const books=[{id:A,name:'Shared test book',kind:'shared',role:'owner',icon:'📒'},{id:B,name:'Private test book',kind:'private',role:'owner',icon:'📒'}],account={id:W,name:'Test wallet',type:'cash',ownership:'personal',owner_id:U,usable:true,archived:false,balance:100000,opening:100000};
const row={id:'55555555-5555-4555-8555-555555555555',book_id:A,title:'Filter test purchase',payee:'Test shop',kind:'expense',amount:1234,date:new Date().toISOString().slice(0,10),category:'餐饮',account_id:W,account_name:'Test wallet',target_id:null,creator_name:'Test user',version:1,note:'Filter test',line_items:[]};
let cross=false;const requests=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname.replace('/api/',''),p=url.searchParams;requests.push(path+'?'+p);let data=[];
 if(path==='me')data={id:U,name:'Test user',username:'test',theme:'bear',admin:false};
 else if(path==='books')data=books;
 else if(path==='search-options')data={accounts:[account],categories:['餐饮','奶茶']};
 else if(path==='search')data={rows:[{id:row.id,entity:'transaction',title:row.title,subtitle:'Test search result',book_id:B,deleted:false,items:[],detail:{...row,book_id:B}}],total:45,groups:{transaction:45}};
 else if(path==='activities')data=[];
 else if(path==='families')data={items:[]};
 else if(path==='assets/funds')data={summary:{income:0,expense:1234,refund:0,transferIn:0,transferOut:0,internalTransfer:0,adjustment:0,inflow:0,outflow:1234,flowChange:-1234,balanceChange:-1234,openingBalance:100000,closingBalance:98766},daily:[],rows:[{id:row.id,date:row.date,title:row.title,kind:'expense',amount:1234,inflow:0,outflow:1234,delta:-1234,internal:false,sourceId:W,targetId:null,sourceName:'Test wallet',targetName:'',origin:'transaction',counterparty:'Test shop',note:'Filter test',bookId:B}],count:45,offset:Number(p.get('offset')||0),hasMore:Number(p.get('offset')||0)<40};
 else if(path==='assets/funds/entry')data={canDelete:false,reason:'Read-only fixture'};
 else if(path==='assets')data=[account];
 else if(path==='expense-claims/for-record')data={canEdit:true,claim:null,people:[]};
 else if(path.includes('expense-claims'))data={rows:[],items:[],total:0,people:[]};
 else if(path==='discussions/inbox')data={rows:[],total:0};
 else if(path.startsWith('discussions')){return route.fulfill({status:404,json:{error:'Unavailable'}});}
 else if(path.endsWith('/budgets'))data=[{category:'餐饮',amount:100000}];
 else if(path.endsWith('/accounts'))data=[account];
 else if(path.endsWith('/categories'))data=[{name:'餐饮',icon:'🍜',archived:false},{name:'奶茶',icon:'☕',archived:false}];
 else if(path.endsWith('/report'))data={rows:[{...row,book_id:cross?B:A}],totals:{count:45,income:0,expense:55530,refund:0},categories:[{name:'餐饮',value:55530}],daily:[{date:row.date,income:0,expense:55530}],groups:[]};
 else if(path.endsWith('/attention'))data=[{...row,book_id:cross?B:A}];
 else if(path.endsWith('/chart-details'))data={rows:[{...row,book_id:cross?B:A}],totals:{count:1,income:0,expense:1234,refund:0}};
 else if(path.endsWith('/transactions'))data=[{...row,book_id:cross?B:A}];
 else if(path.endsWith('/drafts'))data={value:null,version:0};
 else if(path.endsWith('/allocations'))data={items:[],ordinary:0,allocated:0,total:0};
 else if(path==='jobs')data=[];
 else if(path.includes('notifications'))data={items:[],unread:0};
 return route.fulfill({json:data});
 });
 for(const width of [1440,390])for(const foreign of [false,true]){
 cross=foreign;await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const nav=page.locator(width<600?'.mobile-nav':'#primary-navigation');await nav.getByRole('button',{name:'收支分析',exact:true}).click();
 await page.getByRole('tab',{name:'明细',exact:true}).click();await page.locator('#analysis-records .transaction-row').first().waitFor();
 await page.getByRole('button',{name:'记账分类：全部分类',exact:true}).click();await page.getByRole('button',{name:'餐饮',exact:true}).click();await page.getByRole('button',{name:'奶茶',exact:true}).click();await page.getByRole('button',{name:'完成选择',exact:true}).click();
 await page.locator('#analysis-records').getByRole('button',{name:'收支类型: 全部类型',exact:true}).click();await page.getByRole('button',{name:'消费支出',exact:true}).click();await page.locator('#analysis-records').getByRole('button',{name:'明细排序: 时间 · 从新到旧',exact:true}).click();await page.getByRole('button',{name:'金额 · 从高到低',exact:true}).click();
 const search=page.getByRole('textbox',{name:'搜索流水',exact:true});await search.fill('Filter test');await page.waitForTimeout(350);
 await page.locator('#analysis-records .pagination').getByRole('button',{name:'下一页',exact:true}).click();await page.locator('#analysis-records .transaction-row').first().waitFor();const pagination=await page.locator('#analysis-records .pagination').innerText();
 await page.locator('#analysis-records .transaction-row').first().click();await page.getByRole('dialog').getByRole('button',{name:'修改记录',exact:true}).waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗',exact:true}).click();
 assert.ok(await page.getByRole('button',{name:'记账分类：餐饮、奶茶',exact:true}).isVisible(),`Category lost ${width} cross=${foreign}`);assert.equal(await search.inputValue(),'Filter test');assert.ok(await page.getByRole('button',{name:'收支类型: 消费支出',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'明细排序: 金额 · 从高到低',exact:true}).isVisible());assert.equal(await page.locator('#analysis-records .pagination').innerText(),pagination);
 await page.screenshot({path:resolve(out,`analysis-${width}-cross-${foreign}.png`),fullPage:true});
 const exported=page.waitForRequest(r=>r.url().includes('/export?'));await page.getByRole('button',{name:'导出全部结果',exact:true}).click();assert.deepEqual(new URL((await exported).url()).searchParams.getAll('category'),['餐饮','奶茶']);
 await page.getByRole('button',{name:'记账分类：餐饮、奶茶',exact:true}).click();assert.equal(await page.getByRole('button',{name:'餐饮',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'奶茶',exact:true}).getAttribute('aria-pressed'),'true');await page.screenshot({path:resolve(out,`category-picker-${width}.png`)});await page.getByRole('button',{name:'完成选择',exact:true}).click();
 // A chart drilldown remains open below the canonical entry detail.
 await page.getByRole('tab',{name:'概览',exact:true}).click();
 await page.locator('.analysis-charts .chart-data-legend button').filter({hasText:'餐饮'}).first().click();
 await page.getByRole('dialog').last().getByRole('button').filter({hasText:row.title}).click();await page.getByRole('dialog').last().getByRole('button',{name:'修改记录',exact:true}).waitFor();await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('dialog').last().getByRole('button',{name:'关闭弹窗',exact:true}).click();assert.ok(await page.getByRole('button',{name:'记账分类：餐饮、奶茶',exact:true}).isVisible());assert.equal(await search.inputValue(),'Filter test');
 // Verification list filters survive opening and closing an entry.
 await page.getByRole('tab',{name:'明细',exact:true}).click();
 await page.getByRole('button',{name:'待核验记录',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'打开核验',exact:true}).click();await page.getByRole('dialog').last().getByRole('button',{name:'修改记录',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert.ok(await page.getByRole('dialog').getByRole('button',{name:'打开核验',exact:true}).isVisible());await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗',exact:true}).click();

 await page.getByRole('button',{name:'记账分类：餐饮、奶茶',exact:true}).click();await page.getByRole('button',{name:'奶茶',exact:true}).click();assert.equal(await page.getByRole('button',{name:'奶茶',exact:true}).getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'全部分类',exact:true}).click();await page.getByRole('button',{name:'完成选择',exact:true}).click();assert.ok(await page.getByRole('button',{name:'记账分类：全部分类',exact:true}).isVisible());
 }
 const chartRequest=requests.filter(r=>r.includes('/chart-details?')).at(-1);assert.deepEqual(new URLSearchParams(chartRequest.split('?')[1]).getAll('category'),['餐饮','奶茶']);
 // Budget drilldowns also retain the selected category and page under a record.
 for(const width of [1440,390]){
 cross=true;await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/`);
 if(width<600){await page.locator('.mobile-nav').getByRole('button',{name:'更多功能',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'每月预算',exact:true}).click();}else await page.locator('#primary-navigation').getByRole('button',{name:'每月预算',exact:true}).click();
 await page.locator('.budget-card').first().click();await page.getByRole('dialog').getByRole('button',{name:'下一页',exact:true}).click();await page.getByRole('dialog').locator('.transaction-row').first().waitFor();const before=await page.getByRole('dialog').locator('.pagination').innerText();
 await page.getByRole('dialog').locator('.transaction-row').first().click();await page.getByRole('dialog').last().getByRole('button',{name:'修改记录',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await page.getByRole('dialog').locator('.pagination').innerText(),before);await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗',exact:true}).click();
 }
 // Search results and their pagination stay behind a viewed record.
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.getByRole('button',{name:'搜索整个账本系统',exact:true}).click();
 const globalQuery=page.getByRole('textbox',{name:'搜索关键词',exact:true});await globalQuery.fill('Filter test');await page.locator('.search-result summary').first().click();await page.getByRole('button',{name:'打开这笔记录',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'下一页',exact:true}).click();await page.locator('.search-result summary').first().click();await page.getByRole('button',{name:'打开这笔记录',exact:true}).waitFor();const searchPage=await page.getByRole('dialog').locator('.pagination').innerText();
 await page.getByRole('button',{name:'打开这笔记录',exact:true}).click();await page.getByRole('dialog').last().getByRole('button',{name:'修改记录',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await globalQuery.inputValue(),'Filter test');assert.equal(await page.getByRole('dialog').locator('.pagination').innerText(),searchPage);await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗',exact:true}).click();
 // Wallet flow keeps its local flow filter, query and page after detail closes.
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('.mobile-nav').getByRole('button',{name:'收支分析',exact:true}).click();await page.getByRole('button',{name:/钱包资金流 实际进出/}).click();
 await page.getByRole('searchbox',{name:'搜索资金明细',exact:true}).fill('Filter test');await page.getByRole('combobox',{name:'资金流动类型',exact:true}).selectOption('out');await page.locator('.funds-list button').first().waitFor();await page.locator('.funds-pagination').getByRole('button',{name:'下一页',exact:true}).click();await page.locator('.funds-list button').first().waitFor();const fundsPage=await page.locator('.funds-pagination').innerText();await page.locator('.funds-list button').first().click();await page.getByRole('dialog').getByRole('button',{name:'关闭弹窗',exact:true}).click();assert.equal(await page.getByRole('searchbox',{name:'搜索资金明细',exact:true}).inputValue(),'Filter test');assert.equal(await page.getByRole('combobox',{name:'资金流动类型',exact:true}).inputValue(),'out');assert.equal(await page.locator('.funds-pagination').innerText(),fundsPage);
 // Keeping the current book must not grant its write permission to a foreign read-only book.
 books[1].role='viewer';cross=true;await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('.mobile-nav').getByRole('button',{name:'收支分析',exact:true}).click();await page.getByRole('tab',{name:'明细',exact:true}).click();await page.locator('#analysis-records .transaction-row').first().click();await page.getByRole('dialog').getByRole('heading',{name:'这笔小记录',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').getByRole('button',{name:'修改记录',exact:true}).count(),0);assert.equal(await page.getByRole('dialog').getByRole('button',{name:'删除记录',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: same/cross-book details preserve category, query and pagination; nested chart, verification and budget lists return to their previous state at desktop/mobile sizes.');
}catch(e){console.error(errors,requests.slice(-12));const p=browser.contexts()[0].pages()[0];console.error((await p.locator('body').innerText()).slice(-2300));await p.screenshot({path:resolve(out,'filter-failure.png')});throw e;}finally{await browser.close();server.close();}
