import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

// Real shared editor, synthetic inputs, no API or database access.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.TEST_ARTIFACT_DIR;
assert.ok(output,'Set TEST_ARTIFACT_DIR for screenshots');
await mkdir(output,{recursive:true});
const bundled=await build({stdin:{contents:`
 import {useState} from 'react';
 import {createRoot} from 'react-dom/client';
 import {LineItemsEditor} from './src/components/LineItems';
 import {LanguageProvider} from './src/components/LanguageProvider';
 function Fixture(){
  const [items,setItems]=useState([
   {id:'fish',kind:'item',name:'冰鲜免浆黑鱼片250g',quantity:null,unitPrice:null,amount:null},
   {id:'discount',kind:'discount',name:'满减优惠',quantity:null,unitPrice:null,amount:-500},
   {id:'fee',kind:'fee',name:'配送费',quantity:null,unitPrice:null,amount:200}
  ]),[amount,setAmount]=useState('73.87');
  return <LanguageProvider initial="zh-CN"><main style={{maxWidth:980,margin:'auto',padding:16}}><h1>商品明细计算 · 测试数据</h1><label>实际支付（元）<input aria-label="实际支付（元）" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><LineItemsEditor items={items} onChange={setItems} total={Math.round(Number(amount)*100)} onTotal={n=>setAmount(String(n/100))}/></main></LanguageProvider>;
 }
 createRoot(document.getElementById('root')).render(<Fixture/>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=bundled.outputFiles[0].contents,css=(await Promise.all(['globals','mobile-refinement','desktop-refinement','chat','workspace-polish','receipt-cards'].map(name=>readFile(`src/app/${name}.css`,'utf8')))).join('\n');
const server=createServer((req,res)=>{
 if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}
 else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
 else if(req.url?.startsWith('/fonts/')){readFile(resolve('public','.'+req.url)).then(b=>res.end(b)).catch(()=>{res.statusCode=404;res.end();});}
 else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM_PATH?{executablePath:process.env.TEST_CHROMIUM_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const quantity=page.getByRole('spinbutton',{name:'第1项数量',exact:true}),price=page.getByRole('spinbutton',{name:'第1项单价',exact:true}),subtotal=page.getByRole('spinbutton',{name:'第1项小计',exact:true}),payment=page.getByRole('spinbutton',{name:'实际支付（元）',exact:true});
 await price.fill('13.90');await quantity.fill('2');assert.equal(await subtotal.inputValue(),'27.8');assert.equal(await payment.inputValue(),'73.87');
 await subtotal.fill('25');await quantity.fill('3');assert.equal(await subtotal.inputValue(),'25');
 await page.getByRole('button',{name:'采用推荐小计',exact:true}).click();assert.equal(await subtotal.inputValue(),'41.7');
 await quantity.fill('4');assert.equal(await subtotal.inputValue(),'55.6');
 await page.getByRole('button',{name:'采用推荐实付',exact:true}).click();assert.equal(await payment.inputValue(),'52.6');
 await payment.fill('50');await quantity.fill('5');assert.equal(await subtotal.inputValue(),'69.5');assert.equal(await payment.inputValue(),'50');
 await quantity.fill('');assert.equal(await subtotal.inputValue(),'');assert.ok(await page.getByRole('button',{name:'采用推荐实付',exact:true}).isDisabled());
 await quantity.fill('2');await subtotal.fill('25');
 for(const [width,height] of [[1440,1000],[390,844],[360,800],[844,390]]){
  await page.setViewportSize({width,height});
  await page.evaluate(async()=>{document.activeElement?.blur();window.scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  assert.ok(await page.getByRole('button',{name:'明细类型：优惠 / 抹零',exact:true}).isVisible());
  await page.screenshot({path:resolve(output,`calculator-${width}.png`),fullPage:true,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
 }
 for(let n=0;n<6;n++)await page.getByRole('button',{name:'添加商品',exact:true}).click();
 assert.ok(await page.getByText('3 / 3',{exact:true}).isVisible());
 assert.ok(await page.getByRole('button',{name:'采用推荐实付',exact:true}).isDisabled());
 assert.deepEqual(errors,[]);console.log('Browser calculator interactions, pagination and four responsive widths passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
