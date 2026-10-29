import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {ChatActionEditor} from './src/components/ChatActionEditor';import {LanguageProvider} from './src/components/LanguageProvider';const action={id:'test',kind:'installment',bookId:'test',title:'Installment',status:'pending',summary:[],warnings:[],missing:[],data:{name:'Test purchase',amount:35228,date:'2026-10-29',terms:6,firstDate:'2026-11-19',fees:0,allocate:true}};createRoot(document.getElementById('root')).render(<LanguageProvider initial={location.search.includes('en')?'en':'zh-CN'}><main><ChatActionEditor action={action} onSave={async data=>{window.saved=data}} onCancel={()=>{}}/></main></LanguageProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'fixture',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const css=(await Promise.all(['globals','mobile-refinement','desktop-refinement','workspace-polish'].map(n=>readFile(`src/app/${n}.css`,'utf8')))).join('\n')+'\n'+result.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else if(req.url.startsWith('/fonts/'))readFile(resolve('public','.'+req.url)).then(b=>res.end(b)).catch(()=>{res.statusCode=404;res.end()});else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>main{max-width:1440px;margin:32px auto;padding:16px;width:100%}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH}),errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({json:{bookId:'test',books:[],accounts:[],categories:[],activities:[]}}));
 for(const en of [false,true])for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/?${en?'en':'zh'}`);
 const month=page.getByLabel(en?'First expense month':'费用分摊起始月份',{exact:true}),months=page.getByLabel(en?'Expense allocation months':'费用分摊月数',{exact:true});
 await month.fill('2026-10');await months.fill('12');await page.getByRole('button',{name:en?'Update card':'更新卡片',exact:true}).click();await page.waitForFunction(()=>window.saved);
 let saved=await page.evaluate(()=>window.saved);assert.equal(saved.allocationStart,'2026-10-01');assert.equal(saved.allocationMonths,12);assert.equal(saved.terms,6);assert.equal(saved.firstDate,'2026-11-19');assert.equal(saved.allocate,true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(out,`${en?'en':'zh'}-${width}.png`),fullPage:true});
 await page.getByRole('checkbox',{name:en?'Allocate purchase costs':'本金费用分摊',exact:true}).uncheck();assert.equal(await month.count(),0);await page.evaluate(()=>{window.saved=null});await page.getByRole('button',{name:en?'Update card':'更新卡片',exact:true}).click();await page.waitForFunction(()=>window.saved);saved=await page.evaluate(()=>window.saved);assert.equal(saved.allocate,false);
 }
 assert.deepEqual(errors,[]);console.log('PASS: bilingual desktop/mobile installment allocation fields, independent dates/counts, disabling allocation and no overflow.');
}finally{await browser.close();server.close();}
