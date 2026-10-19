import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {QuickEntry} from './src/components/QuickEntry';import {LanguageProvider} from './src/components/LanguageProvider';createRoot(document.getElementById('root')).render(<LanguageProvider initial="zh-CN"><QuickEntry book="book" books={[{id:'book',name:'日常账本',kind:'shared',role:'owner'}]} categories={[{name:'服装',icon:'👕',archived:false}]} accounts={[{id:'wallet',name:'微信',ownership:'personal'}]} originals={[]} initial={{id:'bill',kind:'expense',amount:14300,date:'2026-10-19',accountId:'wallet',category:'服装',title:'衣服'}} onSave={async value=>{window.saved=value;}} onCancel={()=>{}}/></LanguageProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const css=await readFile('src/app/globals.css','utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].contents:`<meta name="viewport" content="width=device-width"><style>${css}body{padding:20px}#root{max-width:850px;margin:auto}</style><div id="root"></div><script src="/app.js"></script>`);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let status=null,canInvite=true;
await page.route('**/api/**',route=>{const url=route.request().url();return route.fulfill({json:url.includes('for-record')?{canInvite,claim:status?{recipient_id:'member',recipient_name:'一二',status}:null}:url.includes('/people')?[{id:'member',name:'一二',avatar:'🐻'}]:url.includes('/activities/entry')?{activityId:null}:[]});});
async function load(){await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'保存修改',exact:true}).waitFor();}
try{
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:1000});await load();await page.getByRole('button',{name:/^消费对象：/}).click();await page.getByRole('button',{name:'一二',exact:true}).click();await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.waitForFunction(()=>window.saved?.claimRecipientId==='member');await page.screenshot({path:out+'/edit-'+width+'.png',fullPage:true});
 }
 status='pending';await load();await page.getByRole('button',{name:/^消费对象：/}).click();await page.getByRole('button',{name:'自己',exact:true}).click();await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.waitForFunction(()=>window.saved?.claimRecipientId===null);
 status='accepted';await load();await page.getByText('这笔消费已由一二认领。',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:/^消费对象：/}).count(),0);await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.waitForFunction(()=>window.saved);assert.equal(await page.evaluate(()=>Object.hasOwn(window.saved,'claimRecipientId')),false);
 status=null;canInvite=false;await load();assert.equal(await page.getByRole('button',{name:/^消费对象：/}).count(),0);assert.deepEqual(errors,[]);console.log('PASS: existing-bill member assignment, clearing pending recipient, accepted claim preservation, payer permissions, desktop/mobile');
}finally{await browser.close();server.close();}
