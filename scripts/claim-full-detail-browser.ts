import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import sharp from 'sharp';
import {discussionFixtures} from '../tests/helpers/discussion-fixtures';
const url=new URL(process.env.DATABASE_URL!);assert.equal(url.pathname,'/tallybear_claim_test');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
const origin='http://localhost:3119',out=process.env.TEST_ARTIFACT_DIR!;assert.ok(out);await mkdir(out+'/receipts',{recursive:true});
const c=new pg.Client({connectionString:url.toString()});await c.connect();const f=await discussionFixtures(c as any);
const book=randomUUID();await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'一二的私账','private',$2)",[book,f.bob]);await c.query("INSERT INTO members VALUES($1,$2,'owner')",[book,f.bob]);
await c.query("UPDATE transactions SET title='有凭证的外套',platform='测试商城',order_id='ORDER-CLAIM-001',product='羊毛外套',occurred_at='12:30:00',note='付款人的原始说明' WHERE id=$1",[f.privateExpense]);
const tokens=[randomUUID(),randomUUID(),randomUUID()];for(const [i,user] of [f.alice,f.bob,f.outsider].entries())await c.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[tokens[i],user]);
const unrelated=randomUUID();await c.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,category,title) VALUES($1,$2,$3,$4,'expense',100,'2026-10-17','其他','未分享的私单')",[unrelated,f.privateBook,f.wallet,f.alice]);
const files=[randomUUID(),randomUUID(),randomUUID()];const png=await sharp({create:{width:16,height:16,channels:3,background:'#365f56'}}).png().toBuffer();
for(const [i,id] of files.entries()){await writeFile(out+'/receipts/'+id,png);await c.query("INSERT INTO receipt_files(id,book_id,user_id,name,mime,temporary) VALUES($1,$2,$3,$4,'image/png',false)",[id,f.privateBook,f.alice,i===0?'原始凭证.png':i===1?'原始附图.png':'其他私有图片.png']);await c.query('INSERT INTO transaction_receipts(transaction_id,file_id,purpose) VALUES($1,$2,$3)',[i<2?f.privateExpense:unrelated,id,i===1?'photo':'receipt']);}
async function api(i:number,path:string,body?:any){return fetch(origin+'/api/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:'bubu_session='+tokens[i],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
let r=await api(0,'expense-claims/invite',{sourceId:f.privateExpense,recipientId:f.bob});assert.equal(r.status,200,await r.clone().text());const claim=(await r.json()).id;
r=await api(1,'expense-claims/'+claim);assert.equal(r.status,200);let data=await r.json();assert.equal(data.source.order_id,'ORDER-CLAIM-001');assert.equal(data.source.book_id,undefined);assert.deepEqual(data.source.wallet_balances,[]);
r=await api(1,'expense-claims/'+claim+'/receipts');assert.equal((await r.json()).length,2);
for(const id of files.slice(0,2)){r=await api(1,'receipts/'+id+'?claim='+claim);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,png.length);}
assert.equal((await api(1,'receipts/'+files[2]+'?claim='+claim)).status,403);assert.equal((await api(2,'receipts/'+files[0]+'?claim='+claim)).status,403);
r=await api(1,'expense-claims/'+claim,{operation:'accept',version:data.claim.version,bookId:book});assert.equal(r.status,200,await r.clone().text());
data=await (await api(1,'expense-claims/'+claim)).json();const target=data.ownRecord.id;
r=await api(1,'books/'+book+'/receipts?transaction='+target);assert.equal((await r.json()).length,2);assert.equal((await api(1,'receipts/'+files[0])).status,200);assert.equal((await api(1,'books/'+f.privateBook+'/transactions?id='+f.privateExpense)).status,403);
const sender=await (await api(0,'expense-claims/'+claim)).json();assert.equal(sender.claim.target_id,null);assert.equal(sender.targetBookId,null);assert.equal(sender.canEditSource,true);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE!);const browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(20000);const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
async function login(i:number){await context.addCookies([{name:'bubu_session',value:tokens[i],url:origin}]);await page.goto(origin);await page.locator('.home-workspace').waitFor();}
async function capture(name:string){await page.evaluate(async()=>{await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('dialog img[src*="/api/receipts/"]')).filter(i=>i.complete&&i.naturalWidth>0).map(i=>i.decode().catch(()=>{})));await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});}
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await login(0);await page.getByRole('button',{name:'查看记录',exact:true}).click();await page.getByRole('button',{name:'查看单据与讨论',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByText('ORDER-CLAIM-001',{exact:true}).waitFor();await dialog.locator('.sheet-content').evaluate((e:HTMLElement)=>{e.scrollTop=0;});await capture('sender-top-'+width);await dialog.locator('summary').filter({hasText:'账单凭证'}).click();await dialog.locator('.life-photo-grid img').waitFor();
  assert.equal(await dialog.locator('img[src*="/api/receipts/"]').count(),2);await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLImageElement>('dialog img[src*="/api/receipts/"]')).every(i=>i.complete&&i.naturalWidth>0));
  await capture('sender-'+width);await dialog.getByRole('heading',{name:'账目讨论',exact:true}).scrollIntoViewIfNeeded();await capture('sender-bottom-'+width);await dialog.getByRole('button',{name:'修改记录',exact:true}).click();await page.getByRole('button',{name:'保存修改',exact:true}).waitFor();await capture('sender-edit-'+width);
  await login(1); // Open the accepted bill from the recipient ledger through the same entry resolver.
  await page.getByRole('button',{name:'切换账本',exact:true}).click();await page.locator('.book-switch-list button').filter({hasText:'一二的私账'}).click();await page.locator('.transaction-row').filter({hasText:/有凭证的外套|认领人的外套/}).click();
  dialog=page.getByRole('dialog');await dialog.getByText('ORDER-CLAIM-001',{exact:true}).waitFor();await dialog.locator('.sheet-content').evaluate((e:HTMLElement)=>{e.scrollTop=0;});await capture('recipient-top-'+width);await dialog.locator('summary').filter({hasText:'账单凭证'}).click();await dialog.locator('.life-photo-grid img').waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLImageElement>('dialog img[src*="/api/receipts/"]')).every(i=>i.complete&&i.naturalWidth>0));await capture('recipient-'+width);await dialog.getByRole('heading',{name:'账目讨论',exact:true}).scrollIntoViewIfNeeded();await capture('recipient-bottom-'+width);
  await dialog.getByRole('button',{name:'修改记录',exact:true}).click();await page.getByLabel('账目标题',{exact:true}).fill('认领人的外套');await page.getByLabel('备注',{exact:true}).fill('认领人自己的备注');await capture('recipient-edit-'+width);await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByRole('dialog').locator('.detail-fields dd').filter({hasText:'认领人自己的备注'}).waitFor();
  const source=(await c.query('SELECT note,amount FROM transactions WHERE id=$1',[f.privateExpense])).rows[0];assert.equal(source.note,'付款人的原始说明');assert.equal(Number(source.amount),12000);
 }
 const originalVersion=(await c.query('SELECT version FROM transactions WHERE id=$1',[f.privateExpense])).rows[0].version;await c.query("UPDATE transactions SET title='付款人更新标题',version=version+1 WHERE id=$1 AND version=$2",[f.privateExpense,originalVersion]);assert.equal((await c.query('SELECT title FROM transactions WHERE id=$1',[target])).rows[0].title,'认领人的外套');
 assert.deepEqual(errors,[]);
 data=await (await api(1,'expense-claims/'+claim)).json();r=await api(1,'expense-claims/'+claim,{operation:'edit-record',version:data.claim.version,recordVersion:data.ownRecord.version-1,title:'stale',category:'其他',note:''});assert.equal(r.status,409);
 r=await api(1,'expense-claims/'+claim,{operation:'cancel',version:data.claim.version});assert.equal(r.status,200);assert.equal((await api(1,'receipts/'+files[0]+'?claim='+claim)).status,403);assert.equal((await api(1,'receipts/'+files[0])).status,403);assert.equal((await api(0,'receipts/'+files[0])).status,200);
 console.log('PASS: original receipts/photos visible to both claim parties and recipient ledger; unrelated files/private ledgers denied; unified desktop/mobile detail; payer full editor and recipient own metadata editor; versions and cancellation access; original files/source/payment preserved');
}catch(e){await capture('failure');await writeFile(out+'/failure.txt',await page.locator('body').innerText());throw e;}finally{await browser.close();await c.end();}
