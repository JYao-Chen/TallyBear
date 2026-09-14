import {z} from 'zod';
import {db} from './db';
import {Failure} from './access';
const section=z.enum(['intake','images','manual']);
const schemas={
 intake:z.object({text:z.string().max(12000),entries:z.array(z.object({id:z.string().uuid()}).passthrough()).max(1000),history:z.boolean().default(false)}),
 images:z.array(z.object({name:z.string().max(500),data:z.string().regex(/^(data:image\/(png|jpeg|webp);base64,|\/api\/receipts\/[0-9a-f-]{36}$)/)})),
 manual:z.object({}).passthrough()
};
export async function getDraft(book:string,user:string,input:unknown){const s=section.parse(input);const row=(await db.query('SELECT value,version FROM entry_drafts WHERE book_id=$1 AND user_id=$2 AND section=$3',[book,user,s])).rows[0];return row||{value:null,version:0};}
export async function saveDraft(book:string,user:string,body:unknown){
 const b=z.object({section,version:z.number().int().nonnegative(),value:z.unknown()}).parse(body);const value=schemas[b.section].parse(b.value);const json=JSON.stringify(value);
 if(b.section!=='images'&&json.length>2000000)throw new Failure('草稿过大，请分批保存',413);
 const result=await db.query('INSERT INTO entry_drafts(book_id,user_id,section,value) SELECT $1,$2,$3,$4::jsonb WHERE $5=0 ON CONFLICT(book_id,user_id,section) DO NOTHING RETURNING version',[book,user,b.section,json,b.version]);
 if(result.rowCount)return result.rows[0];
 const updated=await db.query('UPDATE entry_drafts SET value=$1::jsonb,version=version+1,updated_at=now() WHERE book_id=$2 AND user_id=$3 AND section=$4 AND version=$5 RETURNING version',[json,book,user,b.section,b.version]);
 if(!updated.rowCount)throw new Failure('这份草稿已在其他设备更新，请先重新读取，避免覆盖',409);return updated.rows[0];
}
