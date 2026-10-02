import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {executeFinanceTool,type AgentArtifact} from '../src/server/finance-agent';
import {report} from '../src/server/reports';
import {itemReport} from '../src/server/finance-items';
import {chartDetailParams} from '../src/lib/finance-query';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_query_test');
const user=randomUUID(),other=randomUUID(),book=randomUUID(),copyBook=randomUUID(),wallet=randomUUID(),otherWallet=randomUUID();
const artifacts:AgentArtifact={drafts:[],charts:[],tools:[]};
const ctx={user:{id:user,username:'test',name:'测试',admin:false,avatar:'',theme:'bear' as const},book,analysisBooks:[book,copyBook],images:[],signal:new AbortController().signal};
const range={from:'2026-09-01',to:'2026-09-30'};
async function call(name:string,args:unknown){const result=await executeFinanceTool(name,args,ctx,artifacts);artifacts.tools.push({name,label:name,args,result});return result as any;}
try{
 for(const id of [user,other])await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'查询测试','unused')",[id]);
 for(const id of [book,copyBook]){await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'查询测试账本','private',$2)",[id,user]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[id,user]);}
 for(const [id,owner] of [[wallet,user],[otherWallet,other]])await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership) VALUES($1,'微信','wechat',$2,'personal')",[id,owner]);
 const event=randomUUID();const items=[{name:'奶茶',kind:'item',quantity:2,unitPrice:1000,amount:2000},{name:'咖啡',kind:'item',quantity:1,unitPrice:500,amount:500},{name:'优惠',kind:'discount',quantity:null,unitPrice:null,amount:-200}];
 async function entry(amount:number,category:string,date:string,lineItems:any[],opts:{id?:string;event?:string;book?:string;account?:string;kind?:string}={}){const id=opts.id||randomUUID();await db.query("INSERT INTO transactions(id,event_id,book_id,account_id,created_by,kind,amount,date,title,payee,category,line_items,order_id,platform) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'测试订单','茶店',$9,$10,$11,'微信')",[id,opts.event||id,opts.book||book,opts.account||wallet,user,opts.kind||'expense',amount,date,category,JSON.stringify(lineItems),id]);return id;}
 await entry(2300,'奶茶咖啡','2026-09-22',items,{id:event});await entry(2300,'奶茶咖啡','2026-09-22',items,{book:copyBook,event});
 await entry(145961,'购物','2026-09-22',[]);await entry(1500,'奶茶咖啡','2026-09-23',[{name:'奶茶',kind:'item',quantity:1,unitPrice:1500,amount:1500}]);
 await entry(1000,'奶茶咖啡','2026-09-24',[{name:'奶茶',kind:'item',quantity:null,unitPrice:null,amount:null}]);
 await entry(900,'奶茶咖啡','2026-09-25',[],{account:otherWallet});await entry(10000,'工资','2026-09-22',[],{kind:'income'});
 const filtered=await call('find_transactions',{...range,category:'奶茶咖啡',limit:2});assert.equal(Number(filtered.totals.expense),5700);assert.equal(filtered.total,4);assert.equal(filtered.hasMore,true);assert.equal(filtered.nextOffset,2);
 const chart=await call('draw_chart',{...range,queryId:filtered.queryId,type:'bar',dimension:'daily_expense',title:'奶茶趋势'});assert.equal(chart.data.find((d:any)=>d.name==='2026-09-22').value,23);assert.equal(chart.data.reduce((n:number,d:any)=>n+d.value,0),57);
 const drill=await report(ctx.analysisBooks,chartDetailParams(chart,'2026-09-22',0,20),user);assert.equal(Number(drill.totals.expense),2300);assert.equal(drill.rows.length,1);
 const inherited=await call('draw_chart',{...range,type:'bar',dimension:'daily_expense',title:'再次绘图'});assert.equal(inherited.filters.category,'奶茶咖啡');assert.equal(inherited.data.find((d:any)=>d.name==='2026-09-22').value,23);
 console.log('PASS 1: filtered totals, cross-book deduplication, chart and drilldown agree');
 const prices=await call('analyze_items',{...range,product:'奶茶',metric:'unit_price'});assert.equal(prices.total,3);assert.equal(Number(prices.totals.value),3500/3);assert.equal(prices.totals.unknownPrices,1);
 const priceChart=await call('draw_chart',{...range,queryId:prices.queryId,type:'line',dimension:'daily_expense',title:'奶茶单价'});assert.equal(priceChart.metric,'unit_price');assert.equal(priceChart.data.find((d:any)=>d.name==='2026-09-22').value,10);assert.ok(!priceChart.data.some((d:any)=>d.name==='2026-09-24'));
 const priceDrill=await itemReport(ctx.analysisBooks,chartDetailParams({...priceChart,dimension:'product'},'奶茶',0,20),user,'unit_price');assert.equal(Number(priceDrill.totals.value),3500/3);assert.ok(priceDrill.rows.every((r:any)=>r.item_name==='奶茶'));
 console.log('PASS 2: quantity-weighted prices use only matching item evidence; missing prices stay unknown');
 const subtotals=await call('analyze_items',{...range,product:'奶茶',metric:'item_amount'});assert.equal(Number(subtotals.totals.value),3500);assert.equal(subtotals.totals.unknownAmounts,1);assert.equal(Number(subtotals.totals.quantity),3);
 console.log('PASS 3: discounts and other products excluded; quantity and item subtotal are not order payment');
 const own=await call('financial_summary',{...range,category:'奶茶咖啡',scope:'personal_wallet'});assert.equal(Number(own.totals.expense),4800);assert.equal(own.filters.basis,'cashflow');
 const income=await call('draw_chart',{...range,metric:'income',type:'bar',dimension:'category',title:'工资收入'});assert.equal(income.data.find((d:any)=>d.name==='工资').value,100);
 console.log('PASS 4: personal wallets exclude other members; grouped income uses income not spending');
 const next=await call('find_transactions',{...range,queryId:filtered.queryId,offset:2,limit:2});assert.equal(next.hasMore,false);assert.equal(next.total,4);assert.equal(Number(next.totals.expense),5700);
 await assert.rejects(()=>call('draw_chart',{...range,queryId:'missing',type:'bar',dimension:'daily_expense',title:'错误引用'}));
 console.log('PASS 5: pagination retains complete totals; invalid query references cannot silently broaden scope');
 if(process.env.TEST_BROWSER==='1'){const token=randomUUID(),conversation=randomUUID();await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,user]);await db.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'查询验收')",[conversation,book,user]);await db.query("INSERT INTO finance_turns(id,conversation_id,question,answer,artifacts,status) VALUES($1,$2,'奶茶支出和商品单价','[[chart:'||$3||']]\n[[chart:'||$4||']]',$5,'complete')",[randomUUID(),conversation,chart.id,priceChart.id,JSON.stringify(artifacts)]);console.log(JSON.stringify({token,conversation,book}));}
}finally{await db.end();}
