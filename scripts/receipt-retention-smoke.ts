import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {db,transaction} from '../src/server/db';
import {receiptRoute,linkReceipts,cleanupReceipts,resolveReceipt} from '../src/server/receipts';
const uid=randomUUID(),book=randomUUID(),account=randomUUID(),entry=randomUUID(),job=randomUUID();
const dir=await mkdtemp(path.join(os.tmpdir(),'receipt-store-'));process.env.RECEIPT_DIR=dir;
const u={id:uid,username:'receipt_'+uid,name:'test',admin:false,avatar:'',theme:'bear' as const};
try{
 await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$3,$4)',[uid,u.username,'test','not-login']);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'Receipt test','private',$2)",[book,uid]);
 await db.query("INSERT INTO members(book_id,user_id,role) VALUES($1,$2,'owner')",[book,uid]);
 await db.query("INSERT INTO accounts(id,book_id,name) VALUES($1,$2,'Test')",[account,book]);
 await db.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,payee,category,note,created_by) VALUES($1,$2,$3,'expense',100,'2026-09-13','','其他','',$4)",[entry,book,account,uid]);
 const png=await sharp({create:{width:1200,height:2400,channels:3,background:'white'}}).png().toBuffer();
 async function upload(){const r=await receiptRoute(new Request('http://localhost/api/receipts?book='+book,{method:'POST',body:png,headers:{'x-file-name':'receipt.png'}}),[],u);const f=await r.json();assert.equal(f.mime,'image/webp');return f.data.split('/').at(-1) as string;}
 const keep=await upload(),discard=await upload(),active=await upload();
 await transaction(c=>linkReceipts(c,book,uid,entry,[discard],false));
 assert.equal((await db.query('SELECT 1 FROM transaction_receipts WHERE file_id=$1',[discard])).rowCount,0);
 await transaction(c=>linkReceipts(c,book,uid,entry,[keep],true));
 await transaction(c=>linkReceipts(c,book,uid,entry,[keep],false));
 assert.equal((await db.query('SELECT 1 FROM transaction_receipts WHERE file_id=$1',[keep])).rowCount,1);
 assert.equal((await db.query('SELECT temporary FROM receipt_files WHERE id=$1',[keep])).rows[0].temporary,false);
 await db.query("UPDATE receipt_files SET created_at=now()-interval '8 days' WHERE book_id=$1",[book]);
 await db.query("INSERT INTO ai_jobs(id,user_id,book_id,kind,status,payload) VALUES($1,$2,$3,'assistant','running',$4)",[job,uid,book,{images:['/api/receipts/'+active]}]);
 await cleanupReceipts();assert.ok(await stat(path.join(dir,keep)));assert.ok(await stat(path.join(dir,active)));await assert.rejects(stat(path.join(dir,discard)));
 await assert.rejects(resolveReceipt('/api/receipts/'+discard,book));
 await db.query("UPDATE ai_jobs SET status='error' WHERE id=$1",[job]);await cleanupReceipts();await assert.rejects(stat(path.join(dir,active)));
 console.log('PASS: compressed upload, opt-in persistence, opt-out preserves existing links, expired cleanup, running task protection');
}finally{await db.query('DELETE FROM ai_jobs WHERE id=$1',[job]);await db.query('DELETE FROM transactions WHERE book_id=$1',[book]);await db.query('DELETE FROM books WHERE id=$1',[book]);await db.query('DELETE FROM users WHERE id=$1',[uid]);await db.end();await rm(dir,{recursive:true,force:true});}
