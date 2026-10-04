import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detailOrder,detailSort,sortDetails} from '../src/lib/detail-sort';
import {fundRowsPage,type FundRow} from '../src/lib/wallet-funds';
import {reportFilter} from '../src/server/reports';
import {financeQuerySchema,financeQueryParams} from '../src/lib/finance-query';
import {parseSearch} from '../src/server/search';
test('四种排序统一传入查询，非法请求不进入 SQL',()=>{
 const range={from:'2026-10-01',to:'2026-10-31'};
 for(const sort of ['date_desc','date_asc','amount_desc','amount_asc']){
  assert.equal(reportFilter('book',new URLSearchParams({...range,sort})).input.sort,sort);
  assert.equal(financeQueryParams(financeQuerySchema.parse({...range,sort})).get('sort'),sort);
  assert.equal(parseSearch(new URLSearchParams({sort})).sort,sort);
 }
 assert.throws(()=>reportFilter('book',new URLSearchParams({...range,sort:'amount;drop'})));
 assert.equal(detailSort('invalid'),'date_desc');
 assert.match(detailOrder('amount_asc'),/^abs\(amount\) ASC NULLS LAST/);
 assert.match(detailOrder('date_asc'),/date ASC.*occurred_at.*created_at ASC/);
});
test('金额按数额排序，未知放最后；同日按交易时刻而非录入先后',()=>{
 const rows=[{id:'a',date:'2026-10-01',time:'12:00:00',amount:-900},{id:'b',date:'2026-10-01',time:'08:00:00',amount:100},{id:'c',date:'2026-10-02',amount:null}];
 assert.deepEqual(sortDetails(rows,'amount_desc',r=>r).map(r=>r.id),['a','b','c']);
 assert.deepEqual(sortDetails(rows,'amount_asc',r=>r).map(r=>r.id),['b','a','c']);
 assert.deepEqual(sortDetails(rows,'date_asc',r=>r).map(r=>r.id),['b','a','c']);
 assert.deepEqual(sortDetails(rows,'date_desc',r=>r).map(r=>r.id),['c','a','b']);
});
test('资金明细先排序全部匹配结果再分页，不改变输入、汇总或余额',()=>{
 const rows=Array.from({length:25},(_,i)=>({id:String(i).padStart(2,'0'),date:'2026-10-01',amount:(i+1)*100,kind:'expense',title:'购买',note:'',counterparty:'',sourceName:'微信',targetName:'',sourceId:'wallet',targetId:null,origin:'transaction',inflow:0,outflow:(i+1)*100,delta:-(i+1)*100,internal:false})) as FundRow[];
 const original=structuredClone(rows),params=new URLSearchParams({sort:'amount_desc'});
 const first=fundRowsPage(rows,params);assert.equal(first.rows[0].amount,2500);assert.equal(first.rows.at(-1)?.amount,600);assert.equal(first.count,25);
 params.set('offset','20');const second=fundRowsPage(rows,params);assert.equal(second.rows[0].amount,500);assert.equal(second.rows.at(-1)?.amount,100);
 assert.deepEqual(rows,original);
});
