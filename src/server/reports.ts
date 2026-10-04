import {detailOrder,detailSorts} from '@/lib/detail-sort';
import {unifiedExpenseSource} from './unified-expenses';
import {attachWalletBalances} from './wallet-history';
import {movementReportSource,personalMovementReportSource} from './movement-report';
import {deployment} from '@/lib/deployment';
import {translate,type Language} from '@/lib/i18n';
import {textMatch} from './search-match';
import {accountLabel} from '@/lib/accounts';
import {z} from 'zod';
import {db} from './db';
import {Failure} from './access';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'日期无效');
export function reportFilter(book:string|string[],params:URLSearchParams){
 const input=z.object({from:date,to:date,sort:z.enum(detailSorts).default('date_desc'),kind:z.enum(['all','expense','income','refund','transfer','net_expense','none']).default('all'),account:z.union([z.literal('all'),z.string().uuid()]).default('all'),activity:z.string().uuid().optional(),creator:z.string().uuid().optional(),category:z.string().max(60).default(''),q:z.string().trim().max(200).default(''),payee:z.string().max(120).default(''),product:z.string().max(160).default(''),platform:z.string().max(120).default(''),orderId:z.string().max(160).default(''),externalId:z.string().max(160).default(''),min:z.coerce.number().int().nonnegative().optional(),max:z.coerce.number().int().nonnegative().optional(),mode:z.enum(['contains','exact']).default('contains'),offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(200).default(50)}).parse(Object.fromEntries(params));if(input.to<input.from)throw new Failure('结束日期不能早于开始日期');if(input.min!==undefined&&input.max!==undefined&&input.min>input.max)throw new Failure('最高金额不能低于最低金额');
 const values:unknown[]=[Array.isArray(book)?book:[book],input.from,input.to];let where='t.book_id=ANY($1::uuid[])'+' AND NOT t.deleted AND t.date BETWEEN $2::date AND $3::date';
 if(input.kind==='net_expense')where+=" AND t.kind IN ('expense','refund')";
 else if(input.kind!=='all'){values.push(input.kind);where+=' AND t.kind=$'+values.length;}
 if(input.account!=='all'){values.push(input.account);where+=' AND (t.account_id=$'+values.length+' OR t.target_id=$'+values.length+')';}
 if(input.activity){values.push(input.activity);where+=' AND EXISTS(SELECT 1 FROM activity_entries ae WHERE ae.transaction_id=t.id AND ae.activity_id=$'+values.length+')';}
 if(input.category){values.push(input.category);where+=' AND t.category=$'+values.length;}
 if(params.has('groupField')){const field=z.enum(['category','payee','product','account','platform']).parse(params.get('groupField'));const value=z.string().max(200).parse(params.get('groupValue')??'');values.push(value);where+=` AND COALESCE(${field==='account'?'a.name':'t.'+field},'')=$${values.length}`;}
 if(input.creator){values.push(input.creator);where+=' AND t.created_by=$'+values.length;}
 for(const field of ['payee','product','platform'] as const){if(input[field]){values.push(input[field]);const fields=field==='product'?"ARRAY[t.product]||ARRAY(SELECT i->>'name' FROM jsonb_array_elements(t.line_items) i)":`ARRAY[t.${field}]`;where+=' AND '+textMatch(fields,'$'+values.length,input.mode);}}
 for(const field of ['orderId','externalId'] as const){if(input[field]){values.push(input[field]);where+=` AND t.${field==='orderId'?'order_id':'external_id'}=$${values.length}`;}}
 for(const field of ['min','max'] as const){if(input[field]!==undefined){values.push(input[field]);where+=` AND t.amount${field==='min'?'>=':'<='}$${values.length}`;}}
 if(input.q){values.push(input.q);where+=' AND '+textMatch("ARRAY[t.title,t.scene->>'origin',t.scene->>'destination',t.scene->>'branch',t.payee,t.product,t.note,t.category,t.platform,a.name,t.order_id,t.external_id]||ARRAY(SELECT i->>'name' FROM jsonb_array_elements(t.line_items) i)",'$'+values.length,input.mode);}
 if(params.get('view')==='expenses')where+=" AND t.kind<>'transfer'";
 return {input,values,where};
}
const projection='t.family_movement_id,t.movement_family_id,t.movement_status,t.book_id,b.name AS book_name,t.scene,t.title,t.id,t.event_id,t.account_id,t.target_id,t.kind,t.amount::float8 AS amount,t.date,t.payee,t.category,t.note,t.external_id,t.created_at,t.updated_at,t.version,t.verification_reason,t.line_items,t.product,t.platform,t.order_id,t.occurred_at,t.refund_of,a.name AS account_name,a.type AS account_type,a.holder AS account_holder,a.institution AS account_institution,a.suffix AS account_suffix,a.ownership AS account_ownership,(SELECT json_build_object(\'name\',dest.name,\'type\',dest.type,\'holder\',dest.holder,\'institution\',dest.institution,\'suffix\',dest.suffix,\'ownership\',dest.ownership) FROM accounts dest WHERE dest.id=t.target_id) AS target_account,(SELECT name FROM accounts dest WHERE dest.id=t.target_id) AS target_name,u.name AS creator_name';
const joins='ledger_source t JOIN books b ON b.id=t.book_id LEFT JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by';
async function personalWalletFilter(user:string,params:URLSearchParams){
 const books=(await db.query('SELECT b.id FROM books b JOIN members m ON m.book_id=b.id WHERE m.user_id=$1 ORDER BY b.id',[user])).rows.map(r=>r.id);
 const filter=reportFilter(books,params);filter.values.push(user);const userArg='$'+filter.values.length;
 filter.where+=` AND (a.owner_id=${userArg} OR (t.kind='transfer' AND EXISTS(SELECT 1 FROM accounts dest WHERE dest.id=t.target_id AND dest.owner_id=${userArg})))`;
 return filter;
}
async function reportResult({input,values,where}:ReturnType<typeof reportFilter>,source=movementReportSource,user?:string,unified=true){
 const costs=unified?await unifiedExpenseSource(values[0] as string[],input.from,input.to,values,source):null;
 if(costs)source=costs.source;
 const fields=costs?projection+',t.cost_project_id,t.cost_period_end,t.cost_row_key,t.cost_basis_amount,t.cost_basis_start,t.cost_basis_end,t.actual_amount::float8 AS actual_amount':projection;
 const key=costs?'COALESCE(t.cost_row_key,COALESCE(t.event_id,t.id)::text)':'COALESCE(t.event_id,t.id)::text';
 values.push(input.limit,input.offset);
 const result=await db.query(`${source}, filtered AS MATERIALIZED (SELECT DISTINCT ON (${key}) ${fields} FROM ${joins} WHERE ${where} ORDER BY ${key},t.created_at,t.id), page AS (SELECT * FROM filtered ORDER BY ${detailOrder(input.sort)}${costs?',cost_row_key':''} LIMIT $${values.length-1} OFFSET $${values.length}), categories AS (SELECT category AS name,sum(CASE WHEN kind='refund' THEN -amount ELSE amount END)::float8 AS value FROM filtered WHERE kind IN ('expense','refund') GROUP BY category), daily_entries AS (SELECT f.kind,d.day::date AS date,${costs?"CASE WHEN f.cost_row_key IS NOT NULL THEN floor(f.cost_basis_amount::numeric/(f.cost_basis_end-f.cost_basis_start))+CASE WHEN d.day::date-f.cost_basis_start<mod(f.cost_basis_amount::numeric,(f.cost_basis_end-f.cost_basis_start)::numeric) THEN 1 ELSE 0 END ELSE f.amount END":'f.amount'} AS amount FROM filtered f CROSS JOIN LATERAL generate_series(f.date::timestamp,${costs?"COALESCE(f.cost_period_end-1,f.date)::timestamp":'f.date::timestamp'},interval '1 day') d(day)), daily AS (SELECT to_char(date,'YYYY-MM-DD') AS date,COALESCE(sum(amount) FILTER(WHERE kind='income'),0)::float8 AS income,COALESCE(sum(CASE WHEN kind='refund' THEN -amount ELSE amount END) FILTER(WHERE kind IN ('expense','refund')),0)::float8 AS expense FROM daily_entries GROUP BY date) SELECT json_build_object('accountingScope',(SELECT CASE WHEN personal THEN 'personal' ELSE 'consolidated' END FROM personal_scope),'rows',(SELECT COALESCE(json_agg(page),'[]'::json) FROM page),'totals',(SELECT json_build_object('count',count(*),'income',COALESCE(sum(amount) FILTER(WHERE kind='income'),0),'expense',COALESCE(sum(amount) FILTER(WHERE kind='expense'),0),'refund',COALESCE(sum(amount) FILTER(WHERE kind='refund'),0)) FROM filtered),'categories',(SELECT COALESCE(json_agg(categories ORDER BY value DESC),'[]'::json) FROM categories),'daily',(SELECT COALESCE(json_agg(daily ORDER BY date),'[]'::json) FROM daily),'groups',(SELECT COALESCE(json_agg(g),'[]'::json) FROM (SELECT dimension,name,sum(CASE WHEN kind='income' THEN amount ELSE 0 END)::float8 AS income,sum(CASE WHEN kind='expense' THEN amount WHEN kind='refund' THEN -amount ELSE 0 END)::float8 AS expense FROM filtered CROSS JOIN LATERAL (VALUES ('category',category),('payee',payee),('product',product),('account',COALESCE(account_name,'')),('platform',platform)) v(dimension,name) GROUP BY dimension,name ORDER BY dimension,expense DESC,name) g)) AS result`,values);
 const data=result.rows[0].result;
 if(costs){data.basis='period_expense';data.excludedCosts=costs.excluded;data.rows=data.rows.map((r:any)=>({...r,id:r.cost_row_key||r.id}));}
 if(user)data.rows=await attachWalletBalances(user,data.rows);
 return data;
}
export async function report(book:string|string[],params:URLSearchParams,user?:string){return reportResult(reportFilter(book,params),movementReportSource,user,params.get('basis')!=='cashflow');}
export async function personalWalletReport(user:string,params:URLSearchParams){return reportResult(await personalWalletFilter(user,params),personalMovementReportSource,user,false);}
export async function personalExpenseReport(user:string,params:URLSearchParams,bookIds?:string[]){
 const accessible=(await db.query('SELECT book_id FROM members WHERE user_id=$1 ORDER BY book_id',[user])).rows.map(r=>r.book_id as string);
 const selected=bookIds||accessible;if(selected.some(id=>!accessible.includes(id)))throw new Failure('没有此账本的查看权限',403);
 const filter=reportFilter(selected,params);filter.values.push(user);const owner='$'+filter.values.length;
 filter.where+=` AND t.kind<>'transfer' AND (CASE WHEN t.cost_row_key IS NOT NULL THEN t.cost_owner_id=${owner} ELSE a.owner_id=${owner} OR (t.account_id IS NULL AND t.created_by=${owner}) END)`;
 return reportResult(filter,personalMovementReportSource,user,true);
}
export async function exportCSV(book:string|string[],params:URLSearchParams,locale:Language='zh-CN',personalUser?:string){
 const {input,values,where}=personalUser?await personalWalletFilter(personalUser,params):reportFilter(book,params);const source=personalUser?personalMovementReportSource:movementReportSource;const sql=personalUser?`${source}, exported AS (SELECT DISTINCT ON (COALESCE(t.event_id,t.id)) ${projection} FROM ${joins} WHERE ${where} ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id) SELECT *,to_char(exported.date,'YYYY-MM-DD') AS date FROM exported ORDER BY ${detailOrder(input.sort,'exported.amount','exported.id',true,'exported.')}`:`${source} SELECT ${projection},to_char(t.date,'YYYY-MM-DD') AS date FROM ${joins} WHERE ${where} ORDER BY t.date DESC,t.created_at DESC,t.id DESC`;let rows=personalUser&&params.get('scope')!=='personal_expense'?(await db.query(sql,values)).rows:[];
 if(!personalUser||params.get('scope')==='personal_expense'){rows=[];const pageParams=new URLSearchParams(params);pageParams.set('limit','200');for(let offset=0;;offset+=200){pageParams.set('offset',String(offset));const page=params.get('scope')==='personal_expense'&&personalUser?await personalExpenseReport(personalUser,pageParams,Array.isArray(book)?book:undefined):await report(book,pageParams);rows.push(...page.rows);if(offset+200>=page.totals.count)break;}}
 const escape=(v:unknown)=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const lines=[['日期','类型','金额（元）','账户','交易对方','分类','商品摘要','订单号','流水号','备注','记录人','商品明细','转入账户','账目标题'].map(v=>escape(translate(v,locale))).join(',')];
 for(const r of rows)lines.push([r.date,translate(({income:'收入',expense:'支出',refund:'退款到账',transfer:'账户转账'} as Record<string,string>)[r.kind],locale),(r.amount/100).toFixed(2),r.cost_row_key?(locale==='en'?'Allocated cost':'当期分摊'):accountLabel({name:r.account_name,type:r.account_type,holder:r.account_holder,institution:r.account_institution,suffix:r.account_suffix,ownership:r.account_ownership},locale),r.payee,r.category,r.product,r.order_id,r.external_id,r.note,r.creator_name,(r.line_items||[]).map((i:any)=>`${i.name} × ${i.quantity??(locale==='en'?'not specified':'未填写')}：${i.amount===null?translate('待补充',locale):(i.amount/100).toFixed(2)+(' '+deployment().currency)}`).join('；'),r.target_account?accountLabel(r.target_account,locale):r.target_name,r.title||r.payee||r.product].map(escape).join(','));
 return '\ufeff'+lines.join('\r\n');
}
