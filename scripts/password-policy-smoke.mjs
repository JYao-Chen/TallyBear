import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,id=randomUUID(),admin='pw_admin_'+id,username='pw_user_'+id;const password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
async function req(path,method='GET',body,cookie='',expected=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,r.status!==expected?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$2,$3,true)',[id,admin,salt+':'+scryptSync(password,salt,64).toString('hex')]);
 const a=(await req('login','POST',{username:admin,password})).cookie;
 await req('users','POST',{username,name:'临时测试',password:'x'},a);
 const b=(await req('login','POST',{username,password:'x'})).cookie;
 await req('password','PUT',{oldPassword:'x',newPassword:''},b,400);
 await req('password','PUT',{oldPassword:'x',newPassword:'123456'},b);
 await req('login','POST',{username,password:'123456'});
 const target=(await req('users','GET',undefined,a)).data.find(u=>u.username===username);
 await req('users','PATCH',{id:target.id,name:target.name,avatar:target.avatar,disabled:false,password:'abc'},a);
 await req('login','POST',{username,password:'abc'});
 console.log('PASS: short password create/login/change/admin reset; empty password rejected');
}finally{await db.query('DELETE FROM users WHERE username=ANY($1::text[])',[[admin,username]]);await db.query('DELETE FROM login_attempts WHERE username=ANY($1::text[])',[[admin,username]]);await db.end();}
