import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const fixture=`import {createRoot} from 'react-dom/client';import {QuickEntry} from './src/components/QuickEntry';import {LanguageProvider} from './src/components/LanguageProvider';import {ThemeProvider} from './src/components/ThemeProvider';const book='11111111-1111-4111-8111-111111111111';const accounts=[{id:'bank',name:'工商银行卡',type:'bank'},{id:'credit',name:'招商信用卡',type:'credit'}];createRoot(document.getElementById('root')).render(<LanguageProvider initial='zh-CN'><ThemeProvider initial='bear'><QuickEntry book={book} books={[{id:book,name:'测试账本',kind:'private',role:'owner'}]} categories={[{name:'其他',icon:'📒',archived:false}]} accounts={accounts} originals={[]} onSave={async d=>{window.saved=d;}} onCancel={()=>{}}/></ThemeProvider></LanguageProvider>);`;
const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'fixture',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const layout=await readFile('src/app/layout.tsx','utf8');const css=(await Promise.all([...layout.matchAll(/import ['"]\.\/(.+?\.css)['"]/g)].map(m=>readFile('src/app/'+m[1],'utf8')))).join('\n')+bundle.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH});
try{
const page=await browser.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
await page.route('**/api/**',async route=>{const url=route.request().url();await route.fulfill({json:url.includes('/assets')?[{id:'credit',balance:-100000}]:[]});});
for(const width of [1440,390]){
 await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'还款',exact:true}).click();await page.getByText(/当前账面欠款.*1,000/).waitFor();
 await page.getByRole('textbox',{name:'金额（元）',exact:true}).fill('808.47');await page.getByText(/本次还款后欠款.*191.53/).waitFor();
 await page.screenshot({path:out+'/repayment-'+width+'.png',fullPage:true});
 const submit=page.getByRole('button',{name:'记好了，保存这一笔',exact:true});await submit.click();await page.waitForFunction(()=>!!window.saved);
 const saved=await page.evaluate(()=>window.saved);assert.equal(saved.kind,'transfer');assert.equal(saved.amount,80847);assert.equal(saved.accountId,'bank');assert.equal(saved.targetId,'credit');assert.equal(saved.title,'信用账户还款');
}
assert.deepEqual(errors,[]);console.log('PASS: repayment entry desktop/mobile, recorded debt and projected debt, transfer payload without duplicate expense');
}finally{await browser.close();server.close();}
