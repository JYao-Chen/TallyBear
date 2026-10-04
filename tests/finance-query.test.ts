import {test} from 'node:test';
import assert from 'node:assert/strict';
import {financeQuerySchema,financeQueryParams,chartDetailParams} from '../src/lib/finance-query';
import {financeChartData} from '../src/lib/finance-chart-data';
import {reportFilter} from '../src/server/reports';
const from='2026-09-01',to='2026-09-30';
test('个人当期费用是独立口径，图表保留本人范围和所选账本',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 const filters=financeQuerySchema.parse({from,to,scope:'personal_expense',bookIds:[id],category:'服务器'});
 const p=chartDetailParams({from,to,filters,dimension:'daily_expense'},'2026-09-22',0,20);
 assert.equal(p.get('scope'),'personal_expense');assert.equal(p.get('basis'),'period_expense');assert.deepEqual(p.getAll('book'),[id]);assert.equal(p.get('category'),'服务器');
});
test('图表明细只收窄类型，不把仅支出筛选扩成含退款，也不把收入筛选扩成支出',()=>{
 for(const kind of ['expense','refund'] as const){const filters=financeQuerySchema.parse({from,to,kind});assert.equal(chartDetailParams({from,to,filters,dimension:'category'},'餐饮',0,20).get('kind'),kind);}
 const filters=financeQuerySchema.parse({from,to,kind:'income'});const p=chartDetailParams({from,to,filters,dimension:'daily_expense'},from,0,20);assert.equal(p.get('kind'),'none');assert.ok(reportFilter('book',p).values.includes('none'));
});
test('完整查询条件与图表明细保持一致，不丢分类、商品、钱包及口径',()=>{
 const filters=financeQuerySchema.parse({from,to,category:'奶茶咖啡',product:'奶茶',payee:'茶店',platform:'微信',query:'大杯',accountId:'00000000-0000-4000-8000-000000000001',basis:'cashflow',min:100,max:10000});
 const p=chartDetailParams({from,to,filters,dimension:'daily_expense',metric:'unit_price',books:['book']},'2026-09-22',20,20);
 for(const [k,v] of financeQueryParams(filters))if(!['from','to','kind','offset','limit'].includes(k))assert.equal(p.get(k),v,k);
 assert.equal(p.get('from'),'2026-09-22');assert.equal(p.get('to'),'2026-09-22');assert.equal(p.get('metric'),'unit_price');assert.equal(p.get('offset'),'20');
 const group=chartDetailParams({from,to,filters,dimension:'product'},'大杯奶茶',0,20);assert.equal(group.get('product'),'奶茶');assert.equal(group.get('groupValue'),'大杯奶茶');
});
test('周、月明细区间裁剪到原查询范围',()=>{
 const weekly=chartDetailParams({from,to,dimension:'weekly_expense'},'2026-08-31',0,20);assert.equal(weekly.get('from'),from);assert.equal(weekly.get('to'),'2026-09-06');
 const monthly=chartDetailParams({from:'2026-09-15',to,dimension:'monthly_income'},'2026-09',0,20);assert.equal(monthly.get('from'),'2026-09-15');assert.equal(monthly.get('to'),to);assert.equal(monthly.get('kind'),'income');
});
test('自然周按周一归集，金额只转换一次，不混入收入',()=>{
 const points=financeChartData({categories:[],daily:[{date:'2026-09-06',expense:2300,income:10000},{date:'2026-09-07',expense:1800,income:0}]},'weekly_expense',from,'2026-09-07');assert.deepEqual(points,[{name:'2026-08-31',value:23},{name:'2026-09-07',value:18}]);
});
test('多字段筛选金额边界与合法日期校验',()=>{
 assert.throws(()=>financeQuerySchema.parse({from:'2026-02-30',to}));assert.throws(()=>financeQuerySchema.parse({from,to,min:500,max:100}));
 const f=reportFilter('book',new URLSearchParams({from,to,payee:'店铺',product:'奶茶',orderId:'order',externalId:'payment',min:'100',max:'500'}));assert.ok(f.where.includes('t.order_id'));assert.ok(f.where.includes('t.external_id'));assert.ok(f.where.includes('jsonb_array_elements'));assert.ok(f.values.includes('奶茶'));
});
