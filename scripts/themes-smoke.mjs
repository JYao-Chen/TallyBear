import assert from 'node:assert/strict';import {randomUUID,randomBytes,scryptSync} from 'node:crypto';import pg from 'pg';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,ids=[randomUUID(),randomUUID()],names=ids.map(id=>'theme_'+id.slice(0,8)),password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
async function req(path,method='GET',body,cookie='',status=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});assert.equal(r.status,status,!r.ok&&r.status!==status?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
try{
 for(let i=0;i<ids.length;i++)await db.query('INSERT INTO users(id,username,name,password,avatar) VALUES($1,$2,$3,$4,$5)',[ids[i],names[i],'主题测试',salt+':'+scryptSync(password,salt,64).toString('hex'),'🧸']);
 let a=(await req('login','POST',{username:names[0],password})).cookie;const b=(await req('login','POST',{username:names[1],password})).cookie;
 assert.equal((await req('me','GET',undefined,a)).data.theme,'bear');await req('me','PATCH',{theme:'minimal',id:ids[1]},a);assert.equal((await req('me','GET',undefined,a)).data.theme,'minimal');assert.equal((await req('me','GET',undefined,b)).data.theme,'bear');
 await req('me','PUT',{name:'换名保留主题',avatar:'🧸'},a);assert.equal((await req('me','GET',undefined,a)).data.theme,'minimal');await req('me','PATCH',{theme:'unknown'},a,400);await req('me','PATCH',{theme:'bear'},'',401);
 await req('logout','POST',{},a);a=(await req('login','POST',{username:names[0],password})).cookie;assert.equal((await req('me','GET',undefined,a)).data.theme,'minimal');assert.equal((await req('me','GET',undefined,a)).data.avatar,'🧸');
 const html=await(await fetch(base+'/',{headers:{Cookie:'bubu_theme=minimal'}})).text();assert.ok(html.includes('data-theme="minimal"'));assert.ok(html.includes('manifest-minimal.webmanifest'));assert.ok(!html.includes('/characters/hello.gif'));assert.ok(!html.includes('/characters/thinking.gif'));
 await req('me','PATCH',{theme:'bear'},a);assert.equal((await req('me','GET',undefined,a)).data.theme,'bear');
 console.log('PASS: 主题按用户保存、登录恢复、账号隔离、资料/头像不被改写、无效主题拒绝、服务端简洁主题与图标替换');
}finally{await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM login_attempts WHERE username=ANY($1::text[])',[names]);await db.end();}
