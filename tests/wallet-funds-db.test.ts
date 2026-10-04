import {test} from 'node:test';
import assert from 'node:assert/strict';
test('隔离数据库：流水去重、权限、家庭往来和助手资金图保持同一口径',{skip:!process.env.FUNDS_TEST_DATABASE_URL},async()=>{
 process.env.DATABASE_URL=process.env.FUNDS_TEST_DATABASE_URL;
 const {db}=await import('../src/server/db');
 try{
  const {accountReport}=await import('../src/server/accounts'),{executeFinanceTool}=await import('../src/server/finance-agent');
  const user=(await db.query("SELECT * FROM users WHERE username='alex.demo'")).rows[0],other=(await db.query("SELECT * FROM users WHERE username='sam.demo'")).rows[0];
  const book=(await db.query("SELECT book_id FROM members WHERE user_id=$1 LIMIT 1",[user.id])).rows[0].book_id,month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,7),p={from:month+'-01',to:month+'-28'};
  const r=await accountReport(user.id,new URLSearchParams(p));assert.equal(r.funds.count,34);assert.equal(r.funds.summary.transferOut,14000);assert.equal(r.funds.summary.transferIn,5700);assert.equal(r.funds.summary.internalTransfer,10000);assert.equal(r.funds.summary.closingBalance,r.summary.netAssets);
  assert.ok(r.accounts.every(a=>a.owner_id===user.id));const incoming=await accountReport(other.id,new URLSearchParams(p));assert.equal(incoming.funds.summary.transferIn,14000);assert.equal(incoming.funds.summary.transferOut,5700);
  await assert.rejects(()=>accountReport(user.id,new URLSearchParams({...p,owner:'00000000-0000-4000-8000-000000000099'})),/家庭成员/);
  const artifacts={charts:[],drafts:[],tools:[]},ctx={book,user,images:[],signal:new AbortController().signal,language:process.env.APP_LANGUAGE==='en'?'en' as const:'zh-CN' as const};
  const output:any=await executeFinanceTool('draw_cashflow',{...p,dimension:'outflows'},ctx,artifacts);assert.equal(output.chart.data.reduce((n:number,d:any)=>n+d.value,0),r.funds.summary.outflow/100);assert.equal(output.chart.data[1].value,140);assert.equal(artifacts.charts.length,1);
  const filtered:any=await executeFinanceTool('account_cashflow',{...p,flow:'transfer'},ctx,artifacts);assert.equal(filtered.data.funds.count,2);assert.equal(filtered.data.funds.summary.outflow,r.funds.summary.outflow);
  const {report,personalWalletReport,exportCSV}=await import('../src/server/reports'),{itemReport}=await import('../src/server/finance-items'),{search}=await import('../src/server/search'),{activityReport}=await import('../src/server/activities');
  const monotone=(rows:any[],field:string,asc:boolean)=>{for(let i=1;i<rows.length;i++)assert.ok(asc?Math.abs(rows[i-1][field])<=Math.abs(rows[i][field]):Math.abs(rows[i-1][field])>=Math.abs(rows[i][field]));};
  for(const sort of ['date_asc','date_desc','amount_asc','amount_desc']){
   const params=new URLSearchParams({...p,sort,limit:'200'}),full=await personalWalletReport(user.id,params);
   const paged=await personalWalletReport(user.id,new URLSearchParams({...p,sort,limit:'20',offset:'20'}));assert.deepEqual(paged.rows.map((x:any)=>x.id),full.rows.slice(20,40).map((x:any)=>x.id));assert.deepEqual(paged.totals,full.totals);
   if(sort.startsWith('amount'))monotone(full.rows,'amount',sort==='amount_asc');else for(let i=1;i<full.rows.length;i++)assert.ok(sort==='date_asc'?full.rows[i-1].date<=full.rows[i].date:full.rows[i-1].date>=full.rows[i].date);
   const funds=await accountReport(user.id,params);assert.deepEqual(funds.funds.summary,r.funds.summary);if(sort.startsWith('amount'))monotone(funds.funds.rows,'amount',sort==='amount_asc');
   const bookReport=await report(book,params,user.id);if(sort.startsWith('amount'))monotone(bookReport.rows,'amount',sort==='amount_asc');
   const activity=(await db.query('SELECT id FROM activities LIMIT 1')).rows[0].id,ar=await activityReport(user.id,activity,new URLSearchParams({...p,sort,limit:'100'}));if(sort.startsWith('amount'))monotone(ar.rows,'amount',sort==='amount_asc');
   const found=await search(user.id,new URLSearchParams({...p,sort,entity:'transaction'}));if(sort.startsWith('amount'))monotone(found.rows,'money',sort==='amount_asc');
  }
  const original=await report(book,new URLSearchParams({...p,limit:'200'}),user.id),target=original.rows.find((x:any)=>x.kind==='expense')!;
  await db.query('UPDATE transactions SET line_items=$2 WHERE id=$1',[target.id,JSON.stringify([{kind:'item',name:'Sort case A',quantity:2,unitPrice:150,amount:300},{kind:'item',name:'Sort case B',quantity:1,unitPrice:800,amount:800}])]);
  for(const metric of ['item_amount','unit_price','quantity'] as const){const items=await itemReport([book],new URLSearchParams({...p,sort:'amount_desc'}),user.id,metric);monotone(items.rows,metric==='item_amount'?'item_amount':metric==='unit_price'?'item_unit_price':'item_quantity',false);assert.equal(items.rows.length,2);}
  const exportText=await exportCSV(book,new URLSearchParams({...p,sort:'amount_desc'}),'zh-CN',user.id);assert.ok(exportText.split('\r\n')[1].includes('12000.00'),'Export follows the selected descending amount order');
 }finally{await db.end();}
});
