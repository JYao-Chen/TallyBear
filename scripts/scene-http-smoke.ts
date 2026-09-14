import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {db} from '../src/server/db';
assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith('_scene_test'));
const row=(await db.query("SELECT t.*,to_char(t.date,'YYYY-MM-DD') AS date,t.amount::float8 AS amount FROM transactions t JOIN users u ON u.id=t.created_by WHERE u.name='场景测试' ORDER BY t.created_at DESC LIMIT 1")).rows[0];
assert.ok(row);const token=randomUUID();await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[token,row.created_by]);
const origin='http://127.0.0.1:3018';
const child=spawn(process.execPath,['releases/scene-entry-20260914/server.js'],{env:{...process.env,APP_ORIGIN:origin,PORT:'3018',HOSTNAME:'127.0.0.1'},stdio:'ignore'});
try{
 for(let i=0;i<40;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 const scene={...row.scene,destination:'望京'};
 const response=await fetch(origin+`/api/books/${row.book_id}/transactions`,{method:'PUT',headers:{'Content-Type':'application/json',origin,cookie:`bubu_session=${token}`},body:JSON.stringify({id:row.id,version:row.version,accountId:row.account_id,kind:row.kind,amount:row.amount,date:row.date,payee:row.payee,category:row.category,scene,title:'地铁 · 西直门 → 望京',occurredAt:'08:35'})});
 assert.equal(response.status,200,await response.text());
 const saved=(await db.query('SELECT scene,occurred_at,title FROM transactions WHERE id=$1',[row.id])).rows[0];assert.deepEqual(saved.scene,scene);assert.equal(saved.occurred_at,'08:35');assert.equal(saved.title,'地铁 · 西直门 → 望京');
 console.log('PASS: authenticated edit API preserves structured route, timestamp and title');
}finally{child.kill();await db.end();}
