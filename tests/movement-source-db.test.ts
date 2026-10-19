import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {discussionFixtures} from './helpers/discussion-fixtures';
test('家庭往来付款钱包更正：已到账余额、待收款、权限与结算关联',{skip:!process.env.MOVEMENT_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.MOVEMENT_TEST_DATABASE_URL!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname.endsWith('_test'));process.env.DATABASE_URL=url.toString();
 const {db,withConnection}=await import('../src/server/db'),{familyFinance}=await import('../src/server/family-finance'),{accountBalance}=await import('../src/server/accounts'),{attachWalletBalances}=await import('../src/server/wallet-history');
 const c=await db.connect();try{
  for(const name of ['schema','memory-schema','profile-schema','discussions-schema','expense-claims-schema'])await c.query(await readFile('scripts/'+name+'.sql','utf8'));
  await c.query('BEGIN');await withConnection(c,async()=>{
   const f=await discussionFixtures(c),bank=randomUUID(),archived=randomUUID(),shared=randomUUID();
   for(const [id,name,owner,family,closed] of [[bank,'付款银行卡',f.alice,null,false],[archived,'停用银行卡',f.alice,null,true],[shared,'共同钱包',null,f.family,false]])await c.query('INSERT INTO accounts(id,name,type,owner_id,family_id,opening,archived) VALUES($1,$2,\'bank\',$3,$4,200000,$5)',[id,name,owner,family,closed]);
   const balances=async()=>Object.fromEntries((await c.query(`SELECT a.id,${accountBalance} AS balance FROM accounts a WHERE a.id=ANY($1::uuid[])`,[[f.wallet,bank,f.bobWallet]])).rows.map(r=>[r.id,r.balance]));
   const correct=(user:string,sourceId:string,expectedSourceId:string,id=f.movement)=>familyFinance(user,f.family,'POST',{operation:'correct-source',id,sourceId,expectedSourceId},c);
   const before=await balances();await correct(f.alice,bank,f.wallet);assert.deepEqual(await balances(),before,'pending correction does not debit a wallet');
   await familyFinance(f.bob,f.family,'POST',{operation:'confirm',id:f.movement,targetId:f.bobWallet},c);const paid=await balances();assert.equal(paid[bank],before[bank]-10000);assert.equal(paid[f.wallet],before[f.wallet]);assert.equal(paid[f.bobWallet],before[f.bobWallet]+10000);
   await c.query("INSERT INTO family_movement_details(movement_id,user_id,title,note) VALUES($1,$2,'私人标题','私人备注') ON CONFLICT(movement_id,user_id) DO UPDATE SET title=EXCLUDED.title,note=EXCLUDED.note",[f.movement,f.alice]);
   const original=(await c.query('SELECT * FROM family_movements WHERE id=$1',[f.movement])).rows[0];await correct(f.alice,f.wallet,bank);const changed=await balances();assert.equal(changed[bank],before[bank]);assert.equal(changed[f.wallet],before[f.wallet]-10000);assert.equal(changed[f.bobWallet],paid[f.bobWallet]);
   const after=(await c.query('SELECT * FROM family_movements WHERE id=$1',[f.movement])).rows[0];assert.deepEqual({...after,source_id:original.source_id},original,'only the source account changes');assert.equal((await c.query('SELECT note FROM family_movement_details WHERE movement_id=$1 AND user_id=$2',[f.movement,f.alice])).rows[0].note,'私人备注');
   const history=await attachWalletBalances<{id:string;wallet_balances?:{account_id:string}[]}>(f.alice,[{id:f.movement}]);assert.ok(history[0].wallet_balances?.some(b=>b.account_id===f.wallet));assert.ok(!history[0].wallet_balances?.some(b=>b.account_id===bank));
   await assert.rejects(()=>correct(f.bob,f.bobWallet,f.wallet),/转出人/);await assert.rejects(()=>correct(f.carol,bank,f.wallet),/转出人/);await assert.rejects(()=>correct(f.alice,bank,bank),/已改变/);await assert.rejects(()=>correct(f.alice,f.bobWallet,f.wallet),/自己的钱包/);await assert.rejects(()=>correct(f.alice,archived,f.wallet),/自己的钱包/);
   await c.query("UPDATE family_movements SET kind='loan',expense_id=$2 WHERE id=$1",[f.movement,f.expense]);await assert.rejects(()=>correct(f.alice,shared,f.wallet),/个人钱包/);await correct(f.alice,bank,f.wallet);assert.equal((await c.query('SELECT expense_id FROM family_movements WHERE id=$1',[f.movement])).rows[0].expense_id,f.expense);
   const direct=randomUUID();await familyFinance(f.alice,f.family,'POST',{operation:'create',id:direct,sourceId:bank,targetId:shared,kind:'transfer',amount:35000,date:'2026-10-19',allowSimilar:true},c);await assert.rejects(()=>correct(f.alice,shared,bank,direct),/不能相同/);
   await c.query("UPDATE family_movements SET status='cancelled' WHERE id=$1",[f.movement]);await assert.rejects(()=>correct(f.alice,f.wallet,bank),/已取消/);
  });
 }finally{await c.query('ROLLBACK');c.release();await db.end();}
});
