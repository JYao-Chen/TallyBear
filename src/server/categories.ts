import {renameCategoryRecords,renameCategoryBudgets} from './category-rename';
import {z} from 'zod';
import stickers from '@/lib/stickers.json';
import {deployment} from '@/lib/deployment';
import {translate} from '@/lib/i18n';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {Failure} from './access';

const baseCategories=[['餐饮','🍜'],['买菜','🥬'],['奶茶咖啡','☕'],['饮料','sticker:050'],['购物','🛍️'],['服装配饰','sticker:023'],['快递费','sticker:044'],['交通','🚇'],['居家','🏡'],['娱乐','🎮'],['会员订阅','🎟️'],['人情往来','sticker:148'],['医疗健康','💊'],['学习','📚'],['房租','🔑'],['水电燃气','💡'],['旅行','🧳'],['工资','💼'],['奖金','🎁'],['零食水果','🍎'],['日用百货','🧻'],['数码家电','💻'],['美容个护','🧴'],['通信网络','📱'],['住宿','🏨'],['运动健身','🏋️'],['宠物','🐾'],['母婴育儿','🍼'],['保险','🛡️'],['手续费','🧾'],['其他','🧸']] as const;
export const defaultCategories=baseCategories.map(([name,icon])=>[translate(name,deployment().language),icon] as [string,string]);

export async function listCategories(user?:string,connection:Pick<PoolClient,'query'>=db){
 const stored=user?(await connection.query('SELECT name,icon,archived,deleted,position FROM category_preferences WHERE user_id=$1',[user])).rows:[];
 const result=new Map(defaultCategories.map(([name,icon],position)=>[name,{name,icon,archived:false,deleted:false,position}]));
 if(user){
  const shared=(await connection.query(`SELECT DISTINCT ON (p.name) p.name,p.icon FROM category_preferences p
   WHERE p.user_id<>$1 AND p.family_shared AND NOT p.archived AND NOT p.deleted AND NOT(p.name=ANY($2::text[]))
    AND EXISTS(SELECT 1 FROM family_members mine JOIN family_members peer ON peer.family_id=mine.family_id WHERE mine.user_id=$1 AND peer.user_id=p.user_id)
   ORDER BY p.name,p.user_id`,[user,defaultCategories.map(([name])=>name)])).rows;
  for(const row of shared)result.set(row.name,{...row,archived:false,deleted:false,position:result.size});
 }
 for(const row of stored)result.set(row.name,{...row,position:row.position??result.size});
 return [...result.values()].filter(row=>!row.deleted).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name));
}

export async function checkCategory(c:PoolClient,user:string,name:string,unchanged?:string){
 if(name===unchanged)return;
 const row=(await c.query('SELECT archived,deleted FROM category_preferences WHERE user_id=$1 AND name=$2',[user,name])).rows[0];
 if(row?.archived||row?.deleted)throw new Failure('这个分类已停用，请选择其他分类或在设置中恢复');
}

export async function changeCategory(user:string,body:unknown){
 if((body as {operation?:string})?.operation==='reorder'){
  const b=z.object({names:z.array(z.string().min(1).max(60)).min(1)}).parse(body);
  return transaction(async c=>{await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);const categories=await listCategories(user,c);
   if(new Set(b.names).size!==b.names.length||b.names.length!==categories.length||b.names.some(name=>!categories.some(category=>category.name===name)))throw new Failure('分类列表已变化，请刷新后重新排序',409);
   for(const [position,name] of b.names.entries()){const category=categories.find(value=>value.name===name)!;await c.query('INSERT INTO category_preferences(user_id,name,icon,archived,position,family_shared) VALUES($1,$2,$3,$4,$5,false) ON CONFLICT(user_id,name) DO UPDATE SET position=$5',[user,name,category.icon,category.archived,position]);}
   return {ok:true};
  });
 }
 const b=z.object({name:z.string().trim().min(1).max(60),newName:z.string().trim().min(1).max(60).optional(),operation:z.enum(['save','delete']).default('save'),icon:z.string().min(1).max(12).refine(value=>!value.startsWith('sticker:')||stickers.includes(value.slice(8)),'表情不存在').default('🧸'),archived:z.boolean().default(false)}).parse(body);
 return transaction(async c=>{await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);const categories=await listCategories(user,c);const old=categories.find(category=>category.name===b.name);
  if(b.operation==='delete'){
   if(!old)throw new Failure('分类不存在');
   await c.query('INSERT INTO category_preferences(user_id,name,icon,archived,deleted,family_shared) VALUES($1,$2,$3,true,true,false) ON CONFLICT(user_id,name) DO UPDATE SET archived=true,deleted=true',[user,b.name,old.icon]);
   return {ok:true};
  }
  if(b.newName&&b.newName!==b.name){
   if(!old)throw new Failure('原分类不存在');
   if(categories.some(category=>category.name===b.newName))throw new Failure('目标分类已存在，请使用其他名称',409);
   await c.query('INSERT INTO category_preferences(user_id,name,icon,archived,deleted,family_shared) VALUES($1,$2,$3,true,true,false) ON CONFLICT(user_id,name) DO UPDATE SET archived=true,deleted=true',[user,b.name,old.icon]);
   const writableBooks=(await c.query("SELECT b.id FROM books b JOIN members m ON m.book_id=b.id WHERE m.user_id=$1 AND m.role<>'viewer' ORDER BY b.id FOR UPDATE OF b",[user])).rows.map(row=>row.id as string);
   await renameCategoryBudgets(c,writableBooks,b.name,b.newName);
   await renameCategoryRecords(c,writableBooks,b.name,b.newName,user);
   await c.query('UPDATE category_feedback SET final_category=CASE WHEN final_category=$3 THEN $1 ELSE final_category END,proposed_category=CASE WHEN proposed_category=$3 THEN $1 ELSE proposed_category END,original_category=CASE WHEN original_category=$3 THEN $1 ELSE original_category END WHERE user_id=$2 AND (final_category=$3 OR proposed_category=$3 OR original_category=$3)',[b.newName,user,b.name]);
   const drafts=(await c.query("SELECT book_id,section,value FROM entry_drafts WHERE user_id=$1 AND section<>'images'",[user])).rows;
   for(const draft of drafts){let changed=false;if(draft.value.category===b.name){draft.value.category=b.newName;changed=true;}for(const entry of draft.value.entries||[])if(entry.category===b.name){entry.category=b.newName;changed=true;}if(changed)await c.query('UPDATE entry_drafts SET value=$1::jsonb,version=version+1 WHERE book_id=$2 AND user_id=$3 AND section=$4',[JSON.stringify(draft.value),draft.book_id,user,draft.section]);}
   await c.query("UPDATE entry_templates SET value=jsonb_set(value,'{category}',to_jsonb($1::text)),version=version+1 WHERE user_id=$2 AND value->>'category'=$3",[b.newName,user,b.name]);
   await c.query("UPDATE bill_schedules SET value=jsonb_set(value,'{category}',to_jsonb($1::text)),version=version+1 WHERE user_id=$2 AND value->>'category'=$3",[b.newName,user,b.name]);
  }
  const position=old?.position??(categories.reduce((largest,category)=>Math.max(largest,category.position??-1),-1)+1);
  const existing=(await c.query('SELECT family_shared FROM category_preferences WHERE user_id=$1 AND name=$2',[user,b.newName||b.name])).rows[0];
  const familyShared=b.newName&&b.newName!==b.name?true:existing?.family_shared??!old;
  await c.query('INSERT INTO category_preferences(user_id,name,icon,archived,position,family_shared) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,name) DO UPDATE SET icon=$3,archived=$4,deleted=false,position=$5,family_shared=$6',[user,b.newName||b.name,b.icon,b.archived,position,familyShared]);
  return {ok:true};
 });
}
