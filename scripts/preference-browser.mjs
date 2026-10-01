import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const out=process.env.TEST_ARTIFACT_DIR;
assert.ok(out?.startsWith('/home/yao/artifacts/tallybear/'));
await mkdir(out,{recursive:true});
const script=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {PreferenceSuggestions} from './src/components/PreferenceSuggestions';import {LanguageProvider} from './src/components/LanguageProvider';
function App(){const en=document.documentElement.lang==='en';const [value,setValue]=useState({kind:'expense',category:en?'Dining':'餐饮',payee:'',accountId:'wallet-a',preferenceSuggestions:[{field:'accountId',value:'wallet-a',label:en?'Everyday payment wallet':'日常付款微信钱包',before:'',state:'applied',count:12,basis:'context',sources:[{id:'one',date:'2026-10-01',title:en?'Lunch at a favourite neighbourhood restaurant with a long descriptive name':'经常去的那家餐馆·双人午餐套餐·门店名称较长的历史记录'}]},{field:'payee',value:'Cafe A',label:en?'Neighbourhood cafe':'常去的咖啡店',before:'',state:'candidate',count:3,basis:'semantic',sources:[{id:'two',date:'2026-09-30',title:en?'Coffee and breakfast':'咖啡与早餐'}]}]});return <LanguageProvider initial={en?'en':'zh-CN'}><div className="panel"><h2>{en?'Review your entry':'核对记账草稿'}</h2><PreferenceSuggestions value={value} onChange={setValue}/><output data-testid="wallet">{value.accountId||'empty'}</output><output data-testid="merchant">{value.payee||'empty'}</output></div></LanguageProvider>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const css=await readFile('src/app/globals.css','utf8'),browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH});
try{for(const locale of ['zh-CN','en'])for(const width of [360,390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<html lang="${locale}" data-currency="CNY"><head><style>${css}</style><style>#root{max-width:760px;margin:auto;padding:16px}output{display:none}</style></head><body><div id="root"></div></body></html>`);await page.addScriptTag({content:script.outputFiles[0].text});
 await page.getByRole('button',{name:locale==='en'?'Review suggestions':'查看与调整'}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${locale} ${width}`);
 await page.screenshot({path:`${out}/${locale}-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:locale==='en'?'Undo fill':'撤回填充'}).click();assert.equal(await page.getByTestId('wallet').textContent(),'empty');
 await page.getByRole('button',{name:locale==='en'?'Use this':'采用'}).last().click();assert.equal(await page.getByTestId('merchant').textContent(),'Cafe A');
 assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: zh/en, 360/390/1440px, evidence expansion, undo/apply and no horizontal overflow');}finally{await browser.close();}
