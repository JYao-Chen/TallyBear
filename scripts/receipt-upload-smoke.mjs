import assert from 'node:assert/strict';
import pg from 'pg';
import {unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const base=process.env.APP_ORIGIN,id=randomUUID(),username='photo_'+id.slice(0,8),password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');let book;const files=[];
async function request(path,method,body,cookie=''){const r=await fetch(base+'/api/'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});assert.equal(r.status,200,r.status!==200?await r.text():'');return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$3)',[id,username,salt+':'+scryptSync(password,salt,64).toString('hex')]);
 const {cookie}=await request('login','POST',{username,password});book=(await request('books','POST',{name:'照片上传测试',kind:'private'},cookie)).data.id;
 const png=await sharp(randomBytes(1800*1500*3),{raw:{width:1800,height:1500,channels:3}}).png().toBuffer();assert.ok(png.length>6*1024*1024);
 const value=[];for(let n=0;n<10;n++){const image=n===0?png:await sharp(png).resize(32,32).png().toBuffer();const r=await fetch(base+'/api/receipts?book='+book,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'image/png','x-file-name':encodeURIComponent(`测试${n}.png`)},body:image});assert.equal(r.status,200);const file=await r.json();files.push(file.data.split('/').at(-1));value.push(file);if(n===0){const saved=await fetch(base+file.data,{headers:{Cookie:cookie}});assert.equal(saved.headers.get('content-type'),'image/webp');const bytes=Buffer.from(await saved.arrayBuffer());assert.ok(bytes.length<png.length);const meta=await sharp(bytes).metadata();assert.equal(meta.width,1800);assert.equal(meta.height,1500);}}
 const accounts=await (await fetch(base+'/api/books/'+book+'/accounts',{headers:{Cookie:cookie}})).json();
 const entries=[true,false].map((retainReceipts,n)=>({id:randomUUID(),accountId:accounts[0].id,kind:'expense',amount:100,date:'2026-09-13',payee:'凭证测试',category:'餐饮',note:'',attachmentIds:[files[n]],retainReceipts}));
 await request('books/'+book+'/transactions','POST',{entries},cookie);
 for(let n=0;n<2;n++){const receipts=await (await fetch(base+'/api/books/'+book+'/receipts?transaction='+entries[n].id,{headers:{Cookie:cookie}})).json();assert.equal(receipts.length,n===0?1:0);}
 await request('books/'+book+'/drafts','PUT',{section:'images',version:0,value},cookie);
 const stored=(await db.query("SELECT jsonb_array_length(value) AS count,length(value->0->>'data') AS bytes FROM entry_drafts WHERE book_id=$1 AND user_id=$2",[book,id])).rows[0];assert.equal(stored.count,10);assert.ok(stored.bytes<100);
 console.log(`PASS: 10 separate uploads, original ${(png.length/1024/1024).toFixed(1)}MiB photo compressed to full-resolution WebP, compact durable references, opt-in/out transaction API; no model calls`);
}finally{if(book){await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);}await db.query('DELETE FROM users WHERE id=$1',[id]);await db.query('DELETE FROM login_attempts WHERE username=$1',[username]);for(const f of files)await unlink((process.env.RECEIPT_DIR||'./data/receipts')+'/'+f).catch(()=>{});await db.end();}
