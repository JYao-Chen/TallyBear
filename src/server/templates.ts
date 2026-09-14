import {validateActiveAccounts} from './accounts';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db';
import {entry} from './model';
import {Failure} from './access';
export async function templates(book:string,user:string,method:string,body:unknown){
 if(method==='GET')return (await db.query('SELECT id,name,value,version FROM entry_templates WHERE book_id=$1 AND user_id=$2 ORDER BY created_at',[book,user])).rows;
 const b=z.object({id:z.string().uuid().optional(),version:z.number().int().optional(),name:z.string().trim().min(1).max(80).optional(),value:z.unknown().optional()}).parse(body);
 if(method==='DELETE'){await db.query('DELETE FROM entry_templates WHERE book_id=$1 AND user_id=$2 AND id=$3',[book,user,b.id]);return {ok:true};}
 if(method==='POST'||method==='PUT'){
  if(!b.name)throw new Failure('请给常用记录起个名字');const item=entry.parse(b.value);if(item.kind==='refund')throw new Failure('退款需要核对原消费，请单独记录');await transaction(async c=>{await validateActiveAccounts(c,book,item,user);});
  const {title,kind,amount,accountId,targetId,payee,category,note,product,platform,lineItems}=item;const value=JSON.stringify({title,kind,amount,accountId,targetId,payee,category,note,product,platform,lineItems});
  if(method==='POST'){await db.query('INSERT INTO entry_templates(id,book_id,user_id,name,value) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),book,user,b.name,value]);return {ok:true};}
  const result=await db.query('UPDATE entry_templates SET name=$1,value=$2::jsonb,version=version+1 WHERE id=$3 AND book_id=$4 AND user_id=$5 AND version=$6',[b.name,value,b.id,book,user,b.version]);if(!result.rowCount)throw new Failure('常用记录已改变，请重新读取',409);return {ok:true};
 }
 throw new Failure('不支持此操作',405);
}
