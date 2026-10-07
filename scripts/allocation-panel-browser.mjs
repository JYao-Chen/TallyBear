import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:`import {useState} from 'react';import {createRoot} from 'react-dom/client';import {AllocationPanel} from './src/components/AllocationPanel';import {LanguageProvider} from './src/components/LanguageProvider';function App(){const [revision,setRevision]=useState(0);return <LanguageProvider initial={location.search.includes('en')?'en':'zh-CN'}><main><AllocationPanel book="test" month="2026-10" revision={revision} canWrite={!location.search.includes('readonly')} onSaved={()=>setRevision(r=>r+1)}/></main></LanguageProvider>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'fixture',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const css=(await Promise.all(['globals','mobile-refinement','desktop-refinement','workspace-polish'].map(n=>readFile(`src/app/${n}.css`,'utf8')))).join('\n')+'\n'+result.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url.startsWith('/fonts/'))readFile(resolve('public','.'+req.url)).then(b=>res.end(b)).catch(()=>{res.statusCode=404;res.end()});else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>main{max-width:1440px;margin:32px auto;padding:16px;width:100%}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),errors=[];
const base={id:'server',version:1,title:'腾讯云服务器（三年）',category:'订阅',amount:63160,refunded:0,start:'2026-10',start_date:'2026-10-01',period_unit:'month',period_count:36,months:36,end:'2029-09-30',monthly:1755};
let payload={items:[base,{...base,id:'membership',title:'麦金卡会员（一年）',amount:6535,period_count:12,months:12,end:'2027-09-30',monthly:545}],allocated:2300,ordinary:102744,total:105044};
try{
 const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));let puts=0,fail=false;
 await page.route('**/api/**',route=>{if(route.request().method()==='PUT'){puts++;return route.fulfill({json:{ok:true}})}return route.fulfill({status:fail?500:200,json:fail?{error:'读取失败'}:payload})});
 for(const lang of ['zh','en'])for(const width of [1440,390,360]){
 await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/?${lang}`);await page.locator('.allocation-item').first().waitFor();
 assert.equal(await page.locator('.allocation-item').count(),2);assert.ok(await page.getByText(base.title,{exact:true}).isVisible());assert.equal(await page.locator('.allocation-list>details').count(),0);
 await page.evaluate(async()=>{await document.fonts.ready});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${lang} ${width} overflow`);
 await page.screenshot({path:resolve(out,`${lang}-${width}.png`),fullPage:true});
 }
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.getByRole('button',{name:'调整分摊',exact:true}).first().click();await page.getByRole('button',{name:'保存分摊',exact:true}).click();await page.getByRole('button',{name:'调整分摊',exact:true}).first().waitFor();assert.equal(puts,1);
 payload={...payload,items:Array.from({length:25},(_,i)=>({...base,id:'p'+i,title:'测试分摊 '+i}))};await page.reload();while(await page.getByRole('button',{name:'下一页',exact:true}).isEnabled())await page.getByRole('button',{name:'下一页',exact:true}).click();assert.ok(await page.getByText('测试分摊 24',{exact:true}).isVisible());
 payload={...payload,items:[{...base,start_date:'2027-01-01',monthly:0},{...base,id:'ended',end:'2026-09-30',monthly:0}]};await page.reload();await page.getByText('尚未开始',{exact:true}).waitFor();assert.ok(await page.getByText('已结束',{exact:true}).isVisible());
 payload={items:[],ordinary:0,allocated:0,total:0};await page.reload();await page.getByText('还没有设置费用分摊',{exact:true}).waitFor();await page.screenshot({path:resolve(out,'empty-mobile.png'),fullPage:true});
 fail=true;await page.reload();await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();fail=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.getByText('还没有设置费用分摊',{exact:true}).waitFor();
 payload={...payload,items:[base]};await page.goto(`http://127.0.0.1:${server.address().port}/?readonly`);await page.locator('.allocation-item').waitFor();assert.equal(await page.getByRole('button',{name:'调整分摊',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: bilingual desktop/mobile, visible list, editing refresh, pagination, status, empty, retry and read-only. '+out);
}finally{await browser.close();server.close();}
