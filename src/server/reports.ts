import {movementReportSource} from './movement-report';
import {deployment} from '@/lib/deployment';
import {translate,type Language} from '@/lib/i18n';
import {textMatch} from './search-match';
import {accountLabel} from '@/lib/accounts';
import {z} from 'zod';
import {db} from './db';
import {Failure} from './access';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'日期无效');
export function reportFilter(book:string|string[],params:URLSearchParams){
 const input=z.object({from:date,to:date,kind:z.enum(['all','expense','income','refund','transfer','net_expense']).default('all'),account:z.union([z.literal('all'),z.string().uuid()]).default('all'),category:z.string().max(60).default(''),q:z.string().trim().max(200).default(''),mode:z.enum(['contains','exact']).default('contains'),offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(200).default(50)}).parse(Object.fromEntries(params));if(input.to<input.from)throw new Failure('结束日期不能早于开始日期');
 const values:unknown[]=[Array.isArray(book)?book:[book],input.from,input.to];let where='t.book_id=ANY($1::uuid[])'+' AND NOT t.deleted AND t.date BETWEEN $2::date AND $3::date';
 if(input.kind==='net_expense')where+=" AND t.kind IN ('expense','refund')";
 else if(input.kind!=='all'){values.push(input.kind);where+=' AND t.kind=$'+values.length;}
 if(input.account!=='all'){values.push(input.account);where+=' AND (t.account_id=$'+values.length+' OR t.target_id=$'+values.length+')';}
 if(input.category){values.push(input.category);where+=' AND t.category=$'+values.length;}
 if(input.q){values.push(input.q);where+=' AND '+textMatch("ARRAY[t.title,t.scene->>'origin',t.scene->>'destination',t.scene->>'branch',t.payee,t.product,t.note,t.category,t.platform,a.name,t.order_id,t.external_id]||ARRAY(SELECT i->>'name' FROM jsonb_array_elements(t.line_items) i)",'$'+values.length,input.mode);}
 return {input,values,where};
}
const projection='t.family_movement_id,t.movement_family_id,t.movement_status,t.scene,t.title,t.id,t.event_id,t.account_id,t.target_id,t.kind,t.amount::float8 AS amount,t.date,t.payee,t.category,t.note,t.external_id,t.created_at,t.updated_at,t.version,t.verification_reason,t.line_items,t.product,t.platform,t.order_id,t.occurred_at,t.refund_of,a.name AS account_name,a.type AS account_type,a.holder AS account_holder,a.institution AS account_institution,a.suffix AS account_suffix,a.ownership AS account_ownership,(SELECT json_build_object(\'name\',dest.name,\'type\',dest.type,\'holder\',dest.holder,\'institution\',dest.institution,\'suffix\',dest.suffix,\'ownership\',dest.ownership) FROM accounts dest WHERE dest.id=t.target_id) AS target_account,(SELECT name FROM accounts dest WHERE dest.id=t.target_id) AS target_name,u.name AS creator_name';
const joins='ledger_source t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by';
export async function report(book:string|string[],params:URLSearchParams){
 const {input,values,where}=reportFilter(book,params);values.push(input.limit,input.offset);
 const result=await db.query(`${movementReportSource}, filtered AS MATERIALIZED (SELECT DISTINCT ON (COALESCE(t.event_id,t.id)) ${projection} FROM ${joins} WHERE ${where} ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id), page AS (SELECT * FROM filtered ORDER BY date DESC,created_at DESC,id DESC LIMIT $${values.length-1} OFFSET $${values.length}), categories AS (SELECT category AS name,sum(CASE WHEN kind='refund' THEN -amount ELSE amount END)::float8 AS value FROM filtered WHERE kind IN ('expense','refund') GROUP BY category), daily AS (SELECT to_char(date,'YYYY-MM-DD') AS date,COALESCE(sum(amount) FILTER(WHERE kind='income'),0)::float8 AS income,COALESCE(sum(CASE WHEN kind='refund' THEN -amount ELSE amount END) FILTER(WHERE kind IN ('expense','refund')),0)::float8 AS expense FROM filtered GROUP BY date) SELECT json_build_object('accountingScope',(SELECT CASE WHEN personal THEN 'personal' ELSE 'consolidated' END FROM personal_scope),'rows',(SELECT COALESCE(json_agg(page),'[]'::json) FROM page),'totals',(SELECT json_build_object('count',count(*),'income',COALESCE(sum(amount) FILTER(WHERE kind='income'),0),'expense',COALESCE(sum(amount) FILTER(WHERE kind='expense'),0),'refund',COALESCE(sum(amount) FILTER(WHERE kind='refund'),0)) FROM filtered),'categories',(SELECT COALESCE(json_agg(categories ORDER BY value DESC),'[]'::json) FROM categories),'daily',(SELECT COALESCE(json_agg(daily ORDER BY date),'[]'::json) FROM daily)) AS result`,values);
 return result.rows[0].result;
}
export async function exportCSV(book:string,params:URLSearchParams,locale:Language='zh-CN'){
 const {values,where}=reportFilter(book,params);const rows=(await db.query(`${movementReportSource} SELECT ${projection},to_char(t.date,'YYYY-MM-DD') AS date FROM ${joins} WHERE ${where} ORDER BY t.date DESC,t.created_at DESC,t.id DESC`,values)).rows;
 const escape=(v:unknown)=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const lines=[['日期','类型','金额（元）','账户','交易对方','分类','商品摘要','订单号','流水号','备注','记录人','商品明细','转入账户','账目标题'].map(v=>escape(translate(v,locale))).join(',')];
 for(const r of rows)lines.push([r.date,translate(({income:'收入',expense:'支出',refund:'退款到账',transfer:'账户转账'} as Record<string,string>)[r.kind],locale),(r.amount/100).toFixed(2),accountLabel({name:r.account_name,type:r.account_type,holder:r.account_holder,institution:r.account_institution,suffix:r.account_suffix,ownership:r.account_ownership},locale),r.payee,r.category,r.product,r.order_id,r.external_id,r.note,r.creator_name,(r.line_items||[]).map((i:any)=>`${i.name} × ${i.quantity??(locale==='en'?'not specified':'未填写')}：${i.amount===null?translate('待补充',locale):(i.amount/100).toFixed(2)+(' '+deployment().currency)}`).join('；'),r.target_account?accountLabel(r.target_account,locale):r.target_name,r.title||r.payee||r.product].map(escape).join(','));
 return '\ufeff'+lines.join('\r\n');
}
