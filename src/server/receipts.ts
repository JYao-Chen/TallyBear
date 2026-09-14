import {randomUUID} from 'node:crypto';
import {mkdir,readFile,unlink} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {compressReceipt} from './receipt-compression';
import {Failure,member,type User} from './access';
export const receiptDirectory=()=>process.env.RECEIPT_DIR||path.resolve(process.cwd(),'../data/receipts');
async function readReceiptFile(id:string){try{return await readFile(path.join(receiptDirectory(),id));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new Failure('临时图片已过期或未恢复，请重新上传',410);throw e;}}
export function receiptId(s:string){return /^\/api\/receipts\/([0-9a-f-]{36})$/.exec(s)?.[1];}
export async function receiptRoute(req:Request,parts:string[],u:User){
 if(req.method==='POST'){
  const book=new URL(req.url).searchParams.get('book')||'';await member(book,u,true);
  if(!req.body)throw new Failure('请选择图片');
  const id=randomUUID(),file=path.join(receiptDirectory(),id),incoming=file+'.upload';await mkdir(receiptDirectory(),{recursive:true});
  try{
   await pipeline(Readable.fromWeb(req.body as any),createWriteStream(incoming,{flags:'wx'}));
   const compressed=await compressReceipt(incoming,file,new URL(req.url).searchParams.get('purpose')==='photo');
   const name=decodeURIComponent(req.headers.get('x-file-name')||'小票').slice(0,500);
   await db.query('INSERT INTO receipt_files(id,book_id,user_id,name,mime,temporary) VALUES($1,$2,$3,$4,$5,true)',[id,book,u.id,name,compressed.mime]);
   return Response.json({name,data:'/api/receipts/'+id,...compressed});
  }catch(e){await unlink(file).catch(()=>{});throw e;}finally{await unlink(incoming).catch(()=>{});}
 }
 if(req.method!=='GET')throw new Failure('操作不存在',404);
 const id=parts[1];if(!/^[0-9a-f-]{36}$/.test(id||''))throw new Failure('附件不存在',404);
 const row=(await db.query('SELECT * FROM receipt_files WHERE id=$1',[id])).rows[0];if(!row)throw new Failure('附件不存在',404);await member(row.book_id,u);
 if(row.user_id!==u.id&&!(await db.query('SELECT 1 FROM transaction_receipts r JOIN transactions t ON t.id=r.transaction_id WHERE r.file_id=$1 AND t.book_id=$2',[id,row.book_id])).rowCount)throw new Failure('附件尚未共享',403);
 return new Response(await readReceiptFile(id),{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function linkReceipts(c:PoolClient,book:string,user:string,entry:string,ids:string[]=[],retain=false,purpose='receipt'){if(!retain)return;for(const id of new Set(ids)){const valid=await c.query('SELECT 1 FROM receipt_files f WHERE id=$1 AND book_id=$2 AND (user_id=$3 OR EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=f.id)) FOR UPDATE OF f',[id,book,user]);if(!valid.rowCount)throw new Failure('小票附件不存在或没有访问权限',403);await c.query('INSERT INTO transaction_receipts(transaction_id,file_id,purpose) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[entry,id,purpose]);await c.query('UPDATE receipt_files SET temporary=false WHERE id=$1',[id]);}}
export async function resolveReceipt(s:string,book:string){const id=receiptId(s);if(!id)return s;const row=(await db.query('SELECT mime FROM receipt_files WHERE id=$1 AND book_id=$2',[id,book])).rows[0];if(!row)throw new Failure('小票附件不存在',404);return 'data:'+row.mime+';base64,'+(await readReceiptFile(id)).toString('base64');}
export async function authorizeImages(images:string[],book:string,user:string){for(const s of images){const id=receiptId(s);if(!id)continue;const r=await db.query('SELECT 1 FROM receipt_files f WHERE id=$1 AND book_id=$2 AND (user_id=$3 OR EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=f.id))',[id,book,user]);if(!r.rowCount)throw new Failure('无权使用这张小票',403);}}

// Temporary uploads are useful for review/retry for seven days. Running and
// queued jobs keep their inputs until they finish, even after that window.
export async function cleanupReceipts(){
 return transaction(async c=>{
  const rows=(await c.query(`SELECT f.id FROM receipt_files f
   WHERE f.temporary AND f.created_at < now()-interval '7 days'
   AND NOT EXISTS(SELECT 1 FROM transaction_receipts r WHERE r.file_id=f.id)
   AND NOT EXISTS(SELECT 1 FROM ai_jobs j WHERE j.status IN ('queued','running') AND j.payload::text LIKE '%'||f.id::text||'%')
   ORDER BY f.created_at LIMIT 100 FOR UPDATE OF f SKIP LOCKED`)).rows;
  for(const row of rows){
   try{await unlink(path.join(receiptDirectory(),row.id));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   await c.query('DELETE FROM receipt_files WHERE id=$1',[row.id]);
  }
  return rows.length;
 });
}
