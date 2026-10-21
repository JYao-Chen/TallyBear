import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,withConnection} from '../src/server/db';
import {changeCategory} from '../src/server/categories';
import {renameCategoryBudgets,renameCategoryRecords} from '../src/server/category-rename';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_rename_test');
const c=await db.connect();
try{
 await c.query('BEGIN');
 const [alice,bob,shared,own,other,viewer,wallet]=Array.from({length:7},()=>randomUUID());
 for(const id of [alice,bob])await c.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'分类测试','unused')",[id]);
 for(const [id,kind,owner] of [[shared,'shared',alice],[own,'private',alice],[other,'private',bob],[viewer,'shared',bob]])await c.query('INSERT INTO books(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[id,id,kind,owner]);
 for(const [book,user,role] of [[shared,alice,'owner'],[shared,bob,'editor'],[own,alice,'owner'],[other,bob,'owner'],[viewer,alice,'viewer']])await c.query('INSERT INTO members VALUES($1,$2,$3)',[book,user,role]);
 await c.query("INSERT INTO accounts(id,name,type,owner_id,ownership) VALUES($1,'钱包','cash',$2,'personal')",[wallet,alice]);
 const entries:Record<string,string>={};
 for(const [key,book,creator,category,kind,deleted] of [
  ['sharedMine',shared,alice,'旧奶茶','expense',false],['sharedPeer',shared,bob,'旧奶茶','expense',false],
  ['reclassified',shared,bob,'旧奶茶','expense',false],['refund',shared,bob,'旧奶茶','refund',false],
  ['deleted',shared,alice,'旧奶茶','expense',true],['privateMine',own,alice,'旧奶茶','expense',false],
  ['privateOther',other,bob,'旧奶茶','expense',false],['readonly',viewer,alice,'旧奶茶','expense',false]
 ] as const){const id=randomUUID();entries[key]=id;await c.query("INSERT INTO transactions(id,book_id,account_id,created_by,kind,amount,date,category,deleted) VALUES($1,$2,$3,$4,$5,1000,'2026-09-01',$6,$7)",[id,book,wallet,creator,kind,category,deleted]);}
 await c.query("UPDATE transactions SET category='其他',version=version+1 WHERE id=$1",[entries.reclassified]);
 for(const book of [shared,own,other,viewer])await c.query("INSERT INTO budgets VALUES($1,'2026-10','旧奶茶',10000)",[book]);
 const before=(await c.query('SELECT id,amount,date,account_id,kind,deleted,version FROM transactions')).rows;
 await withConnection(c,()=>changeCategory(alice,{name:'旧奶茶',icon:'☕'}));
 await withConnection(c,()=>changeCategory(alice,{name:'旧奶茶',newName:'新奶茶',icon:'☕'}));
 const after=(await c.query('SELECT * FROM transactions')).rows;
 for(const key of ['sharedMine','sharedPeer','refund','deleted','privateMine'])assert.equal(after.find(r=>r.id===entries[key])!.category,'新奶茶',key);
 for(const key of ['privateOther','readonly'])assert.equal(after.find(r=>r.id===entries[key])!.category,'旧奶茶',key);
 const preserved=after.find(r=>r.id===entries.reclassified)!;assert.equal(preserved.category,'其他');assert.equal(preserved.version,2);
 for(const row of after){const old=before.find(r=>r.id===row.id)!;for(const field of ['amount','account_id','kind','deleted'])assert.equal(row[field],old[field],field);assert.equal(row.date.getTime(),old.date.getTime());}
 const budgets=(await c.query('SELECT * FROM budgets')).rows;
 for(const book of [shared,own])assert.equal(budgets.find(r=>r.book_id===book)!.category,'新奶茶');
 for(const book of [other,viewer])assert.equal(budgets.find(r=>r.book_id===book)!.category,'旧奶茶');
 // Budget category edits use the same current-name predicate within one ledger.
 assert.equal(await renameCategoryRecords(c,[shared],'新奶茶','预算新类'),4);
 assert.equal((await c.query('SELECT category FROM transactions WHERE id=$1',[entries.reclassified])).rows[0].category,'其他');
 assert.equal((await c.query('SELECT category FROM transactions WHERE id=$1',[entries.privateMine])).rows[0].category,'新奶茶');
 await c.query("INSERT INTO budgets VALUES($1,'2026-10','冲突分类',20000)",[shared]);
 await assert.rejects(renameCategoryBudgets(c,[shared],'新奶茶','冲突分类'),/该分类已有预算/);
 assert.equal((await c.query("SELECT amount FROM budgets WHERE book_id=$1 AND category='冲突分类'",[shared])).rows[0].amount,'20000');
 console.log('PASS: catalogue rename updates current old-name history/shared peer/refund/recycle records and budgets; manual recategorization, private peers and readonly books preserved; financial facts unchanged; budget rename scoped and conflicts retained');
}finally{await c.query('ROLLBACK');c.release();await db.end();}
