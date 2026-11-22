// Numbered schema migrations. `node --env-file=.env scripts/migrate.mjs` or import {migrate}.
import pg from 'pg';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const migrationDir=new URL('migrations/',root),legacyDir=new URL('scripts/legacy-schema/',root);
// Idempotent scripts every pre-migration install ran on each deploy; they bring any older database up to the baseline.
const LEGACY=['schema','memory-schema','profile-schema','discussions-schema','expense-claims-schema'];
const LOCK=7428301;

export function migrationFiles(){
 return readdirSync(migrationDir).filter(f=>/^\d{4}_[a-z0-9_-]+\.sql$/.test(f)).sort().map(name=>{
  const sql=readFileSync(new URL(name,migrationDir),'utf8');
  return {version:name.slice(0,4),name,sql,checksum:createHash('sha256').update(sql).digest('hex')};
 });
}

// pgvector is optional: memory search falls back to text ranking without it.
async function optionalVector(client,log){
 const r=await client.query(`DO $$BEGIN CREATE EXTENSION IF NOT EXISTS vector;EXCEPTION WHEN others THEN RAISE NOTICE 'pgvector unavailable';END$$`);
 if(!(await client.query("SELECT 1 FROM pg_extension WHERE extname='vector'")).rowCount)log('pgvector 未安装，语义记忆检索退回文本检索');
 return r;
}

export async function migrate(client,{log=()=>{}}={}){
 await client.query('SELECT pg_advisory_lock($1)',[LOCK]);
 try{
  await optionalVector(client,log);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,name text NOT NULL,checksum text NOT NULL,mode text NOT NULL CHECK(mode IN ('applied','legacy')),applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied=new Map((await client.query('SELECT version,checksum FROM schema_migrations')).rows.map(r=>[r.version,r.checksum]));
  const files=migrationFiles(),[baseline]=files;
  if(!baseline||baseline.version!=='0001')throw new Error('缺少 migrations/0001_baseline.sql');
  const existing=(await client.query("SELECT to_regclass('public.transactions') IS NOT NULL AS found")).rows[0].found;
  if(!applied.size&&existing){
   await client.query('BEGIN');
   try{
    for(const name of LEGACY)await client.query(readFileSync(new URL(name+'.sql',legacyDir),'utf8'));
    await client.query("INSERT INTO schema_migrations(version,name,checksum,mode) VALUES($1,$2,$3,'legacy')",[baseline.version,baseline.name,baseline.checksum]);
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');throw e;}
   applied.set(baseline.version,baseline.checksum);log('已有数据库：补齐旧结构并登记 '+baseline.name);
  }
  for(const f of files){
   if(applied.has(f.version)){if(applied.get(f.version)!==f.checksum)throw new Error(`迁移 ${f.name} 已执行但文件内容被修改`);continue;}
   await client.query('BEGIN');
   try{
    await client.query(f.sql);
    await client.query("INSERT INTO schema_migrations(version,name,checksum,mode) VALUES($1,$2,$3,'applied')",[f.version,f.name,f.checksum]);
    await client.query('COMMIT');
   }catch(e){await client.query('ROLLBACK');throw new Error(`迁移 ${f.name} 失败：${e.message}`);}
   log('已执行 '+f.name);
  }
 }finally{await client.query('SELECT pg_advisory_unlock($1)',[LOCK]);}
}

// Accepts a pg Pool (borrows one connection) or a connected Client.
export async function migrateWith(db,options){
 if(typeof db.totalCount==='number'){const c=await db.connect();try{await migrate(c,options);}finally{c.release();}}
 else await migrate(db,options);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{await migrate(client,{log:console.log});console.log('数据库结构已是最新');}finally{await client.end();}
}
