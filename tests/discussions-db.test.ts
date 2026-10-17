import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {discussionFixtures} from './helpers/discussion-fixtures';
import type {DiscussionTarget} from '../src/lib/discussions';

test('账目讨论：权限、回复、分页、未读、账期隔离与收款回复',{skip:!process.env.DISCUSSION_TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.DISCUSSION_TEST_DATABASE_URL!);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.endsWith('_test'));
 process.env.DATABASE_URL=url.toString();
 const {db,withConnection}=await import('../src/server/db');
 const {discussions}=await import('../src/server/discussions');
 const {familyFinance}=await import('../src/server/family-finance');
 const c=await db.connect();
 try{
  await c.query(await readFile('scripts/schema.sql','utf8'));await c.query(await readFile('scripts/discussions-schema.sql','utf8'));
  await c.query('BEGIN');
  await withConnection(c,async()=>{
   const f=await discussionFixtures(c);
   const read=async(...args:Parameters<typeof discussions>)=>{const result=await discussions(...args);assert.ok('rows' in result);return result;};
   const get=(user:string,target:DiscussionTarget,offset=0)=>read(user,'GET',['discussions'],{},new URLSearchParams({...target,offset:String(offset)}));
   const post=(user:string,target:DiscussionTarget,body:string,replyTo?:string,id=randomUUID())=>discussions(user,'POST',['discussions','messages'],{target,id,body,replyTo},new URLSearchParams());
   const inbox=(user:string,offset=0)=>read(user,'GET',['discussions','inbox'],{},new URLSearchParams({offset:String(offset)}));
   const movement:DiscussionTarget={kind:'movement',id:f.movement};
   const shared:DiscussionTarget={kind:'transaction',id:f.expense};
   const project:DiscussionTarget={kind:'project',id:f.project};
   const schedule:DiscussionTarget={kind:'schedule',id:f.schedule};
   for(const target of [movement,shared,project,schedule]){
    const d=await get(f.alice,target);assert.equal(d.rows.length,0);assert.ok(d.people);assert.deepEqual(d.people.map((p:any)=>p.id).sort(),[f.alice,f.bob].sort());
    assert.ok(!JSON.stringify(d).includes('私有记录'));assert.equal(d.people.find((p:any)=>p.id===f.alice).avatar,'sticker:001');
    await assert.rejects(()=>get(f.carol,target),/无权访问/);await assert.rejects(()=>post(f.outsider,target,'越权留言'),/无权访问/);
   }
   await assert.rejects(()=>get(f.alice,{kind:'transaction',id:f.privateExpense}),/无权访问/);
   const first=randomUUID();await post(f.alice,movement,'生活费收到了吗？',undefined,first);await post(f.alice,movement,'生活费收到了吗？',undefined,first);
   assert.equal((await get(f.bob,movement)).total,1,'retries do not duplicate messages');
   assert.equal((await inbox(f.alice)).total,0,'own messages do not create unread alerts');
   assert.equal((await inbox(f.bob)).rows[0].unread,1);assert.equal((await inbox(f.bob)).rows[0].avatar,'sticker:001');
   assert.equal((await inbox(f.carol)).total,0);
   await post(f.bob,movement,'收到了，谢谢！',first);
   const d=await get(f.alice,movement);assert.equal(d.rows[1].reply_body,'生活费收到了吗？');assert.equal(d.rows[1].avatar,'sticker:002');assert.equal(d.rows[1].reply_avatar,'sticker:001');
   await discussions(f.alice,'POST',['discussions','read'],{target:movement,upTo:d.rows.at(-1).seq},new URLSearchParams());
   assert.equal((await inbox(f.alice)).total,0);
   await post(f.bob,shared,'水费怎么分？'); // Viewer may discuss an accessible bill.
   await assert.rejects(()=>post(f.alice,shared,'跨讨论引用',first),/不属于/);
   for(let i=0;i<23;i++)await post(f.alice,project,'讨论 '+i);
   const latest=await get(f.bob,project),older=await get(f.bob,project,20);assert.equal(latest.rows.length,20);assert.equal(older.rows.length,3);assert.equal(latest.total,23);assert.equal(latest.rows.at(-1).body,'讨论 22');
   const cycle={...schedule,scope:'2026-10-17'};await post(f.alice,schedule,'整体规则');await post(f.bob,cycle,'本期金额');
   await post(f.alice,{...schedule,scope:'2026-09-17'},'过去已跳过账期');
   assert.equal((await get(f.bob,schedule)).rows.length,1);assert.equal((await get(f.bob,cycle)).rows[0].body,'本期金额');
   await assert.rejects(()=>post(f.alice,{...schedule,scope:'2026-10-99'},'不存在账期'),/账期不存在/);
   const before=await c.query('SELECT count(*) FROM transactions');
   await familyFinance(f.bob,f.family,'POST',{operation:'confirm',id:f.movement,targetId:f.bobWallet,reply:'已核对到账，收到啦'},c);
   assert.equal((await get(f.alice,movement)).rows.at(-1).body,'已核对到账，收到啦');
   await familyFinance(f.bob,f.family,'POST',{operation:'confirm',id:f.movement,targetId:f.bobWallet,reply:'已核对到账，收到啦'},c);
   assert.equal((await get(f.alice,movement)).rows.length,3,'repeat confirmation does not duplicate reply');
   assert.equal((await c.query('SELECT status FROM family_movements WHERE id=$1',[f.movement])).rows[0].status,'confirmed');
   assert.equal((await c.query('SELECT count(*) FROM transactions')).rows[0].count,before.rows[0].count,'discussion creates no transaction');
   const {costProjects}=await import('../src/server/cost-projects');
   const {costSchedules}=await import('../src/server/cost-schedules');
   for(const mode of ['project','schedule']){
    const id=randomUUID();await familyFinance(f.alice,f.family,'POST',{operation:'create',id,sourceId:f.wallet,recipientId:f.bob,kind:'transfer',amount:1000,date:'2026-10-17',allowSimilar:true},c);
    if(mode==='project'){
     await c.query('INSERT INTO cost_settlements VALUES($1,$2,1000)',[f.project,id]);
     await costProjects(f.bob,'POST',['cost-projects',f.project,'settlement-transfer'],{operation:'confirm',id,targetId:f.bobWallet,reply:'项目结算已收到'},new URLSearchParams());
    }else await costSchedules(f.bob,'POST',['cost-schedules',f.schedule,'receive'],{version:1,dueDate:'2026-10-17',movementId:id,targetId:f.bobWallet,reply:'本期分摊已收到'},new URLSearchParams());
    assert.equal((await get(f.alice,{kind:'movement',id})).rows[0].body,mode==='project'?'项目结算已收到':'本期分摊已收到');
   }
   await c.query('DELETE FROM members WHERE book_id=$1 AND user_id=$2',[f.book,f.bob]);
   await assert.rejects(()=>get(f.bob,shared),/无权访问/);assert.ok(!(await inbox(f.bob)).rows.some((r:any)=>r.target_id===f.expense));
   await c.query('DELETE FROM family_members WHERE family_id=$1 AND user_id=$2',[f.family,f.bob]);
   for(const target of [movement,project,schedule])await assert.rejects(()=>get(f.bob,target),/无权访问/);
   assert.equal((await inbox(f.bob)).total,0,'revoked access removes inbox previews too');
   await c.query('UPDATE transactions SET deleted=true WHERE id=$1',[f.expense]);await assert.rejects(()=>get(f.alice,shared),/无权访问/);
  });
 }finally{await c.query('ROLLBACK');c.release();await db.end();}
});
