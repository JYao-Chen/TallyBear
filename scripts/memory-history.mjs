// Run only from the deployed release with its production environment, or an isolated test DB.
// This schedules the ordinary worker; it never edits ledger facts or prints memory bodies.
import pg from 'pg';
import {randomUUID} from 'node:crypto';
const operation=process.argv[2];
if(!['--enqueue','--status'].includes(operation))throw new Error('Usage: node scripts/memory-history.mjs --enqueue|--status');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 if(operation==='--enqueue'){
  const users=(await db.query(`SELECT u.id FROM users u LEFT JOIN memory_settings s ON s.user_id=u.id
   WHERE NOT u.disabled AND COALESCE(s.enabled,true) AND (
    EXISTS(SELECT 1 FROM transactions t JOIN members b ON b.book_id=t.book_id AND b.user_id=u.id WHERE t.created_by=u.id AND NOT t.deleted)
    OR EXISTS(SELECT 1 FROM finance_conversations c JOIN members b ON b.book_id=c.book_id AND b.user_id=u.id WHERE c.user_id=u.id))`)).rows;
  let queued=0;
  for(const {id} of users)queued+=(await db.query(`INSERT INTO ai_jobs(id,user_id,kind,payload)
   SELECT $1,$2,'memory','{"operation":"history"}'::jsonb WHERE NOT EXISTS(
    SELECT 1 FROM ai_jobs WHERE user_id=$2 AND kind='memory' AND status IN ('queued','running') AND payload->>'operation'='history')`,[randomUUID(),id])).rowCount;
  console.log(JSON.stringify({eligibleUsers:users.length,queued}));
 }
 console.log(JSON.stringify({jobs:(await db.query("SELECT status,count(*)::int FROM ai_jobs WHERE kind='memory' GROUP BY status")).rows,memories:(await db.query('SELECT kind,status,count(*)::int FROM memories GROUP BY kind,status')).rows,sources:(await db.query('SELECT source_type,count(*)::int FROM memory_sources GROUP BY source_type')).rows,vectors:(await db.query('SELECT count(*)::int FROM memory_vectors')).rows[0].count,activeIndexes:(await db.query('SELECT count(*)::int FROM memory_embedding_active')).rows[0].count}));
}finally{await db.end();}
