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
 import {DraftReview} from './src/components/DraftReview';
 import {ChatActionCards} from './src/components/ChatActionCards';
 import {LanguageProvider} from './src/components/LanguageProvider';
 function Fixture(){
  const [actions,setActions]=useState([{
   id:'sample',kind:'entry',bookId:'test',title:'记账',status:'pending',
   data:{title:'京东七鲜 · 一周食材与生活用品采购',amount:7387,category:'买菜',date:'2026-09-27',
    processingHints:['同一订单的长图已归并；仅保留结算实付金额。'],
    lineItems:Array.from({length:8},(_,n)=>({id:'item'+n,kind:'item',name:'冰鲜免浆黑鱼片250g · 商品 '+(n+1),quantity:2,unitPrice:1390,amount:2780})).concat([
      {id:'coupon',kind:'discount',name:'满减优惠券',amount:-500},
      {id:'delivery',kind:'fee',name:'配送费',amount:200}])},
   missing:['实际付款钱包'],warnings:['请核对明细与实付差异。'],
   summary:[{label:'记入账本',value:'我的账本'},{label:'交易日期',value:'2026-09-27'},{label:'分类',value:'买菜'},{label:'金额',value:'¥73.87'},{label:'备注',value:'食材用于周末家庭聚餐。'}]
  }]);
  const [drafts,setDrafts]=useState([{id:'draft',kind:'expense',title:'七鲜采购',date:'2026-09-27',amount:7387,accountId:'wallet',category:'买菜',note:'周末家庭聚餐',payee:'京东七鲜',lineItems:actions[0].data.lineItems}]);
  if(location.search.includes('draft'))return <LanguageProvider initial="zh-CN"><main style={{maxWidth:900,margin:'auto',padding:16}}><DraftReview book="test" books={[{id:'test',name:'我的账本',role:'owner'}]} drafts={drafts} setDrafts={setDrafts} accounts={[{id:'wallet',name:'微信',type:'cash'}]} originals={[]} busy={false} onReview={()=>{}} onSave={()=>{}}/></main></LanguageProvider>;
  return <LanguageProvider initial="zh-CN"><main style={{maxWidth:720,margin:'auto',padding:16}}><ChatActionCards actions={actions} disabled={false} confirmable={true}
  onEdit={async(id,data)=>setActions(v=>v.map(a=>({...a,data:{...a.data,...data}})))}
  onConfirm={async()=>{throw Error('Missing fields must prevent confirmation')}}
  onCancel={async()=>setActions(v=>v.map(a=>({...a,status:'cancelled'})))}
  onRevise={()=>{document.body.dataset.revised='yes'}}/></main></LanguageProvider>;
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
 await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/api/activities')?[]:{accounts:[],categories:[],activities:[],books:[]})}));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.ok(await page.getByRole('button',{name:'确认保存',exact:true}).isDisabled());
 for(const [width,height] of [[1440,1000],[390,844],[360,800]]){
  await page.setViewportSize({width,height});
  await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
  await page.screenshot({path:resolve(output,`card-${width}.png`),fullPage:true,animations:'disabled'});
 }
 await page.getByRole('button',{name:'下一页',exact:true}).click();
 assert.ok(await page.getByText('冰鲜免浆黑鱼片250g · 商品 8',{exact:true}).isVisible());
 await page.getByRole('button',{name:'通过对话修改',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.body.dataset.revised),'yes');
 await page.getByRole('button',{name:'补充信息',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'确认保存',exact:true}).count(),0);
 await page.screenshot({path:resolve(output,'card-edit-360.png'),fullPage:true,animations:'disabled'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'editor overflow');
 await page.getByRole('button',{name:'取消修改',exact:true}).click();
 await page.getByRole('button',{name:'取消这张卡片',exact:true}).click();
 assert.ok(await page.getByText('已取消',{exact:true}).isVisible());
 assert.equal(await page.getByRole('button',{name:'确认保存',exact:true}).count(),0);
 await page.getByText('查看卡片详情',{exact:true}).click();
 assert.ok(await page.getByText('食材用于周末家庭聚餐。',{exact:true}).isVisible());
 await page.goto(`http://127.0.0.1:${server.address().port}/?draft`);
 for(const width of [1440,390,360]){
  await page.setViewportSize({width,height:900});
  await page.getByRole('heading',{name:'交易信息',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`draft overflow at ${width}`);
  await page.screenshot({path:resolve(output,`draft-${width}.png`),fullPage:true,animations:'disabled'});
 }
 assert.deepEqual(errors,[]);
 console.log('Real card hierarchy, pagination, editing and responsive checks passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
