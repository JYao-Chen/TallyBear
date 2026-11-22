import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../scripts/migrate.mjs';
import { randomUUID } from 'node:crypto';
test(
  '已有信用消费、退款、还款在现金报告与账户余额中分别核算',
  { skip: !process.env.CASH_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.CASH_TEST_DATABASE_URL!);
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(url.pathname.endsWith('_test'));
    process.env.DATABASE_URL = url.toString();
    const { db, withConnection } = await import('../src/server/db'),
      { walletFunds } = await import('../src/server/wallet-funds'),
      { accountBalance } = await import('../src/server/accounts');
    const c = await db.connect();
    try {
      await migrate(c);
      await c.query('BEGIN');
      await withConnection(c, async () => {
        const [user, book, bank, credit] = Array.from({ length: 4 }, () => randomUUID());
        await c.query(
          "INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'测试','unused')",
          [user],
        );
        await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'测试','private',$2)", [
          book,
          user,
        ]);
        await c.query(
          "INSERT INTO accounts(id,name,type,owner_id,opening) VALUES($1,'银行卡','bank',$3,200000),($2,'信用卡','credit',$3,0)",
          [bank, credit, user],
        );
        for (const [kind, amount, source, target] of [
          ['expense', 100000, credit, null],
          ['refund', 10000, credit, null],
          ['transfer', 80847, bank, credit],
        ])
          await c.query(
            "INSERT INTO transactions(id,book_id,account_id,target_id,kind,amount,date,category,created_by) VALUES($1,$2,$3,$4,$5,$6,'2026-11-20','其他',$7)",
            [randomUUID(), book, source, target, kind, amount, user],
          );
        const accounts = (
          await c.query('SELECT id,name,type,opening FROM accounts WHERE id=ANY($1::uuid[])', [
            [bank, credit],
          ])
        ).rows;
        const all = await walletFunds(accounts, '2026-11-01', '2026-11-30');
        assert.equal(all.summary.outflow, 80847);
        assert.equal(all.summary.inflow, 0);
        assert.equal(all.summary.flowChange, -80847);
        assert.equal(all.summary.expense, 0);
        assert.equal(all.summary.refund, 0);
        assert.equal(all.summary.cashClosingBalance, 119153);
        assert.equal(all.summary.closingBalance, 110000);
        assert.equal(all.rows.filter(r => r.repayment).length, 1);
        const balances = (
          await c.query(`SELECT a.id,${accountBalance} AS balance FROM accounts a WHERE id=ANY($1::uuid[])`, [
            [bank, credit],
          ])
        ).rows;
        assert.equal(balances.find(a => a.id === bank).balance, 119153);
        assert.equal(balances.find(a => a.id === credit).balance, -9153);
        const selected = await walletFunds(
          accounts.filter(a => a.id === bank),
          '2026-11-01',
          '2026-11-30',
        );
        assert.equal(selected.summary.flowChange, -80847);
        assert.equal(selected.rows[0].repayment, true);
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);
