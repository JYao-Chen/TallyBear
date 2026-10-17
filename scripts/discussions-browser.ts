import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {discussionFixtures} from '../tests/helpers/discussion-fixtures';
import {postDiscussionMessage} from '../src/server/discussions';

const url=new URL(process.env.DATABASE_URL!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname.endsWith('_test'));
const origin=process.env.DISCUSSION_TEST_ORIGIN||'http://127.0.0.1:3126';assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const output=process.env.TEST_ARTIFACT_DIR!;assert.ok(output);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const c=new pg.Client({connectionString:url.toString()});await c.connect();
await mkdir(output,{recursive:true});
const f=await discussionFixtures(c as any),aliceToken=randomUUID(),bobToken=randomUUID();
for(const [token,id] of [[aliceToken,f.alice],[bobToken,f.bob]])await c.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",[token,id]);
for(const [kind,id,scope,body] of [
 ['movement',f.movement,'','生活费已转，请查收。'],
 ['transaction',f.expense,'','水电费按两人平分，可以吗？'],
 ['project',f.project,'','房租按约定各承担一半。'],
 ['schedule',f.schedule,'','这里讨论长期计划规则。'],
 ['schedule',f.schedule,'2026-10-17','本期房租已转，麻烦核对。'],
] as const)await postDiscussionMessage(c as any,f.alice,{kind,id,scope},{id:randomUUID(),body});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
const errors:string[]=[],failed:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:{status:()=>number;url:()=>string})=>{if(r.status()>=500)failed.push(r.status()+' '+r.url());});
async function login(token:string){await context.addCookies([{name:'bubu_session',value:token,url:origin}]);await page.goto(origin);await page.locator('.home-workspace').waitFor({timeout:120000});}
async function capture(name:string){if(await page.locator('.discussion').count()===1)await page.locator('.discussion').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/'+name+'.png',fullPage:false});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow: '+name);}
async function sourceContaining(text:string){const card=page.locator('.discussion-inbox-row').filter({hasText:text});await card.getByRole('button',{name:'查看回复',exact:true}).click();await page.getByRole('button',{name:'打开原记录',exact:true}).click();await page.getByRole('button',{name:'打开原记录',exact:true}).waitFor({state:'hidden'});}
try{
 await login(bobToken);await page.locator('.discussion-inbox-row').first().waitFor();assert.equal(await page.locator('.discussion-inbox-row').count(),5);assert.equal(await page.locator('.discussion-inbox-row .profile-avatar').count(),5);await capture('desktop-home');
 await sourceContaining('生活费已转');
 const discussion=page.locator('.discussion');await discussion.getByText('生活费已转，请查收。',{exact:true}).waitFor();assert.equal(await page.getByText('私有记录，不可共享',{exact:true}).count(),0);
 await discussion.getByRole('button',{name:'回复 布布',exact:true}).click();await discussion.getByLabel('留言给参与成员').fill('收到了，生活费记下啦！');await discussion.getByRole('button',{name:'发送留言',exact:true}).click();await discussion.locator('.discussion-body').getByText('收到了，生活费记下啦！',{exact:true}).waitFor();assert.equal(await discussion.locator('blockquote').count(),1);assert.equal(await discussion.locator('.discussion-message').first().locator('.profile-avatar').count(),1);assert.equal(await discussion.locator('blockquote .profile-avatar').count(),1);assert.equal(await discussion.locator('.discussion-composer label .profile-avatar').count(),1);await capture('desktop-transfer');
 await page.setViewportSize({width:375,height:812});await capture('mobile-transfer');await page.locator('.discussion').getByRole('button',{name:'发送留言',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:output+'/mobile-transfer-composer.png'});await page.setViewportSize({width:1440,height:1000});
 await login(bobToken);assert.equal(await page.locator('.discussion-inbox-row').filter({hasText:'生活费已转'}).count(),0);
 await sourceContaining('水电费按两人');await page.locator('.discussion').getByText('水电费按两人平分，可以吗？',{exact:true}).waitFor();await page.locator('.discussion').getByLabel('留言给参与成员').fill('可以，本月照旧平分。');await page.locator('.discussion').getByRole('button',{name:'发送留言',exact:true}).click();await page.locator('.discussion-body').getByText('可以，本月照旧平分。',{exact:true}).waitFor();await capture('desktop-shared-bill');
 await page.setViewportSize({width:375,height:812});await capture('mobile-shared-bill');await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await page.getByRole('button',{name:'查看房租费用分摊详情',exact:true}).first().click();await page.locator('.discussion').getByText('房租按约定各承担一半。',{exact:true}).waitFor();await capture('desktop-allocated-cost');await postDiscussionMessage(c as any,f.alice,{kind:'project',id:f.project},{id:randomUUID(),body:'房租按约定各承担一半，补充确认。'});
 await login(bobToken);await sourceContaining('房租按约定');await page.locator('.discussion').getByText('房租按约定各承担一半。',{exact:true}).waitFor();await capture('desktop-project');await page.setViewportSize({width:375,height:812});await capture('mobile-project');await page.setViewportSize({width:1440,height:1000});
 await login(bobToken);await sourceContaining('本期房租已转');await page.locator('.discussion').getByText('本期房租已转，麻烦核对。',{exact:true}).waitFor();assert.equal(await page.locator('.discussion').getByText('这里讨论长期计划规则。',{exact:true}).count(),0);await capture('desktop-cycle');await page.setViewportSize({width:375,height:812});await capture('mobile-cycle');await page.locator('.discussion').getByRole('button',{name:'发送留言',exact:true}).scrollIntoViewIfNeeded();await page.locator('.discussion').getByRole('button',{name:'发送留言',exact:true}).evaluate((el:HTMLElement)=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForFunction(()=>{const el=document.querySelector('.discussion-composer button[type=submit]');if(!el)return false;const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight-60;});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.screenshot({path:output+'/mobile-cycle-composer.png',animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'计划讨论',exact:true}).click();await page.locator('.discussion').getByText('这里讨论长期计划规则。',{exact:true}).waitFor();assert.equal(await page.locator('.discussion').getByText('本期房租已转，麻烦核对。',{exact:true}).count(),0);
 await login(aliceToken);await sourceContaining('收到了，生活费');await page.getByText('私有记录，不可共享',{exact:true}).waitFor();await page.getByText('私有记录，不可共享',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:output+'/desktop-private-note-preserved.png',animations:'disabled'});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(output+'/result.json',JSON.stringify({passed:true,screenshots:13,browserErrors:errors,serverErrors:failed},null,2));
 console.log('Browser flows passed: transfer reply, shared-bill viewer discussion, project, cycle separation, unread, source navigation and desktop/mobile layout.');
}catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});await writeFile(output+'/failure.txt',await page.locator('body').innerText());throw e;}finally{await browser.close();await c.end();}
