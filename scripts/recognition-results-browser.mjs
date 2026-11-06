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
let cross=false,emptyResult=false,retries=0;const requests=[],stored={},posted=[];const J='66666666-6666-4666-8666-666666666666',Z='77777777-7777-4777-8777-777777777777',draft={id:J,kind:'expense',amount:1800,date:'2026-11-06',accountId:W,category:'餐饮',title:'自动展开的草稿',payee:'测试店',note:'',lineItems:[]};
try{
 const page=await browser.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname.replace('/api/',''),p=url.searchParams;requests.push(path+'?'+p);let data=[];
 if(path.endsWith('/assistant'))return route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({event:'complete',data:{entries:[draft],message:'自动识别完成'}})+'\n\n'});
 if(path==='jobs/'+J&&route.request().method()==='POST'){retries++;data={ok:true};}
 else if(path==='jobs/'+J)data={id:J,kind:'assistant',status:'complete',book_id:B,result:{entries:emptyResult?[]:[{...draft,id:Z,title:'后台任务草稿'}],message:'已自动识别1张图片'}};
 else if(path==='me')data={id:U,name:'Test user',username:'test',theme:'bear',admin:false};
 else if(path==='books')data=books;
 else if(path==='search-options')data={accounts:[account],categories:['餐饮','奶茶']};
 else if(path==='search')data={rows:[{id:row.id,entity:'transaction',title:row.title,subtitle:'Test search result',book_id:B,deleted:false,items:[],detail:{...row,book_id:B}}],total:45,groups:{transaction:45}};
 else if(path==='activities')data=[];
 else if(path==='families')data={items:[]};
 else if(path==='assets/funds')data={summary:{income:0,expense:1234,refund:0,transferIn:0,transferOut:0,internalTransfer:0,adjustment:0,inflow:0,outflow:1234,flowChange:-1234,balanceChange:-1234,openingBalance:100000,closingBalance:98766},daily:[],rows:[{id:row.id,date:row.date,title:row.title,kind:'expense',amount:1234,inflow:0,outflow:1234,delta:-1234,internal:false,sourceId:W,targetId:null,sourceName:'Test wallet',targetName:'',origin:'transaction',counterparty:'Test shop',note:'Filter test',bookId:B}],count:45,offset:Number(p.get('offset')||0),hasMore:Number(p.get('offset')||0)<40};
 else if(path==='assets/funds/entry')data={canDelete:false,reason:'Read-only fixture'};
 else if(path==='assets')data=[account];
 else if(path==='expense-claims/people')data=[];
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
 else if(path.endsWith('/transactions')){if(route.request().method()==='POST'){posted.push({path,body:route.request().postDataJSON()});data={added:1,merged:0,skipped:0};}else data=[{...row,book_id:cross?B:A}];}
 else if(path.endsWith('/drafts')){const key=path+'?'+p.get('section');if(route.request().method()==='PUT'){const body=route.request().postDataJSON();stored[path+'?'+body.section]={value:body.value,version:body.version+1};data={version:body.version+1};}else data=stored[key]||{value:null,version:0};}
 else if(path.endsWith('/allocations'))data={items:[],ordinary:0,allocated:0,total:0};
 else if(path==='jobs')data=[{id:J,kind:'assistant',status:'complete',book_id:B,book_name:'Private test book',stage:'已完成',created_at:'2026-11-06T04:00:00Z'}];
 else if(path.includes('notifications'))data={items:[],unread:0};
 return route.fulfill({json:data});
 });
 for(const width of [1440,390]){
 for(const key of Object.keys(stored))delete stored[key];posted.length=0;emptyResult=false;retries=0;
 await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const nav=page.locator(width<600?'.mobile-nav':'#primary-navigation');await nav.getByRole('button',{name:'记一笔',exact:true}).click();
 await page.getByPlaceholder('例如：今天用微信在盒马买菜86.5元，支付宝买咖啡18元').fill('识别这笔午饭');await page.getByRole('button',{name:'识别并生成草稿',exact:true}).click();await page.getByLabel('账目标题',{exact:true}).waitFor();assert.equal(await page.getByLabel('账目标题',{exact:true}).inputValue(),'自动展开的草稿');await page.getByLabel('账目标题',{exact:true}).fill('保留当前账本修改');
 await page.getByRole('button',{name:/^后台任务/}).click();await page.getByRole('button',{name:'查看结果',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main input')&&Array.from(document.querySelectorAll('input')).some(i=>i.value==='后台任务草稿'));
 assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByLabel('账目标题',{exact:true}).inputValue(),'后台任务草稿');await page.getByLabel('账目标题',{exact:true}).fill('后台草稿修改后保存');await page.getByRole('button',{name:/确认保存 · 新增1\s*笔/}).click();await page.waitForFunction(()=>!document.querySelector('.intake-review'));
 assert.ok(posted[0].path.includes(B));assert.equal(posted[0].body.entries[0].title,'后台草稿修改后保存');assert.ok(stored['books/'+A+'/drafts?intake'].value.entries.some(d=>d.title==='保留当前账本修改'));
 await page.screenshot({path:resolve(out,'recognition-result-'+width+'.png'),fullPage:true});
 emptyResult=true;await page.getByRole('button',{name:/^后台任务/}).click();await page.getByRole('button',{name:'查看结果',exact:true}).click();await page.getByRole('button',{name:'重新识别图片',exact:true}).click();await page.getByRole('dialog',{name:'任务结果',exact:true}).waitFor({state:'hidden'});assert.equal(retries,1);await page.getByRole('dialog',{name:'后台任务',exact:true}).getByRole('button',{name:'关闭弹窗',exact:true}).click();
 }
 assert.deepEqual(errors,[]);console.log('PASS: recognition opens editable details, job result opens foreign-book draft directly, saves edits to the correct book and preserves existing drafts on desktop/mobile.');
}catch(e){console.error(errors);console.error((await browser.contexts()[0].pages()[0].locator('body').innerText()).slice(-2000));throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}
