import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();const base=process.env.APP_ORIGIN,ids=[randomUUID(),randomUUID()],cookies=[];let family,book;
async function req(path,method='GET',body,cookie='',expected=200){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,r.status!==expected?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 for(const id of ids){const password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$3)',[id,'fam_http_'+id,salt+':'+scryptSync(password,salt,64).toString('hex')]);cookies.push((await req('login','POST',{username:'fam_http_'+id,password})).cookie);}
 await req('families','GET',undefined,'',401);
 family=(await req('families','POST',{name:'公网家庭测试'},cookies[0])).data.id;
 await req('families/'+family+'/invitations','POST',{username:'fam_http_'+ids[1]},cookies[0]);
 assert.equal((await req('families','GET',undefined,cookies[1])).data.invitations.length,1);
 await req('families/'+family+'/invitation','POST',{accept:true},cookies[1]);
 book=(await req('books','POST',{name:'公网共享账本测试',kind:'shared'},cookies[0])).data.id;
 await req('families/'+family+'/books','POST',{bookId:book},cookies[0]);
 assert.equal((await req('books','GET',undefined,cookies[0])).data[0].family_name,'公网家庭测试');
 await req('books/'+book+'/accounts','GET',undefined,cookies[1],403);
 await req('families/'+family+'/access','PUT',{bookId:book,userId:ids[1],role:'viewer'},cookies[0]);
 await req('books/'+book+'/accounts','GET',undefined,cookies[1]);
 await req('books/'+book+'/accounts','POST',{name:'不应创建'},cookies[1],403);
 await req('families/'+family+'/access','PUT',{bookId:book,userId:ids[1],role:'none'},cookies[0]);
 await req('books/'+book+'/accounts','GET',undefined,cookies[1],403);
 await req('families/'+family,'DELETE',{},cookies[0]);
 assert.equal((await req('books','GET',undefined,cookies[0])).data[0].family_id,null);
 console.log('PASS: public login, invite/accept, book linking, no inherited access, read-only enforcement, revoke and dissolution');
}finally{if(family)await db.query('DELETE FROM families WHERE id=$1',[family]);if(book)await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM login_attempts WHERE username=ANY($1::text[])',[ids.map(id=>'fam_http_'+id)]);await db.end();}
