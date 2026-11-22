import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrate, migrationFiles } from '../scripts/migrate.mjs';

const LEGACY = ['schema', 'memory-schema', 'profile-schema', 'discussions-schema', 'expense-claims-schema'];

// Columns, types, defaults, nullability and index definitions; constraint names are left out on purpose
// (production keeps category_preferences_by_user_* names from an old table rename).
async function shape(c: pg.Client) {
  const columns = (
    await c.query(
      `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns JOIN information_schema.tables USING(table_schema,table_name) WHERE table_type='BASE TABLE' AND table_schema='public' AND table_name<>'schema_migrations' ORDER BY 1,2`,
    )
  ).rows;
  const indexes = (
    await c.query(
      `SELECT tablename,regexp_replace(indexdef,'INDEX \\S+ ON','INDEX ON') AS def FROM pg_indexes WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY 1,2`,
    )
  ).rows;
  const triggers = (
    await c.query(
      `SELECT event_object_table,trigger_name,action_timing,event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY 1,2,4`,
    )
  ).rows;
  return { columns, indexes, triggers };
}

async function freshDatabase(base: URL, suffix: string) {
  const admin = new URL(base);
  admin.pathname = '/postgres';
  const name = base.pathname.slice(1) + '_' + suffix,
    c = new pg.Client({ connectionString: admin.toString() });
  await c.connect();
  try {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name}`);
  } finally {
    await c.end();
  }
  const url = new URL(base);
  url.pathname = '/' + name;
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  return client;
}

test(
  '迁移：新库执行 baseline，旧库补齐后登记，两者结构一致且重复执行无变化',
  { skip: !process.env.MIGRATION_TEST_DATABASE_URL },
  async () => {
    const base = new URL(process.env.MIGRATION_TEST_DATABASE_URL!);
    assert.equal(base.hostname, '127.0.0.1');
    assert.ok(base.pathname.endsWith('_test'));
    const fresh = await freshDatabase(base, 'fresh'),
      legacy = await freshDatabase(base, 'legacy');
    try {
      await migrate(fresh);
      assert.deepEqual(
        (await fresh.query('SELECT version,mode FROM schema_migrations ORDER BY version')).rows.map(
          r => r.version + ':' + r.mode,
        ),
        migrationFiles().map(f => f.version + ':applied'),
      );

      for (const name of LEGACY)
        await legacy.query(await readFile('scripts/legacy-schema/' + name + '.sql', 'utf8'));
      await legacy.query(`WITH u AS (
        INSERT INTO users(id,username,name,password) VALUES(gen_random_uuid(),'test','测试','unused') RETURNING id
      ), a AS (
        INSERT INTO accounts(id,name,owner_id) SELECT gen_random_uuid(),'测试钱包',id FROM u RETURNING id,owner_id
      ) INSERT INTO account_adjustments(id,account_id,created_by,amount,note,created_at)
        SELECT gen_random_uuid(),id,owner_id,1,'回填','2026-11-24T16:01:00Z' FROM a`);
      await migrate(legacy);
      assert.equal(
        (await legacy.query('SELECT effective_date::text FROM account_adjustments')).rows[0].effective_date,
        '2026-11-25',
      );
      assert.equal(
        (await legacy.query("SELECT mode FROM schema_migrations WHERE version='0001'")).rows[0].mode,
        'legacy',
      );

      const [a, b] = [await shape(fresh), await shape(legacy)];
      assert.equal(
        new Set(a.columns.map(c => c.table_name)).size,
        76,
        '迁移后应包含操作记录表和原有 75 张业务表',
      );
      assert.deepEqual(a.columns, b.columns);
      assert.deepEqual(a.indexes, b.indexes);
      assert.deepEqual(a.triggers, b.triggers);
      // Seed rows the legacy scripts inserted must exist on both paths (worker reads the queue setting).
      for (const c of [fresh, legacy])
        assert.deepEqual((await c.query('SELECT id,concurrency FROM ai_queue_settings')).rows, [
          { id: 1, concurrency: 2 },
        ]);

      await migrate(fresh);
      assert.deepEqual(await shape(fresh), a);
      await fresh.query("UPDATE schema_migrations SET checksum='changed' WHERE version='0001'");
      await assert.rejects(migrate(fresh), /文件内容被修改/);
    } finally {
      await fresh.end();
      await legacy.end();
    }
  },
);
