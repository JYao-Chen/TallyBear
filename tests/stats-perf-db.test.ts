import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { migrate } from '../scripts/migrate.mjs';
import { testDatabaseUrl } from './helpers/test-database.mjs';

test('单月 5000 笔交易和 50 个生效分摊计划', { skip: !process.env.STATS_PERF_TEST_DATABASE_URL }, async t => {
  process.env.DATABASE_URL = testDatabaseUrl('STATS_PERF_TEST_DATABASE_URL').toString();
  const { db, withConnection } = await import('../src/server/db');
  const { report, personalExpenseReport } = await import('../src/server/reports');
  const c = await db.connect();
  try {
    await migrate(c);
    await c.query('BEGIN');
    await withConnection(c, async () => {
      const user = randomUUID(),
        wallet = randomUUID(),
        books = [randomUUID(), randomUUID(), randomUUID()];
      await c.query(
        "INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'性能测试','unused')",
        [user],
      );
      await c.query("INSERT INTO accounts(id,name,type,owner_id) VALUES($1,'钱包','bank',$2)", [
        wallet,
        user,
      ]);
      await c.query(
        "INSERT INTO books(id,name,kind,owner_id) SELECT b,'账本','private',$2 FROM unnest($1::uuid[]) b",
        [books, user],
      );
      await c.query("INSERT INTO members SELECT b,$2,'owner' FROM unnest($1::uuid[]) b", [books, user]);
      await c.query(
        `INSERT INTO transactions(id,book_id,account_id,kind,amount,date,category,created_by)
        SELECT gen_random_uuid(),($1::uuid[])[1+i%3],$2,'expense',1200,'2026-11-01'::date+i%30,'消费',$3 FROM generate_series(1,5000) i`,
        [books, wallet, user],
      );
      await c.query(
        `WITH sources AS (SELECT * FROM transactions WHERE account_id=$1 ORDER BY id LIMIT 50),
        plans AS (INSERT INTO cost_projects(id,owner_id,title,active_plan)
          SELECT gen_random_uuid(),created_by,'年费',jsonb_build_object('title','年费','category','会员',
          'coverageStart','2026-11-01','coverageEnd','2027-11-01','mode','monthly','startMonth','2026-11','months',12,
          'sources',jsonb_build_array(jsonb_build_object('transactionId',id,'amount',amount)),
          'shares',jsonb_build_array(jsonb_build_object('userId',created_by,'amount',amount))) FROM sources RETURNING *),
        claims AS (INSERT INTO cost_source_claims(project_id,transaction_id,event_id,kind,amount,source_amount,account_id,date)
          SELECT p.id,t.id,t.id,t.kind,t.amount,t.amount,t.account_id,t.date FROM plans p JOIN sources t ON t.id=(p.active_plan#>>'{sources,0,transactionId}')::uuid)
        INSERT INTO cost_project_members(project_id,user_id,display_book_id) SELECT id,owner_id,$2 FROM plans`,
        [wallet, books[0]],
      );
      await c.query('ANALYZE transactions');
      const params = new URLSearchParams({ from: '2026-11-01', to: '2026-11-30' });
      const start = performance.now();
      const a = await report(books, params, user);
      const middle = performance.now();
      const b = await personalExpenseReport(user, params);
      const end = performance.now();
      const timeA = middle - start,
        timeB = end - middle;
      t.diagnostic(`report ${timeA.toFixed(1)} ms, personalExpenseReport ${timeB.toFixed(1)} ms`);
      for (const result of [a, b]) {
        assert.equal(result.totals.count, 5000);
        assert.equal(result.totals.expense, 4950 * 1200 + 50 * 100);
      }
      assert.ok(timeA < 1500, `report: ${timeA} ms`);
      assert.ok(timeB < 2000, `personalExpenseReport: ${timeB} ms`);
    });
  } finally {
    await c.query('ROLLBACK');
    c.release();
    await db.end();
  }
});
