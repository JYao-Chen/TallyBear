import assert from 'node:assert/strict';
import pg from 'pg';
import sharp from 'sharp';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const base=process.env.APP_ORIGIN,id=randomUUID(),username='photo_'+id.slice(0,8),password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');let book;
async function request(path,method,body,cookie=''){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});assert.equal(r.status,200,r.status!==200?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$3)',[id,username,salt+':'+scryptSync(password,salt,64).toString('hex')]);
 const {cookie}=await request('login','POST',{username,password});book=(await request('books','POST',{name:'照片上传测试',kind:'private'},cookie)).data.id;
 const png=await sharp(randomBytes(1800*1500*3),{raw:{width:1800,height:1500,channels:3}}).png().toBuffer();assert.ok(png.length>6*1024*1024);
 const data='data:image/png;base64,'+png.toString('base64'),value=Array.from({length:5},(_,n)=>({name:`测试${n}.png`,data}));
 const body={section:'images',version:0,value};assert.ok(JSON.stringify(body).length>40*1024*1024);
 await request('books/'+book+'/drafts','PUT',body,cookie);
 const stored=(await db.query("SELECT jsonb_array_length(value) AS count,length(value->0->>'data') AS bytes FROM entry_drafts WHERE book_id=$1 AND user_id=$2",[book,id])).rows[0];assert.equal(stored.count,5);assert.equal(stored.bytes,data.length);
 console.log(`PASS public photo upload: ${(png.length/1024/1024).toFixed(1)}MB each, ${(JSON.stringify(body).length/1024/1024).toFixed(1)}MB request; five images persisted, no model calls`);
}finally{if(book)await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM users WHERE id=$1',[id]);await db.query('DELETE FROM login_attempts WHERE username=$1',[username]);await db.end();}
