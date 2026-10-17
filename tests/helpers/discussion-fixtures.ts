import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
export async function discussionFixtures(c:PoolClient){
 const [alice,bob,carol,outsider,family,book,privateBook,wallet,bobWallet,movement,expense,privateExpense,project,schedule]=Array.from({length:14},()=>randomUUID());
 for(const [id,name] of [[alice,'布布'],[bob,'一二'],[carol,'其他家人'],[outsider,'访客']])await c.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,$2,'unused')",[id,name]);
 await c.query("UPDATE users SET avatar=CASE WHEN id=$1 THEN 'sticker:001' ELSE 'sticker:002' END WHERE id=ANY($2::uuid[])",[alice,[alice,bob]]);
 await c.query("INSERT INTO families(id,name,owner_id) VALUES($1,'讨论测试家庭',$2)",[family,alice]);
 for(const id of [alice,bob,carol])await c.query('INSERT INTO family_members VALUES($1,$2)',[family,id]);
 for(const [id,kind,name] of [[book,'shared','家庭共享账本'],[privateBook,'private','私人账本']]){
  await c.query('INSERT INTO books(id,name,kind,owner_id,family_id) VALUES($1,$2,$3,$4,$5)',[id,name,kind,alice,kind==='shared'?family:null]);
  await c.query("INSERT INTO members VALUES($1,$2,'owner')",[id,alice]);
 }
 await c.query("INSERT INTO members VALUES($1,$2,'viewer')",[book,bob]);
 for(const [id,owner,name] of [[wallet,alice,'建设银行'],[bobWallet,bob,'招商银行']])await c.query("INSERT INTO accounts(id,name,type,owner_id,opening) VALUES($1,$2,'bank',$3,200000)",[id,name,owner]);
 await c.query("INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,kind,amount,date,note) VALUES($1,$2,$3,$4,$5,'transfer',10000,'2026-10-17','本月生活费')",[movement,family,alice,bob,wallet]);
 await c.query("INSERT INTO family_movement_details(movement_id,user_id,note) VALUES($1,$2,'私有记录，不可共享')",[movement,alice]);
 for(const [id,b] of [[expense,book],[privateExpense,privateBook]])await c.query("INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,category,created_by) VALUES($1,$2,$3,'expense',12000,'2026-10-17','共享水电费','居住',$4)",[id,b,wallet,alice]);
 const plan={title:'房租费用分摊',category:'居住',familyId:family,sources:[{transactionId:expense,amount:12000}],coverageStart:'2026-10-01',coverageEnd:'2026-11-01',mode:'monthly',startMonth:'2026-10',months:1,periods:[],shares:[{userId:alice,amount:6000},{userId:bob,amount:6000}],offsets:[]};
 await c.query('INSERT INTO cost_projects(id,owner_id,family_id,title,active_plan) VALUES($1,$2,$3,$4,$5)',[project,alice,family,plan.title,JSON.stringify(plan)]);
 for(const user of [alice,bob])await c.query('INSERT INTO cost_project_members(project_id,user_id,accepted_version,display_book_id) VALUES($1,$2,1,$3)',[project,user,book]);
 await c.query("INSERT INTO cost_source_claims(project_id,transaction_id,event_id,kind,amount,source_amount,account_id,date) VALUES($1,$2,$2,'expense',12000,12000,$3,'2026-10-17')",[project,expense,wallet]);
 const rule={title:'每月房租计划',category:'居住',familyId:family,firstDate:'2026-10-17',months:1,totalCycles:null,shares:[{userId:alice,amount:6000},{userId:bob,amount:6000}]};
 await c.query("INSERT INTO cost_schedules(id,owner_id,family_id,rule,next_date) VALUES($1,$2,$3,$4,'2026-10-17')",[schedule,alice,family,JSON.stringify(rule)]);
 for(const user of [alice,bob])await c.query('INSERT INTO cost_schedule_members VALUES($1,$2,true,$3)',[schedule,user,book]);
 await c.query("INSERT INTO cost_schedule_occurrences(schedule_id,due_date,skipped) VALUES($1,'2026-09-17',true)",[schedule]);
 return {alice,bob,carol,outsider,family,book,privateBook,wallet,bobWallet,movement,expense,privateExpense,project,schedule};
}
