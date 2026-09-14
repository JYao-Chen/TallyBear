import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,id=randomUUID(),admin='pw_admin_'+id,username='pw_user_'+id;const password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
async function req(path,method='GET',body,cookie='',expected=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,r.status!==expected?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';const sticker='sticker:'+JSON.parse(readFileSync('src/lib/stickers.json','utf8'))[0];let family;
try{
 await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$2,$3,true)',[id,admin,salt+':'+scryptSync(password,salt,64).toString('hex')]);
 const a=(await req('login','POST',{username:admin,password})).cookie;
 await req('users','POST',{username,name:'临时测试',password:'x',avatar:image},a);
 const created=(await req('users','GET',undefined,a)).data.find(u=>u.username===username);assert.equal(created.avatar,image);
 const b=(await req('login','POST',{username,password:'x'})).cookie;
 await req('password','PUT',{oldPassword:'x',newPassword:''},b,400);
 await req('password','PUT',{oldPassword:'x',newPassword:'123456'},b);
 await req('login','POST',{username,password:'123456'});
 const target=(await req('users','GET',undefined,a)).data.find(u=>u.username===username);
 await req('users','PATCH',{id:target.id,name:target.name,avatar:sticker,disabled:false,password:'abc'},a);
 await req('login','POST',{username,password:'abc'});

 assert.equal((await req('users','GET',undefined,a)).data.find(u=>u.username===username).avatar,sticker);
 family=(await req('families','POST',{name:'头像测试家庭',avatar:image},a)).data.id;
 assert.equal((await req('families/'+family,'GET',undefined,a)).data.avatar,image);
 await req('families/'+family,'PUT',{name:'头像测试家庭',description:'',avatar:sticker},a);
 assert.equal((await req('families','GET',undefined,a)).data.items[0].avatar,sticker);
 await req('families/'+family+'/invitations','POST',{username},a);
 const logged=(await req('login','POST',{username,password:'abc'})).cookie;
 assert.equal((await req('families','GET',undefined,logged)).data.invitations[0].avatar,sticker);
 await req('families/'+family+'/invitation','POST',{accept:true},logged);
 await req('families/'+family,'PUT',{name:'禁止修改',description:'',avatar:image},logged,403);
 await req('families/'+family,'PUT',{name:'头像测试家庭',description:'',avatar:'sticker:not-present'},a,400);
 console.log('PASS: user creation image, admin sticker update, family image/sticker persistence, invitation avatar, unauthorized edit rejected');
}finally{if(family)await db.query('DELETE FROM families WHERE id=$1',[family]);await db.query('DELETE FROM users WHERE username=ANY($1::text[])',[[admin,username]]);await db.query('DELETE FROM login_attempts WHERE username=ANY($1::text[])',[[admin,username]]);await db.end();}
