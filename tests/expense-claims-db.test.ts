import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {discussionFixtures} from './helpers/discussion-fixtures';
test('消费认领：私账授权、选择账本、资金去重、退款、同步撤回和消息',{skip:!process.env.CLAIM_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.CLAIM_TEST_DATABASE_URL!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname.endsWith('_test'));process.env.DATABASE_URL=url.toString();
 const {db,withConnection}=await import('../src/server/db');const {expenseClaims}=await import('../src/server/expense-claims');const {entry}=await import('../src/server/model');const {insertEntry}=await import('../src/server/ledger');const {syncFinancialFacts}=await import('../src/server/reuse');const {assertClaimEditable}=await import('../src/server/claim-access');const {personalExpenseReport,personalWalletReport,report}=await import('../src/server/reports');const {discussions}=await import('../src/server/discussions');
 const c=await db.connect();try{
  for(const file of ['schema','memory-schema','profile-schema','discussions-schema','expense-claims-schema'])await c.query(await readFile('scripts/'+file+'.sql','utf8'));
  await c.query('BEGIN');await withConnection(c,async()=>{
   const f=await discussionFixtures(c),privateBook=randomUUID(),secondBook=randomUUID();
   for(const id of [privateBook,secondBook]){await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'我的衣柜','private',$2)",[id,f.bob]);await c.query("INSERT INTO members VALUES($1,$2,'owner')",[id,f.bob]);}
   await c.query("UPDATE members SET role='editor' WHERE book_id=$1 AND user_id=$2",[f.book,f.bob]);
   const get=async(user:string,id:string)=>{const d=await expenseClaims(user,'GET',['expense-claims',id],{},new URLSearchParams());assert.ok('claim' in d);return d as any;};
   const act=async(user:string,id:string,operation:string,bookId?:string)=>{const d=await get(user,id);return expenseClaims(user,'POST',['expense-claims',id],{operation,bookId,version:d.claim.version},new URLSearchParams());};
   const inbox=async(user:string)=>{const d=await expenseClaims(user,'GET',['expense-claims','inbox'],{},new URLSearchParams());assert.ok('rows' in d&&d.rows);return {...d,rows:d.rows};};
   const purchase=randomUUID();await insertEntry(c,f.privateBook,f.alice,entry.parse({id:purchase,kind:'expense',amount:50000,date:'2026-10-19',accountId:f.wallet,title:'认领测试衣服',category:'购物',lineItems:[{name:'认领测试衣服',amount:50000,quantity:1}],verificationReason:'测试已确认金额调整',claimRecipientId:f.bob}));
   const claim=(await c.query('SELECT * FROM expense_claims WHERE source_id=$1',[purchase])).rows[0];assert.equal(claim.status,'pending');assert.ok((await inbox(f.bob)).rows.some((r:any)=>r.id===claim.id));
   await assert.rejects(()=>get(f.carol,claim.id),/无权访问/);
   const preview=await get(f.bob,claim.id);assert.equal(preview.source.amount,50000);assert.ok(!preview.books.some((b:any)=>b.id===f.privateBook));assert.equal(preview.claim.source_id,undefined);
   assert.equal((await c.query('SELECT 1 FROM members WHERE book_id=$1 AND user_id=$2',[f.privateBook,f.bob])).rowCount,0);
   await assert.rejects(()=>act(f.bob,claim.id,'accept',f.privateBook),/可编辑/);
   await act(f.bob,claim.id,'accept',privateBook);
   const accepted=await get(f.bob,claim.id),target=accepted.claim.target_id;assert.equal(accepted.targetBookId,privateBook);assert.equal((await get(f.alice,claim.id)).targetBookId,null);assert.equal((await get(f.alice,claim.id)).claim.target_id,null);
   await assert.rejects(()=>assertClaimEditable(c,target,f.bob),/认领设置/);
   const params=()=>new URLSearchParams({from:'2026-10-01',to:'2026-10-31',q:'认领测试衣服',limit:'200'});
   assert.equal((await report(f.privateBook,params(),f.alice)).totals.expense,0,'accepted consumption leaves original book');
   assert.equal((await report(privateBook,params(),f.bob)).totals.expense,50000,'only the chosen destination holds consumption');
   const {search}=await import('../src/server/search');
   assert.equal((await search(f.alice,new URLSearchParams({q:'认领测试衣服',entity:'transaction'}))).total,0,'ordinary search excludes the source payment');
   assert.equal((await search(f.alice,new URLSearchParams({q:'认领测试衣服',entity:'transaction',purpose:'refund'}))).total,1,'payer can still select the original to record a refund');
   const {itemReport}=await import('../src/server/finance-items');
   assert.equal((await itemReport([f.privateBook],params(),f.alice,'item_amount')).totals.expense,0);
   const walletItems=params();walletItems.set('scope','personal_wallet');assert.equal((await itemReport([f.privateBook],walletItems,f.alice,'item_amount')).totals.expense,50000,'wallet item drilldown preserves actual payment');
   await act(f.alice,claim.id,'read');
   const sent=await expenseClaims(f.alice,'GET',['expense-claims','sent'],{},new URLSearchParams());assert.ok('rows' in sent&&sent.rows);assert.ok(sent.rows.some((r:any)=>r.id===claim.id),'read notices do not remove payer history');
   const otherSent=await expenseClaims(f.carol,'GET',['expense-claims','sent'],{},new URLSearchParams());assert.ok('rows' in otherSent&&otherSent.rows);assert.equal(otherSent.rows.length,0);
   const both=await report([f.privateBook,privateBook],params(),f.alice);assert.equal(both.totals.count,1);assert.equal(both.totals.expense,50000);
   assert.equal((await personalWalletReport(f.alice,params())).totals.expense,50000);assert.equal((await personalWalletReport(f.bob,params())).totals.expense,0);
   assert.equal((await personalExpenseReport(f.bob,params())).totals.expense,50000);assert.equal((await personalExpenseReport(f.alice,params())).totals.expense,0);
   const e=entry.parse({id:purchase,kind:'expense',amount:45000,date:'2026-10-18',accountId:f.wallet,category:'购物'});await syncFinancialFacts(c,f.privateBook,e,f.alice);await c.query("UPDATE transactions SET amount=45000,date='2026-10-18',version=version+1 WHERE id=$1",[purchase]);
   const updated=(await c.query('SELECT amount::float8 AS amount,date FROM transactions WHERE id=$1',[target])).rows[0];assert.equal(updated.amount,45000);assert.equal((await get(f.bob,claim.id)).source.amount,45000);assert.ok((await inbox(f.bob)).rows.some((r:any)=>r.event==='source_changed'));
   const refund=randomUUID();await insertEntry(c,f.privateBook,f.alice,entry.parse({id:refund,kind:'refund',amount:5000,date:'2026-10-19',accountId:f.wallet,refundOf:purchase,title:'认领测试衣服退款',category:'购物'}));
   const refunds=(await c.query("SELECT * FROM transactions WHERE book_id=$1 AND kind='refund' AND NOT deleted",[privateBook])).rows;assert.equal(refunds.length,1);assert.equal(refunds[0].refund_of,target);
   const originalRefunds=await report(f.privateBook,params(),f.alice);assert.equal(originalRefunds.totals.expense,0);assert.equal(originalRefunds.totals.refund,0);
   const personal=await personalExpenseReport(f.bob,params());assert.equal(personal.totals.expense,45000);assert.equal(personal.totals.refund,5000);
   await act(f.bob,claim.id,'accept',f.book);assert.equal((await get(f.bob,claim.id)).targetBookId,f.book);assert.equal((await report(privateBook,params(),f.bob)).totals.count,0);assert.equal((await report(f.book,params(),f.bob)).totals.expense,45000);assert.ok((await c.query('SELECT deleted FROM transactions WHERE id=$1',[target])).rows[0].deleted);
   await act(f.bob,claim.id,'accept',secondBook);assert.equal((await get(f.bob,claim.id)).targetBookId,secondBook);
   const shared=(await c.query('SELECT id,deleted FROM transactions WHERE book_id=$1 AND event_id=$2',[f.book,claim.event_id])).rows[0];assert.ok(shared.deleted,'only claim-created copies are removed on moving');
   await discussions(f.bob,'POST',['discussions','messages'],{target:{kind:'claim',id:claim.id},id:randomUUID(),body:'衣服已认领，谢谢！'},new URLSearchParams());
   const thread=await discussions(f.alice,'GET',['discussions'],{},new URLSearchParams({kind:'claim',id:claim.id}));assert.ok('rows' in thread);assert.equal(thread.rows[0].body,'衣服已认领，谢谢！');
   await assert.rejects(()=>discussions(f.carol,'GET',['discussions'],{},new URLSearchParams({kind:'claim',id:claim.id})),/无权访问/);
   const current=(await get(f.bob,claim.id)).claim.target_id;await act(f.alice,claim.id,'withdraw');assert.equal((await get(f.bob,claim.id)).claim.status,'withdrawn');assert.ok((await c.query('SELECT deleted FROM transactions WHERE id=$1',[current])).rows[0].deleted);
   assert.equal((await report(f.privateBook,params(),f.alice)).totals.expense,45000,'withdrawing restores consumption to the original book');
   await c.query("UPDATE transactions SET title='撤回后的私密修改',amount=49000 WHERE id=$1",[purchase]);assert.notEqual((await get(f.bob,claim.id)).source.title,'撤回后的私密修改');
   const reinvite=await expenseClaims(f.alice,'POST',['expense-claims','invite'],{sourceId:purchase,recipientId:f.bob},new URLSearchParams());assert.ok('id' in reinvite);await act(f.bob,reinvite.id!,'accept',privateBook);
   const next=(await get(f.bob,reinvite.id!)).claim.target_id;assert.equal(next,target);assert.equal((await get(f.bob,reinvite.id!)).source.amount,49000);
   await c.query('UPDATE transactions SET deleted=true WHERE id=$1',[purchase]);assert.equal((await get(f.bob,reinvite.id!)).claim.status,'withdrawn');assert.ok((await c.query('SELECT deleted FROM transactions WHERE id=$1',[next])).rows[0].deleted);
   // Picking an already-present public copy never removes that pre-existing record on cancellation.
   const another=randomUUID();await insertEntry(c,f.book,f.alice,entry.parse({id:another,kind:'expense',amount:1000,date:'2026-10-19',accountId:f.wallet,title:'共享原账',category:'购物',claimRecipientId:f.bob}));
   const publicClaim=(await c.query('SELECT id FROM expense_claims WHERE source_id=$1',[another])).rows[0].id;await act(f.bob,publicClaim,'accept',f.book);await act(f.bob,publicClaim,'cancel');assert.equal((await c.query('SELECT deleted FROM transactions WHERE id=$1',[another])).rows[0].deleted,false);
   const {reuseInTransaction}=await import('../src/server/reuse');
   const existing=randomUUID();await insertEntry(c,f.privateBook,f.alice,entry.parse({id:existing,kind:'expense',amount:2000,date:'2026-10-19',accountId:f.wallet,title:'已经在公账的关联',category:'购物'}));let original=(await c.query('SELECT version FROM transactions WHERE id=$1',[existing])).rows[0];const reused=await reuseInTransaction(c,f.privateBook,f.alice,existing,original.version,f.book,[],false);const reuseInvite=await expenseClaims(f.alice,'POST',['expense-claims','invite'],{sourceId:existing,recipientId:f.bob},new URLSearchParams());assert.ok('id' in reuseInvite);await act(f.bob,reuseInvite.id!,'accept',f.book);await act(f.alice,reuseInvite.id!,'withdraw');assert.equal((await c.query('SELECT deleted FROM transactions WHERE id=$1',[reused.id])).rows[0].deleted,false);
   const pending=randomUUID();await insertEntry(c,f.privateBook,f.alice,entry.parse({id:pending,kind:'expense',amount:1000,date:'2026-10-19',accountId:f.wallet,title:'已有账单',category:'购物'}));const invited=await expenseClaims(f.alice,'POST',['expense-claims','invite'],{sourceId:pending,recipientId:f.bob},new URLSearchParams());assert.ok('id' in invited);await act(f.bob,invited.id!,'decline');assert.equal((await get(f.alice,invited.id!)).claim.status,'declined');
   const again=await expenseClaims(f.alice,'POST',['expense-claims','invite'],{sourceId:pending,recipientId:f.bob},new URLSearchParams());assert.ok('id' in again);await act(f.bob,again.id!,'accept',privateBook);const departureTarget=(await get(f.bob,again.id!)).claim.target_id;await c.query('DELETE FROM family_members WHERE family_id=$1 AND user_id=$2',[f.family,f.bob]);assert.equal((await get(f.bob,again.id!)).claim.status,'withdrawn');assert.ok((await c.query('SELECT deleted FROM transactions WHERE id=$1',[departureTarget])).rows[0].deleted);assert.ok((await inbox(f.bob)).rows.some((r:any)=>r.event==='membership_removed'));
  });
 }finally{await c.query('ROLLBACK');c.release();await db.end();}
});
