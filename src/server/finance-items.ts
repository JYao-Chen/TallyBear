import {detailOrder} from '@/lib/detail-sort';
import {reportFilter} from './reports';
import {movementReportSource,personalMovementReportSource} from './movement-report';
import {db} from './db';
import {textMatch} from './search-match';
import type {FinanceMetric,FinanceDimension} from '@/lib/finance-query';

// Item costs are recorded line totals, not apportioned order payments. Unknowns stay unknown.
export async function itemReport(books:string[],params:URLSearchParams,user:string,metric:FinanceMetric,dimension:FinanceDimension='product'){
 const itemGroup=params.get('groupField')==='product';const orderParams=new URLSearchParams(params);if(itemGroup){orderParams.delete('groupField');orderParams.delete('groupValue');}
 const {input,values,where:base}=reportFilter(books,orderParams);let where=base+" AND t.kind IN ('expense','refund')";
 const personal=params.get('scope')==='personal_wallet';if(personal){values.push(user);where+=` AND a.owner_id=$${values.length}`;}
 let itemWhere="COALESCE(i->>'kind','item')='item'";
 if(input.product){values.push(input.product);itemWhere+=' AND '+textMatch("ARRAY[i->>'name']",'$'+values.length,input.mode);}
 const groupValue=params.get('groupValue');if(itemGroup){values.push(groupValue||'');itemWhere+=` AND COALESCE(i->>'name','')=$${values.length}`;}
 const group=dimension==='category'?'category':dimension==='payee'?'payee':dimension==='account'?'account_name':dimension==='platform'?'platform':dimension==='product'?'item_name':dimension.startsWith('monthly_')?"to_char(date,'YYYY-MM')":dimension.startsWith('weekly_')?"to_char(date_trunc('week',date),'YYYY-MM-DD')":"to_char(date,'YYYY-MM-DD')";
 const value=metric==='quantity'?'sum(signed_quantity)':metric==='unit_price'?'sum(unit_price*quantity) FILTER(WHERE unit_price IS NOT NULL AND quantity>0)/NULLIF(sum(quantity) FILTER(WHERE unit_price IS NOT NULL AND quantity>0),0)':'sum(signed_amount)';
 values.push(input.limit,input.offset);
 const source=personal?personalMovementReportSource:movementReportSource;
 const sql=`${source}, selected AS MATERIALIZED (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.*,a.name AS account_name,b.name AS book_name FROM ledger_source t JOIN books b ON b.id=t.book_id LEFT JOIN accounts a ON a.id=t.account_id WHERE ${where} ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id), items AS MATERIALIZED (
 SELECT t.*,t.id::text||':'||ordinality AS item_key,i->>'name' AS item_name,CASE WHEN t.kind='refund' THEN -1 ELSE 1 END * NULLIF(i->>'amount','')::numeric AS signed_amount,NULLIF(i->>'quantity','')::numeric AS quantity,CASE WHEN t.kind='refund' THEN -1 ELSE 1 END * NULLIF(i->>'quantity','')::numeric AS signed_quantity,COALESCE(NULLIF(i->>'unitPrice','')::numeric,NULLIF(i->>'amount','')::numeric/NULLIF(NULLIF(i->>'quantity','')::numeric,0)) AS unit_price
 FROM selected t CROSS JOIN LATERAL jsonb_array_elements(t.line_items) WITH ORDINALITY line(i,ordinality) WHERE ${itemWhere}
 ), grouped AS (SELECT COALESCE(${group},'') AS name,(${value})::float8 AS value FROM items GROUP BY 1), page AS (SELECT *,signed_amount::float8 AS item_amount,quantity::float8 AS item_quantity,unit_price::float8 AS item_unit_price FROM items ORDER BY ${detailOrder(input.sort,metric==='quantity'?'quantity':metric==='unit_price'?'unit_price':'signed_amount','item_key')} LIMIT $${values.length-1} OFFSET $${values.length}) SELECT json_build_object('rows',(SELECT COALESCE(json_agg(page),'[]') FROM page),'data',(SELECT COALESCE(json_agg(grouped ORDER BY name),'[]') FROM grouped),'totals',(SELECT json_build_object('count',count(*),'orders',count(DISTINCT COALESCE(event_id,id)),'expense',COALESCE(sum(signed_amount) FILTER(WHERE kind='expense'),0),'refund',COALESCE(-sum(signed_amount) FILTER(WHERE kind='refund'),0),'income',0,'quantity',sum(signed_quantity),'value',${value},'unknownAmounts',count(*) FILTER(WHERE signed_amount IS NULL),'unknownQuantities',count(*) FILTER(WHERE quantity IS NULL),'unknownPrices',count(*) FILTER(WHERE unit_price IS NULL)) FROM items)) AS result`;
 const data=(await db.query(sql,values)).rows[0].result;
 return {...data,basis:'cashflow',metric,amountUnit:'minor',note:'Item amounts exclude order-level discounts and fees unless already reflected in item totals. Missing values are excluded, not treated as zero. Unit price is quantity-weighted recorded line price, not effective paid price.',data:data.data.filter((d:any)=>d.value!==null).map((d:any)=>({...d,value:metric==='quantity'?d.value:d.value/100}))};
}
