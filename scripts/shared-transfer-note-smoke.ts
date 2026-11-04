import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/server/db';
import {familyFinance} from '../src/server/family-finance';
import {report} from '../src/server/reports';
import {listAssets} from '../src/server/accounts';
import {discussions} from '../src/server/discussions';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_note_test');
const [a,b,c,f,wa,wb,ba,bb,id,reverse]=Array.from({length:10},()=>randomUUID());
const params=new URLSearchParams({from:'2026-11-01',to:'2026-11-30',basis:'cashflow'});
try{
 for(const [u,label] of [[a,'甲'],[b,'乙'],[c,'其他成员']])await db.query('INSERT INTO users(id,username,name,password) VALUES($1,$2,$2,$2)',[u,label]);
 await db.query("INSERT INTO families(id,name,owner_id) VALUES($1,'测试家庭',$2)",[f,a]);for(const u of [a,b,c])await db.query('INSERT INTO family_members VALUES($1,$2)',[f,u]);
 for(const [u,w,book] of [[a,wa,ba],[b,wb,bb]]){await db.query("INSERT INTO accounts(id,name,owner_id,ownership,opening) VALUES($1,'测试钱包',$2,'personal',100000)",[w,u]);await db.query("INSERT INTO books(id,name,owner_id,kind) VALUES($1,'私账',$2,'private')",[book,u]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[book,u]);}
 for(const [sender,recipient,source,target,sourceBook,targetBook,movement,note] of [[a,b,wa,wb,ba,bb,id,'原始共享留言'],[b,a,wb,wa,bb,ba,reverse,'']]){await familyFinance(sender,f,'POST',{operation:'create',id:movement,kind:'transfer',sourceId:source,recipientId:recipient,amount:6000,date:'2026-11-04',note,displayBookId:sourceBook});await familyFinance(recipient,f,'POST',{operation:'confirm',id:movement,targetId:target,displayBookId:targetBook});}
 const privateEdit=(u:string,movement:string,book:string,note:string)=>familyFinance(u,f,'POST',{operation:'edit',id:movement,displayBookId:book,title:'本人记录',note,transactionTime:'',platform:'',externalId:'',removeAttachments:[]});
 await privateEdit(a,id,ba,'甲的私密内容');await privateEdit(b,id,bb,'');await privateEdit(b,reverse,bb,'乙的私密内容');
 assert.ok(!(await report(ba,params,a)).rows.find((r:any)=>r.id===reverse).note.includes('乙的私密内容'));
 const balanceA=(await listAssets(a)).find(v=>v.id===wa)!.balance,balanceB=(await listAssets(b)).find(v=>v.id===wb)!.balance;
 await familyFinance(a,f,'POST',{operation:'edit-note',id,note:'更新共享留言',expectedNote:'原始共享留言'});
 await familyFinance(b,f,'POST',{operation:'edit-note',id:reverse,note:'反方向共享留言',expectedNote:''});
 const fromA=(await report(ba,params,a)).rows.find((r:any)=>r.id===id),fromB=(await report(bb,params,b)).rows.find((r:any)=>r.id===id);
 assert.match(fromA.note,/更新共享留言/);assert.match(fromA.note,/甲的私密内容/);assert.ok(fromA.note.includes('\n'));assert.match(fromB.note,/更新共享留言/);assert.ok(!fromB.note.includes('甲的私密内容'));
 assert.match((await report(ba,params,a)).rows.find((r:any)=>r.id===reverse).note,/反方向共享留言/);
 const detail=await familyFinance(b,f,'GET',{}) as any;assert.equal(detail.movements.find((m:any)=>m.id===id).details.note,'');assert.equal(detail.movements.find((m:any)=>m.id===id).note,'更新共享留言');
 const discussion=await discussions(b,'GET',['discussions'],{},new URLSearchParams({kind:'movement',id}));assert.ok('context' in discussion);assert.equal(discussion.context?.note,'更新共享留言');
 await discussions(b,'POST',['discussions','messages'],{target:{kind:'movement',id,scope:''},id:randomUUID(),body:'收款人回复',replyTo:null},new URLSearchParams());
 await assert.rejects(familyFinance(b,f,'POST',{operation:'edit-note',id,note:'不能覆盖',expectedNote:'更新共享留言'}),/只有转出人/);
 await assert.rejects(familyFinance(c,f,'POST',{operation:'edit-note',id,note:'不能覆盖',expectedNote:'更新共享留言'}),/只有转出人/);
 await assert.rejects(familyFinance(a,f,'POST',{operation:'edit-note',id,note:'旧页面覆盖',expectedNote:'原始共享留言'}),/已变化/);
 await familyFinance(a,f,'POST',{operation:'edit-note',id,note:'',expectedNote:'更新共享留言'});assert.equal((await db.query('SELECT note FROM family_movement_details WHERE movement_id=$1 AND user_id=$2',[id,a])).rows[0].note,'甲的私密内容');
 assert.equal((await listAssets(a)).find(v=>v.id===wa)!.balance,balanceA);assert.equal((await listAssets(b)).find(v=>v.id===wb)!.balance,balanceB);
 console.log('PASS: shared note edits in both directions, sender-only authorization, stale edit protection, private note isolation, empty private notes do not mask shared notes, discussion replies and unchanged balances.');
}finally{await db.end();}
