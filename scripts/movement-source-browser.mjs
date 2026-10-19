import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {FamilyMovementDetails} from './src/components/FamilyMovementDetails';import {LanguageProvider} from './src/components/LanguageProvider';createRoot(document.getElementById('root')).render(<LanguageProvider initial="zh-CN"><FamilyMovementDetails row={{id:'movement',movement_family_id:'family',amount:35000,title:'转给一二',wallet_balances:[{account_id:'wechat',name:'微信',balance:7151}]}} onChanged={async()=>{window.refreshed=true;}} onClose={()=>{window.closedDetail=true;}}/></LanguageProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const css=(await Promise.all(['globals','mobile-refinement','desktop-refinement','workspace-polish'].map(n=>readFile('src/app/'+n+'.css','utf8')))).join('\n');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].contents:`<meta name="viewport" content="width=device-width"><style>${css}</style><div id="root"></div><script src="/app.js"></script>`);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());let user='sender',status='confirmed',fail=false,body;
await page.route('**/api/**',async route=>{
 const r=route.request();if(r.url().includes('discussions'))return route.fulfill({json:{rows:[],people:[],participants:[],total:0,context:{participants:[],userId:user},user:{id:user},canPost:true}});
 if(r.method()==='POST'){body=r.postDataJSON();return route.fulfill({status:fail?409:200,json:fail?{error:'付款钱包已改变，请刷新后再更正'}:{ok:true}});}
 return route.fulfill({json:{userId:user,books:[],wallets:[{id:'wechat',name:'微信',owner_id:'sender'},{id:'bank',name:'建设银行',institution:'建设银行',suffix:'1234',owner_id:'sender'}],movements:[{id:'movement',sender_id:'sender',recipient_id:'recipient',sender_name:'布布',recipient_name:'一二',source_id:user==='sender'?'wechat':null,source_name:user==='sender'?'微信':null,target_id:null,target_name:null,kind:'transfer',status,date:'2026-10-19',created_at:'2026-10-19T02:25:35Z',confirmed_at:'2026-10-19T02:26:58Z',note:'请一二买衣服和服务费',attachments:[]}]}});
});
async function load(){await page.goto('http://127.0.0.1:'+server.address().port);await page.getByText('转出钱包',{exact:true}).waitFor();}
try{
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:1000});await load();await page.getByRole('button',{name:'更正转出钱包',exact:true}).click();await page.getByRole('button',{name:/^正确的转出钱包：/}).click();await page.getByRole('button',{name:'建设银行 · 1234',exact:true}).click();await page.locator('.movement-source-correction').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/correction-'+width+'.png'});await page.getByRole('button',{name:'确认更正钱包',exact:true}).click();await page.waitForFunction(()=>window.refreshed&&window.closedDetail);assert.deepEqual(body,{operation:'correct-source',id:'movement',sourceId:'bank',expectedSourceId:'wechat'});
 }
 fail=true;await load();await page.getByRole('button',{name:'更正转出钱包',exact:true}).click();await page.getByRole('button',{name:/^正确的转出钱包：/}).click();await page.getByRole('button',{name:'建设银行 · 1234',exact:true}).click();await page.getByRole('button',{name:'确认更正钱包',exact:true}).click();await page.getByRole('alert').filter({hasText:'付款钱包已改变'}).waitFor();assert.equal(await page.evaluate(()=>!!window.closedDetail),false);
 user='recipient';await load();assert.equal(await page.getByRole('button',{name:'更正转出钱包',exact:true}).count(),0);
 user='sender';status='cancelled';await load();assert.equal(await page.getByRole('button',{name:'更正转出钱包',exact:true}).count(),0);
 status='pending';await load();await page.getByRole('button',{name:'更正转出钱包',exact:true}).waitFor();assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile source-wallet correction, exact payload, refresh, stale error, sender-only/cancelled/pending states');
}finally{await browser.close();server.close();}
