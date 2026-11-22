import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { recordingDate } from '../src/lib/entry-time';
import { householdMonth } from './helpers/household-month';
import { migrate } from '../scripts/migrate.mjs';

test(
  '家庭总览、缴款、校准归期与分类金额筛选',
  { skip: !process.env.STATS_FAMILY_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.STATS_FAMILY_TEST_DATABASE_URL!);
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(url.pathname.endsWith('_test'));
    process.env.DATABASE_URL = url.toString();
    const { db, withConnection } = await import('../src/server/db');
    const { familyOverview, report } = await import('../src/server/reports');
    const { walletFunds } = await import('../src/server/wallet-funds');
    const { changeAccount } = await import('../src/server/accounts');
    const c = await db.connect();
    try {
      await migrate(c);
      await c.query('BEGIN');
      await withConnection(c, async () => {
        const f = await householdMonth(c);
        const month = { from: '2026-11-01', to: '2026-11-30' };
        const q = new URLSearchParams({ ...month, familyId: f.family });
        const funds = (from: string, to: string) =>
          walletFunds([{ id: f.partnerBank, name: '银行卡', opening: 500000 }], from, to);
        const nov = await funds(month.from, month.to),
          dec = await funds('2026-12-01', '2026-12-31');
        assert.equal(nov.summary.contribution, 100000);
        assert.equal(nov.summary.transferOut, 0);
        assert.equal(nov.daily.find(d => d.date === '2026-11-28')?.adjustment, 700);
        assert.equal(dec.summary.openingBalance, nov.summary.closingBalance);
        assert.equal(dec.summary.adjustment, 0);
        const version = (await c.query('SELECT version FROM accounts WHERE id=$1', [f.partnerBank])).rows[0]
          .version;
        const adjustmentId = nov.rows.find(r => r.kind === 'adjustment')!.id;
        const edit = { operation: 'edit-adjustment', id: f.partnerBank, version, adjustmentId };
        await assert.rejects(
          changeAccount(f.partner, { ...edit, effectiveDate: '9999-01-01' }),
          /不能晚于今天/,
        );
        await changeAccount(f.partner, { ...edit, effectiveDate: '2020-10-31' });
        assert.equal((await funds(month.from, month.to)).summary.openingBalance, 500700);

        const reconcile = {
          operation: 'reconcile',
          id: f.partnerBank,
          version: version + 1,
          expectedBalance: nov.summary.closingBalance,
          balance: nov.summary.closingBalance + 300,
          note: '核对余额',
        };
        await assert.rejects(
          changeAccount(f.partner, { ...reconcile, effectiveDate: '2020-02-30' }),
          /日期无效/,
        );
        await changeAccount(f.partner, reconcile);
        assert.equal(
          (
            await c.query(
              'SELECT effective_date::text FROM account_adjustments WHERE account_id=$1 AND amount=300',
              [f.partnerBank],
            )
          ).rows[0].effective_date,
          recordingDate(),
        );
        const overview = await familyOverview(f.me, q);
        assert.deepEqual(
          overview.contributions.map(v => v.amount),
          [100000, 100000],
        );
        assert.equal(overview.openingBalance, 0);
        assert.equal(overview.surplus, 160000);
        const { NextRequest } = await import('next/server');
        const { applicationApi } = await import('../src/server/application-api');
        await c.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
        const denied = await applicationApi(
          new NextRequest('http://localhost/api/family-finance/overview?' + q),
          { params: Promise.resolve({ path: ['family-finance', 'overview'] }) },
          { id: randomUUID(), name: '访客', username: 'guest', admin: false, theme: 'bear', avatar: '' },
        );
        assert.equal(denied.status, 403);

        const bill = (
          await c.query(
            "UPDATE transactions SET line_items=$2 WHERE account_id=$1 AND kind='expense' RETURNING id",
            [
              f.familyWallet,
              JSON.stringify([
                { category: '居住', amount: 30000 },
                { category: '日用', amount: 10000 },
              ]),
            ],
          )
        ).rows[0].id;
        const filtered = (filters: Record<string, string>) =>
          report(f.shared, new URLSearchParams({ ...month, ...filters }));
        const match = await filtered({ category: '日用', min: '10000', max: '10000' });
        assert.equal(match.totals.expense, 10000);
        assert.equal(match.rows[0].matched_amount, 10000);
        assert.equal(
          (await filtered({ groupField: 'category', groupValue: '日用', min: '10001' })).totals.count,
          0,
        );
        assert.equal((await filtered({ min: '40000', max: '40000' })).totals.expense, 40000);
        await c.query(
          `INSERT INTO transactions(id,book_id,account_id,kind,amount,date,category,created_by,refund_of)
      VALUES($1,$2,$3,'refund',1000,'2026-11-13','居住',$4,$5)`,
          [randomUUID(), f.shared, f.familyWallet, f.partner, bill],
        );
        const common = await familyOverview(f.partner, q);
        assert.deepEqual(common.categories, [
          { name: '居住', amount: 29000 },
          { name: '日用', amount: 10000 },
        ]);
        assert.equal(common.commonExpense, 39000);
        await c.query(
          "INSERT INTO expense_claims(id,event_id,source_id,sender_id,recipient_id,status,target_id) VALUES($1,$2,$2,$3,$4,'accepted',$2)",
          [randomUUID(), bill, f.partner, f.me],
        );
        const claimed = await familyOverview(f.me, q);
        assert.deepEqual(claimed.categories, []);
        assert.equal(claimed.commonExpense, 0);
        assert.equal(claimed.claimedExpense, 39000);
        assert.equal(claimed.closingBalance, 161000);
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);
