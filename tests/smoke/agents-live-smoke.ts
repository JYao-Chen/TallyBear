import './database.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const { db } = await import('../../src/server/db');
const { runFinanceAgent } = await import('../../src/server/finance-agent');
try {
  const user = (await db.query("SELECT * FROM users WHERE username='queue0'")).rows[0],
    book = (await db.query('SELECT id FROM books WHERE owner_id=$1 LIMIT 1', [user.id])).rows[0].id;
  const account = randomUUID();
  await db.query("INSERT INTO accounts(id,owner_id,name) VALUES($1,$2,'测试现金')", [account, user.id]);
  await db.query(
    "INSERT INTO transactions(id,book_id,account_id,kind,amount,date,payee,category,created_by) VALUES($1,$2,$3,'expense',10000,'2026-09-01','测试餐厅','餐饮',$4)",
    [randomUUID(), book, account, user.id],
  );
  const result = await runFinanceAgent({
    book,
    user,
    question: '请委派财务分析助手，查询2026年9月的餐饮支出并生成柱状图，再由总助手汇总成简短报告。',
    month: '2026-09',
    history: [],
    images: [],
    signal: AbortSignal.timeout(180000),
    emit: (event, data) => {
      if (event === 'agent_start' || event === 'agent_done') console.log(event, data.role, data.status);
    },
  });
  assert.ok(result.artifacts.agents?.some(a => a.status === 'complete'));
  assert.ok(result.artifacts.charts.length > 0);
  assert.ok(result.artifacts.charts.some(c => c.data.some(d => d.value === 100)));
  assert.ok(result.text.length > 10);
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM transactions WHERE book_id=$1', [book])).rows[0].n,
    1,
  );
  console.log(
    'PASS: configured live model → supervisor → specialist → real query/chart → final report; isolated synthetic ledger only',
  );
} finally {
  await db.end();
}
