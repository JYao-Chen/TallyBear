import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,transaction} from '../src/server/db';
import {createAccount,listAssets,listAccounts,accountReport,changeAccount,validateActiveAccounts} from '../src/server/accounts';
import {entry} from '../src/server/model';
import {insertEntry} from '../src/server/ledger';
import {reuse,syncFinancialFacts} from '../src/server/reuse';
import {moveEntry,movePreview} from '../src/server/move-entry';
import {search,searchOptions} from '../src/server/search';
import {schedules} from '../src/server/schedules';
import {templates} from '../src/server/templates';
const ids=Array.from({length:6},()=>randomUUID());const [alice,bob,outsider,book,other,family]=ids;
const tx=randomUUID(),cashTx=randomUUID();
try{
 for(const id of [alice,bob,outsider])await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$4,$2,$3)',[id,'asset-test','unused',id]);
 for(const id of [book,other]){await db.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'asset test','shared',$2)",[id,alice]);for(const u of [alice,bob])await db.query("INSERT INTO members VALUES($1,$2,'owner')",[id,u]);}
 await db.query("INSERT INTO families(id,name,owner_id) VALUES($1,'test family',$2)",[family,alice]);for(const u of [alice,bob])await db.query('INSERT INTO family_members VALUES($1,$2)',[family,u]);
 const personal=(await createAccount(alice,{name:'personal asset',opening:10000})).id;const shared=(await createAccount(alice,{name:'shared asset',opening:20000,familyId:family})).id;
 assert.equal((await listAssets(bob)).some(a=>a.id===personal),false);assert.equal((await listAssets(bob)).some(a=>a.id===shared),true);
 const value=entry.parse({id:tx,accountId:personal,kind:'expense',amount:1200,date:'2026-09-14',category:'餐饮'});
 await transaction(c=>insertEntry(c,book,alice,value));assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,8800);
 const bobView=(await listAccounts(book,bob)).find(a=>a.id===personal);assert.equal(bobView.balance,null);assert.equal(bobView.opening,null);assert.equal(bobView.usable,false);
 await assert.rejects(()=>transaction(c=>insertEntry(c,book,bob,{...value,id:randomUUID()})),/自己的资产/);
 await assert.rejects(()=>createAccount(outsider,{name:'unauthorized',familyId:family}),/家庭成员/);
 await reuse(book,alice,{id:tx,version:1,targetBook:other});assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,8800);
 await transaction(async c=>{await validateActiveAccounts(c,book,{...value,accountId:shared},alice);await syncFinancialFacts(c,book,{...value,accountId:shared},alice);await c.query('UPDATE transactions SET account_id=$1 WHERE id=$2',[shared,tx]);});
 assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,10000);assert.equal((await listAssets(bob)).find(a=>a.id===shared).balance,18800);
 await transaction(c=>insertEntry(c,book,alice,{...value,id:cashTx,accountId:personal,amount:100}));
 const preview=await movePreview(book,cashTx);await moveEntry(book,alice,{id:cashTx,targetBook:other,versions:Object.fromEntries(preview.records.map(r=>[r.id,r.version]))});
 assert.equal((await db.query('SELECT account_id,book_id FROM transactions WHERE id=$1',[cashTx])).rows[0].account_id,personal);assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,9900);
 const report=await accountReport(alice,new URLSearchParams({from:'2026-09-01',to:'2026-09-30'}));assert.equal(report.summary.expense,100);assert.equal(report.summary.netAssets,9900);
 assert.equal((await accountReport(bob,new URLSearchParams({from:'2026-09-01',to:'2026-09-30',scope:family}))).summary.expense,1200);
 const asset=(await listAssets(alice)).find(a=>a.id===personal);await changeAccount(alice,{operation:'reconcile',id:personal,version:asset.version,expectedBalance:9900,balance:10000,note:'test reconcile'});
 assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,10000);
 await assert.rejects(()=>changeAccount(bob,{operation:'edit',id:personal,version:asset.version,name:'bad',opening:0}),/管理权限/);
 assert.equal((await search(bob,new URLSearchParams({entity:'account',q:'personal asset'}))).total,0);
 assert.ok((await search(alice,new URLSearchParams({entity:'account',q:'personal asset'}))).total>0);
 assert.ok((await searchOptions(alice,new URLSearchParams())).accounts.some(a=>a.id===personal));
 await templates(other,alice,'POST',{name:'asset template',value});
 await schedules(other,alice,'POST',{name:'asset schedule',frequency:'monthly',nextDate:'2026-10-14',value});
 const transfer=entry.parse({id:randomUUID(),accountId:personal,targetId:shared,kind:'transfer',amount:300,date:'2026-09-14',category:'其他'});
 await transaction(c=>insertEntry(c,other,alice,transfer));assert.equal((await listAssets(alice)).find(a=>a.id===personal).balance,9700);assert.equal((await listAssets(bob)).find(a=>a.id===shared).balance,19100);
 const refund=entry.parse({id:randomUUID(),accountId:shared,kind:'refund',amount:200,date:'2026-09-14',category:'餐饮',refundOf:tx});await transaction(c=>insertEntry(c,book,alice,refund));
 await reuse(book,alice,{id:refund.id,version:1,targetBook:other});assert.equal((await listAssets(bob)).find(a=>a.id===shared).balance,19300);
 const versioned=(await listAssets(alice)).find(a=>a.id===personal);await assert.rejects(()=>changeAccount(alice,{operation:'reconcile',id:personal,version:versioned.version,expectedBalance:10000,balance:10000,note:'stale test'}),/余额已变化/);
 console.log('PASS: independent ownership, personal privacy, family access, personal payment in shared book, reuse deduplication, synchronized payer changes, move without balance changes, scoped reports, reconciliation, asset search, templates and schedules');
}finally{
 await db.query('UPDATE transactions SET refund_of=NULL WHERE book_id=ANY($1::uuid[])',[[book,other]]);
 for(const id of [book,other]){await db.query('DELETE FROM expense_allocations WHERE transaction_id IN(SELECT id FROM transactions WHERE book_id=$1)',[id]);await db.query('DELETE FROM transactions WHERE book_id=$1',[id]);await db.query('DELETE FROM books WHERE id=$1',[id]);}
 await db.query('DELETE FROM account_adjustments WHERE created_by=ANY($1::uuid[])',[[alice,bob]]);await db.query('DELETE FROM accounts WHERE owner_id=ANY($1::uuid[]) OR family_id=$2',[[alice,bob,outsider],family]);await db.query('DELETE FROM families WHERE id=$1',[family]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[alice,bob,outsider]]);await db.end();
}
