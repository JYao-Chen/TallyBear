import {z} from 'zod';
import stickers from '@/lib/stickers.json';
import type {PoolClient} from 'pg';
import {db,transaction,lockBook} from './db';
import {Failure} from './access';
export const defaultCategories=[['餐饮','🍜'],['买菜','🥬'],['奶茶咖啡','☕'],['购物','🛍️'],['交通','🚇'],['居家','🏡'],['娱乐','🎮'],['医疗健康','💊'],['学习','📚'],['房租','🔑'],['水电燃气','💡'],['旅行','🧳'],['工资','💼'],['奖金','🎁'],['其他','🧸']];
export async function listCategories(book:string,connection:Pick<PoolClient,'query'>=db){
 const stored=(await connection.query('SELECT name,icon,archived,deleted,position FROM category_preferences WHERE book_id=$1',[book])).rows;
 const used=(await connection.query('SELECT DISTINCT category AS name FROM transactions WHERE book_id=$1 UNION SELECT category AS name FROM budgets WHERE book_id=$1',[book])).rows;
 const result=new Map(defaultCategories.map(([name,icon])=>[name,{name,icon,archived:false}]));for(const r of used)if(!result.has(r.name))result.set(r.name,{name:r.name,icon:'🧸',archived:false});for(const r of stored)result.set(r.name,r);return [...result.values()].filter(r=>!(r as {deleted?:boolean}).deleted).map((r,index)=>({...r,position:(r as {position?:number}).position??index})).sort((a,b)=>a.position-b.position);
}
export async function checkCategory(c:PoolClient,book:string,name:string,unchanged?:string){if(name===unchanged)return;const row=(await c.query('SELECT archived,deleted FROM category_preferences WHERE book_id=$1 AND name=$2',[book,name])).rows[0];if(row?.archived||row?.deleted)throw new Failure('这个分类已停用，请选择其他分类或在设置中恢复');}
export async function changeCategory(book:string,body:unknown){
 if((body as {operation?:string})?.operation==='reorder'){const b=z.object({names:z.array(z.string().min(1).max(60)).min(1)}).parse(body);return transaction(async c=>{await lockBook(c,book);const categories=await listCategories(book,c);if(new Set(b.names).size!==b.names.length||b.names.length!==categories.length||b.names.some(n=>!categories.some(v=>v.name===n)))throw new Failure('分类列表已变化，请刷新后重新排序',409);for(const [position,name] of b.names.entries()){const category=categories.find(v=>v.name===name)!;await c.query('INSERT INTO category_preferences(book_id,name,icon,archived,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(book_id,name) DO UPDATE SET position=$5',[book,name,category.icon,category.archived,position]);}return {ok:true};});}
 const b=z.object({name:z.string().trim().min(1).max(60),newName:z.string().trim().min(1).max(60).optional(),operation:z.enum(['save','delete']).default('save'),icon:z.string().min(1).max(12).refine(v=>!v.startsWith('sticker:')||stickers.includes(v.slice(8)),'表情不存在').default('🧸'),archived:z.boolean().default(false)}).parse(body);
 return transaction(async c=>{await lockBook(c,book);const categories=await listCategories(book,c);const old=categories.find(x=>x.name===b.name);
 if(b.operation==='delete'){if(!old)throw new Failure('分类不存在');await c.query('INSERT INTO category_preferences(book_id,name,icon,archived,deleted) VALUES($1,$2,$3,true,true) ON CONFLICT(book_id,name) DO UPDATE SET archived=true,deleted=true',[book,b.name,old.icon]);return {ok:true};}
  if(b.newName&&b.newName!==b.name){if(!old)throw new Failure('原分类不存在');if(categories.some(x=>x.name===b.newName))throw new Failure('目标分类已存在，请使用其他名称',409);
   await c.query('INSERT INTO category_preferences(book_id,name,icon,archived) VALUES($1,$2,$3,true) ON CONFLICT(book_id,name) DO UPDATE SET archived=true',[book,b.name,old.icon]);
   await c.query('UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND category=$3',[b.newName,book,b.name]);await c.query('UPDATE budgets SET category=$1 WHERE book_id=$2 AND category=$3',[b.newName,book,b.name]);
   const drafts=(await c.query("SELECT user_id,section,value FROM entry_drafts WHERE book_id=$1 AND section<>'images'",[book])).rows;
   for(const d of drafts){let changed=false;if(d.value.category===b.name){d.value.category=b.newName;changed=true;}for(const e of d.value.entries||[])if(e.category===b.name){e.category=b.newName;changed=true;}if(changed)await c.query('UPDATE entry_drafts SET value=$1::jsonb,version=version+1 WHERE book_id=$2 AND user_id=$3 AND section=$4',[JSON.stringify(d.value),book,d.user_id,d.section]);}
   await c.query("UPDATE entry_templates SET value=jsonb_set(value,'{category}',to_jsonb($1::text)),version=version+1 WHERE book_id=$2 AND value->>'category'=$3",[b.newName,book,b.name]);
   await c.query("UPDATE bill_schedules SET value=jsonb_set(value,'{category}',to_jsonb($1::text)),version=version+1 WHERE book_id=$2 AND value->>'category'=$3",[b.newName,book,b.name]);
  }
  const position=(old as {position?:number}|undefined)?.position??(categories.reduce((n,v)=>Math.max(n,(v as {position?:number}).position??-1),-1)+1);await c.query('INSERT INTO category_preferences(book_id,name,icon,archived,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(book_id,name) DO UPDATE SET icon=$3,archived=$4,deleted=false,position=$5',[book,b.newName||b.name,b.icon,b.archived,position]);return {ok:true};
 });
}
