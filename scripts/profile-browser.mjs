import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const out=process.env.TEST_ARTIFACT_DIR;assert.ok(out?.startsWith('/home/yao/artifacts/tallybear/'));await mkdir(out,{recursive:true});
const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ProfilePage} from './src/components/ManagementPages';import {LanguageProvider} from './src/components/LanguageProvider';import {ThemeProvider} from './src/components/ThemeProvider';const en=document.documentElement.lang==='en';createRoot(document.getElementById('root')).render(<LanguageProvider initial={en?'en':'zh-CN'}><ThemeProvider initial="bear"><ProfilePage user={{id:'test',name:'Test',username:'test',avatar:'',theme:'bear',admin:false}} onSaved={async()=>{}} memoryRequest={{id:'',key:1}}/></ThemeProvider></LanguageProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const css=(await readFile('src/app/globals.css','utf8')).replace("@import './personal-profile.css';",await readFile('src/app/personal-profile.css','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH});
try{for(const locale of ['zh-CN','en'])for(const width of [360,390,1440]){
 const en=locale==='en',t=(zh,english)=>en?english:zh,page=await browser.newPage({viewport:{width,height:width<600?844:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wallet='00000000-0000-4000-8000-000000000001',place='00000000-0000-4000-8000-000000000002';
 const resources={wallets:[{id:wallet,name:t('微信日常钱包','Everyday WeChat wallet')}],categories:[t('餐饮','Dining'),t('交通','Transport')],places:[{id:place,name:t('公司附近','Office area'),latitude:31.23,longitude:121.48,version:0}]};
 const fields=[['accountId',wallet,'stable','dining'],['scene.meal',t('午餐','Lunch'),'stable','dining'],['scene.transport',t('地铁','Metro'),'changed','transport'],['platform',t('京东','JD'),'tentative','shopping'],['scene.diningMode','delivery','tentative','dining'],['accountId',wallet,'stable','groceries']];
 const items=fields.map(([field,value,status,type],i)=>({key:'insight-'+i,condition:{kind:'expense',fields:{'scene.type':type}},field,status,count:12+i,previousValue:status==='changed'?t('公交','Bus'):undefined,lastSeen:'2026-10-01',choices:[{value,count:12,independent:10,weight:9.2,share:.92,recentCount:8,previousCount:4,sources:[{id:'source-'+i,title:t('熟悉的餐馆 · 午餐套餐','Favourite café · Lunch set'),date:'2026-09-30'}]}]}));
 const rules=[];let learning=true,locationEnabled=true,retainLocation=false;const requests=[];
 await page.route('http://profile.test/**',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.pathname==='/'){await route.fulfill({contentType:'text/html',body:`<html lang="${locale}"><head><meta charset="utf-8"><style>${css}</style><style>body{background:var(--paper)}#root{padding:28px;max-width:1250px;margin:auto}@media(max-width:600px){#root{padding:16px}}</style></head><body><div id="root"></div></body></html>`});return;}
  if(url.pathname.startsWith('/stickers/')||url.pathname.startsWith('/brands/')){await route.fulfill({body:await readFile('public'+url.pathname),contentType:url.pathname.endsWith('.gif')?'image/gif':url.pathname.endsWith('.png')?'image/png':'image/svg+xml'});return;}
  let data={};
  if(url.pathname==='/api/personal-profile'){
   const section=url.searchParams.get('section');
   if(req.method()==='POST'){const b=req.postDataJSON();requests.push(b);if(b.operation==='save_rule'){const index=rules.findIndex(r=>r.id===b.rule.id);const next={...b.rule,id:'new-rule',version:0};if(index>=0)rules[index]=next;else rules.push(next);}if(b.operation==='settings'){learning=b.enabled;locationEnabled=b.locationEnabled;retainLocation=b.retainLocation;}data={ok:true};}
   else if(section==='settings')data={...resources,enabled:learning,locationEnabled,retainLocation};
   else if(section==='rules')data={...resources,items:rules,total:rules.length};
   else if(section==='events')data={items:[{id:1,operation:'save_rule',created_at:'2026-10-01T01:20:00Z',canUndo:true}],total:1};
   else if(url.searchParams.has('key')){const insight=items.find(i=>i.key===url.searchParams.get('key'));data={...resources,insight,sources:insight.choices.flatMap(c=>c.sources.map(s=>({...s,value:c.value}))),total:1};}
   else{const q=url.searchParams.get('q'),status=url.searchParams.get('status'),filtered=items.filter(i=>(!q||JSON.stringify(i).includes(q))&&(!status||i.status===status));data={...resources,items:filtered,total:filtered.length,rules,summary:{transactions:128,stable:14,changed:2,tentative:7,firstDate:'2026-07-01',lastDate:'2026-10-01'},settings:{enabled:learning}};}
  }else if(url.pathname==='/api/memories')data=url.searchParams.has('settings')?{enabled:learning}:{items:[{id:'memory-1',kind:'product',title:t('日常咖啡 · 中杯拿铁','Everyday coffee · Regular latte'),content:'',attributes:{},aliases:[],version:0,status:'active',owner_id:'test',family_id:null}],total:1};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://profile.test/');await page.addScriptTag({content:result.outputFiles[0].text});
 await page.getByRole('button',{name:t('查看依据','View evidence'),exact:false}).first().waitFor();
 const capture=async name=>{await page.locator('.portrait-loading').waitFor({state:'hidden'});await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow ${locale}/${width}`);await page.screenshot({path:`${out}/${locale}-${width}-${name}.png`,fullPage:true});};
 await page.getByRole('button',{name:t('暂停表情动画','Pause companion animation')}).click();
 assert.match(await page.locator('.portrait-companion img').getAttribute('src'),/\.png$/);
 await page.getByRole('button',{name:t('播放表情动画','Play companion animation')}).click();
 assert.match(await page.locator('.portrait-companion img').getAttribute('src'),/\.gif$/);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('.portrait-companion img')?.currentSrc.endsWith('.png'));
 assert.equal(await page.locator('.portrait-scene-group').count(),4);
 await page.locator('.portrait-state-shortcut.changed').click();await page.locator('.portrait-loading').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.portrait-insight').length===1);
 assert.equal(await page.getByLabel(t('习惯状态','Habit status')).inputValue(),'changed');
 await page.locator('.portrait-state-shortcut.changed').click();await page.waitForFunction(()=>document.querySelectorAll('.portrait-insight').length===6);
 await page.getByLabel(t('搜索画像','Search profile')).fill('no-match');await page.locator('.portrait-empty').waitFor();
 await page.getByLabel(t('搜索画像','Search profile')).fill('');await page.waitForFunction(()=>document.querySelectorAll('.portrait-insight').length===6);
 await page.waitForFunction(()=>[...document.querySelectorAll('.portrait-companion img,.portrait-insight img')].every(i=>i.complete&&i.naturalWidth>0));
 await capture('overview');
 await page.locator('.portrait-insight').first().click();await page.locator('.portrait-sources li').first().waitFor();
 await page.getByRole('button',{name:t('纠正这个偏好','Correct this preference')}).click();await capture('rule');
 await page.getByRole('button',{name:t('保存规则','Save rule'),exact:true}).click();await page.getByRole('status').filter({hasText:t('已保存','Saved')}).waitFor();assert.equal(requests.at(-1).operation,'save_rule');
 await page.getByRole('button',{name:t('场景与规则','Habits & rules'),exact:true}).click();await page.locator('.portrait-rules article').waitFor();
 await page.getByRole('button',{name:t('编辑','Edit'),exact:true}).click();await page.locator('.portrait-rule-editor fieldset').last().locator('select').last().selectOption('disabled');await page.getByRole('button',{name:t('保存规则','Save rule'),exact:true}).click();await page.getByRole('status').filter({hasText:t('已保存','Saved')}).waitFor();assert.equal(requests.at(-1).rule.value,'');
 await page.locator('.portrait-rules article').waitFor();await page.getByRole('button',{name:t('编辑','Edit'),exact:true}).click();await page.getByRole('button',{name:t('保存规则','Save rule'),exact:true}).click();await page.getByRole('status').filter({hasText:t('已保存','Saved')}).waitFor();assert.equal(requests.at(-1).rule.value,'');
 await page.getByRole('button',{name:t('商品与服务','Products & services'),exact:true}).click();await page.locator('.memory-row').first().waitFor();await capture('products');
 await page.getByRole('button',{name:t('学习与隐私','Learning & privacy'),exact:true}).click();await page.getByRole('checkbox',{name:t('开启位置辅助','Enable location assistance')}).waitFor();await capture('privacy');
 await page.getByRole('checkbox',{name:t('启用学习','Enable learning'),exact:true}).click();await page.waitForFunction(()=>{const el=document.querySelector('.portrait-setting input');return el&&!el.checked;});await page.getByRole('status').filter({hasText:t('已保存','Saved')}).waitFor();assert.equal(requests.at(-1).enabled,false);
 assert.deepEqual(errors,[],`${locale} ${width}`);await page.close();
 }console.log('PASS: Chinese/English profile page at 360/390/1440px, no overflow, images, animation controls, reduced motion, status filters, search, evidence, rule save and opt-out');}finally{await browser.close();}
