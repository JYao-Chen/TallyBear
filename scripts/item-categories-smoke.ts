import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,transaction} from '../src/server/db';
import {insertEntry} from '../src/server/ledger';
import {entry} from '../src/server/model';
import {report,exportCSV,personalExpenseReport,personalWalletReport} from '../src/server/reports';
import {categoryAmounts} from '../src/lib/item-categories';
import {categoryPartsSql} from '../src/server/item-category-sql';
import {renameCategoryRecords} from '../src/server/category-rename';
import {executeFinanceTool,type AgentArtifact} from '../src/server/finance-agent';
import {accountReport} from '../src/server/accounts';
import {activityReport} from '../src/server/activities';
import {itemReport} from '../src/server/finance-items';
import {parseAction} from '../src/server/chat-actions';
import {applyTransactionChange,transactionEntry,transactionForAction} from '../src/server/transaction-changes';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_items_test');
const user=randomUUID(),book=randomUUID(),wallet=randomUUID(),id=randomUUID();
const items=[{name:'青菜',amount:3000,category:'蔬菜'},{name:'面粉',amount:2000,category:'米面粮油'},{name:'衣服',amount:10000,category:'服饰'},{name:'满减',kind:'discount' as const,amount:-1000}];
const draft=entry.parse({id,accountId:wallet,kind:'expense',amount:14000,date:'2026-10-31',payee:'测试超市',category:'购物',title:'一张超市小票',lineItems:items});
const range={from:'2026-10-01',to:'2026-10-31'};
const params=(categories:string[]=[])=>{const p=new URLSearchParams(range);for(const c of categories)p.append('category',c);return p;};
try{
 await db.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'分项测试','not-a-login')",[user]);
 await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'分项测试','private',$2)",[book,user]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,user]);
 await db.query("INSERT INTO accounts(id,name,type,owner_id,ownership,opening) VALUES($1,'测试钱包','cash',$2,'personal',100000)",[wallet,user]);
 await transaction(c=>insertEntry(c,book,user,draft));
 const all=await report(book,params(),user),expected=categoryAmounts(draft.lineItems,14000,'购物');assert.equal(all.totals.expense,14000);assert.equal(all.totals.count,1);assert.deepEqual(all.categories.map((p:any)=>({category:p.name,amount:p.value})).sort((a:any,b:any)=>a.category<b.category?-1:1),expected);assert.equal(all.daily.reduce((n:number,d:any)=>n+d.expense,0),14000);
 const assets=await accountReport(user,new URLSearchParams(range));assert.equal(assets.categories.reduce((n:number,p:any)=>n+p.value,0),14000);assert.equal(assets.categories.length,3);
 const selected=['蔬菜','米面粮油'],share=expected.filter(p=>selected.includes(p.category)).reduce((n,p)=>n+p.amount,0);
 const filtered=await report(book,params(selected),user);assert.equal(filtered.totals.expense,share);assert.equal(filtered.totals.count,1);assert.equal(filtered.rows[0].amount,14000);assert.equal(filtered.rows[0].matched_amount,share);assert.equal(filtered.categories.length,2);assert.equal(filtered.daily[0].expense,share);
 const drill=params(selected);drill.set('groupField','category');drill.set('groupValue','服饰');assert.equal((await report(book,drill,user)).totals.count,0);drill.set('groupValue','蔬菜');assert.equal((await report(book,drill,user)).totals.expense,expected.find(p=>p.category==='蔬菜')!.amount);
 assert.equal((await personalExpenseReport(user,params(selected),[book])).totals.expense,share);assert.equal((await personalWalletReport(user,params(selected))).totals.expense,share);
 const csv=await exportCSV(book,params(selected));assert.ok(csv.includes((share/100).toFixed(2)));assert.ok(csv.includes('140.00'));assert.ok(csv.includes('分类计入金额'));
 const walletTotal=await db.query('SELECT sum(amount)::int AS total,count(*)::int AS count FROM transactions WHERE account_id=$1 AND NOT deleted',[wallet]);assert.deepEqual(walletTotal.rows[0],{total:14000,count:1});
 // The exact database and browser arithmetic agree for fractional-cent discounts and large amounts.
 for(const amount of [1,7,14000,99999999999]){const result=await db.query(`SELECT ${categoryPartsSql()} AS parts FROM (SELECT $1::bigint AS amount,'购物'::text AS category,$2::jsonb AS line_items) t`,[amount,JSON.stringify(draft.lineItems)]);assert.deepEqual(result.rows[0].parts,categoryAmounts(draft.lineItems,amount,'购物'));}
 const refund=randomUUID();await transaction(c=>insertEntry(c,book,user,entry.parse({id:refund,accountId:wallet,kind:'refund',amount:14000,date:'2026-10-31',category:'购物',refundOf:id})));
 const refunded=await report(book,params(),user);assert.equal(refunded.totals.expense-refunded.totals.refund,0);assert.ok(refunded.categories.every((p:any)=>p.value===0),'A full linked refund reverses each category');await db.query('UPDATE transactions SET deleted=true WHERE id=$1',[refund]);
 const partial=randomUUID();await transaction(c=>insertEntry(c,book,user,entry.parse({id:partial,accountId:wallet,kind:'refund',amount:1400,date:'2026-10-31',category:'购物',refundOf:id,lineItems:[{name:'衣服退款',amount:1400,category:'服饰'}]})));
 const partialReport=await report(book,params(['服饰']),user);assert.equal(partialReport.totals.refund,1400);assert.equal(partialReport.totals.expense,expected.find(p=>p.category==='服饰')!.amount);await db.query("INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,'2026-10-01',1,'2026-10-01','day',31)",[id]);const allocatedRefund=await report(book,params(),user);assert.equal(allocatedRefund.categories.find((p:any)=>p.name==='服饰').value,expected.find(p=>p.category==='服饰')!.amount-1400);assert.equal(allocatedRefund.categories.find((p:any)=>p.name==='蔬菜').value,expected.find(p=>p.category==='蔬菜')!.amount);await db.query('DELETE FROM expense_allocations WHERE transaction_id=$1',[id]);await db.query('UPDATE transactions SET deleted=true WHERE id=$1',[partial]);
 // Item analytics and activity reports use the same category labels and matching shares.
 const byItem=await itemReport([book],params(['蔬菜']),user,'item_amount','category');assert.equal(byItem.totals.count,1);assert.equal(byItem.rows[0].item_category,'蔬菜');
 const activity=randomUUID();await db.query("INSERT INTO activities(id,owner_id,name) VALUES($1,$2,'超市活动')",[activity,user]);await db.query('INSERT INTO activity_entries(transaction_id,owner_id,activity_id) VALUES($1,$2,$3)',[id,user,activity]);assert.equal((await activityReport(user,activity,new URLSearchParams({category:'蔬菜'}))).totals.expense,expected.find(p=>p.category==='蔬菜')!.amount);
 // Legacy cost allocation must retain categories and exact daily rounding when drilling down.
 await db.query("INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,'2026-10-01',1,'2026-10-01','day',31)",[id]);
 const period=await report(book,params(selected),user);assert.equal(period.totals.expense,share);assert.equal(period.daily.reduce((n:number,d:any)=>n+d.expense,0),share);
 for(const day of period.daily){const p=params(selected);p.set('from',day.date);p.set('to',day.date);assert.equal((await report(book,p,user)).totals.expense,day.expense,'Day drilldown retains category cents');}
 await db.query('DELETE FROM expense_allocations WHERE transaction_id=$1',[id]);
 const artifacts:AgentArtifact={drafts:[],charts:[],tools:[]};const ctx={user:{id:user,username:'test',name:'测试',admin:false,avatar:'',theme:'bear' as const},book,analysisBooks:[book],images:[],signal:new AbortController().signal,useHistory:false};
 await executeFinanceTool('prepare_action',{kind:'entry',bookId:book,data:{...draft,id:undefined}},ctx,artifacts);const action=artifacts.actions![0];assert.deepEqual(action.missing,[]);assert.equal((parseAction(action) as any).lineItems[0].category,'蔬菜');assert.equal((await db.query('SELECT count(*)::int AS count FROM transactions WHERE book_id=$1 AND NOT deleted',[book])).rows[0].count,1,'AI only prepares a confirmation card');
 await executeFinanceTool('prepare_transaction_change',{operation:'update',bookId:book,transactionId:id,changes:{lineItems:draft.lineItems}},ctx,artifacts);assert.equal(artifacts.actions!.length,2);assert.equal((parseAction(artifacts.actions![1]) as any).value.lineItems[0].category,'蔬菜');
 // Rename only matching current item categories, preserving the other classifications.
 await transaction(c=>renameCategoryRecords(c,[book],'蔬菜','买菜'));
 let row=await transaction(c=>transactionForAction(c,book,id));assert.equal(row.lineItems[0].category,'买菜');assert.equal(row.lineItems[2].category,'服饰');
 // A single edit switches back to whole-order classification without creating a second payment.
 const value=transactionEntry(row,{category:'零食',lineItems:row.lineItems.map(({category,...i}:any)=>i)});
 await transaction(c=>applyTransactionChange(c,book,user,{operation:'update',transactionId:id,version:row.version,value}));
 const unified=await report(book,params(),user);assert.deepEqual(unified.categories,[{name:'零食',value:14000}]);assert.equal(unified.totals.count,1);assert.equal((await report(book,params(['服饰']),user)).totals.count,0);
 console.log('PASS: one wallet debit, category shares/discount cents, filtering/drilldown/export/personal scopes, assistant card, rename, uniform reclassification.');
}finally{await db.query('DELETE FROM chat_actions WHERE user_id=$1',[user]).catch(()=>{});await db.end();}
