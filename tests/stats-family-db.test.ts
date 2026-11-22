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
    const { expenseClaims } = await import('../src/server/expense-claims');
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
        const before = randomUUID(),
          after = randomUUID();
        await c.query(
          `INSERT INTO transactions(id,book_id,account_id,kind,amount,date,occurred_at,created_by)
           VALUES($1,$3,$4,'expense',100,'2026-11-28','09:59',$5),($2,$3,$4,'income',100,'2026-11-28','10:01',$5)`,
          [before, after, f.partnerBook, f.partnerBank, f.partner],
        );
        const { NextRequest } = await import('next/server');
        const { dispatch } = await import('../src/server/http/router');
        await c.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
        for (const [id, expected] of [
          [before, 389900],
          [after, 390700],
        ] as const) {
          const response = await dispatch(
            new NextRequest(`http://localhost/api/books/${f.partnerBook}/transaction-balance?id=${id}`),
            ['books', f.partnerBook, 'transaction-balance'],
            { id: f.partner, name: '伴侣', username: 'partner', admin: false, theme: 'bear', avatar: '' },
          );
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), [
            { account_id: f.partnerBank, name: '伴侣银行卡', balance: expected },
          ]);
        }
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
        const denied = await dispatch(
          new NextRequest('http://localhost/api/family-finance/overview?' + q),
          ['family-finance', 'overview'],
          { id: randomUUID(), name: '访客', username: 'guest', admin: false, theme: 'bear', avatar: '' },
        );
        assert.equal(denied.status, 403);

        const bill = (
          await c.query(
            "UPDATE transactions SET line_items=$2 WHERE account_id=$1 AND kind='expense' RETURNING id",
            [
              f.familyWallet,
              JSON.stringify([
                { name: '房租', category: '居住', amount: 30000 },
                { name: '日用品', category: '日用', amount: 10000 },
              ]),
            ],
          )
        ).rows[0].id;
        const { consumptionRows } = await import('../src/server/domain/stats/projection');
        const ownership = async () =>
          (
            await c.query(
              consumptionRows({
                fields: 't.id,t.kind',
                joins: 'transactions t JOIN accounts a ON a.id=t.account_id',
                where: 't.id=$1',
                categoryPredicate: 'TRUE',
              }),
              [bill],
            )
          ).rows[0];
        const projected = await ownership();
        assert.equal(projected.event_key, bill);
        assert.equal(projected.attributed_owner, 'family:' + f.family);
        assert.deepEqual(projected.payments, [{ wallet: f.familyWallet, date: '2026-11-12' }]);
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
        const request = (user: string, method: string, path: string, body = {}, params = {}): Promise<any> =>
          expenseClaims(user, method, ['expense-claims', path], body, new URLSearchParams(params));
        const invite = (user: string, recipientId: string | null) =>
          request(user, 'POST', 'invite', { sourceId: bill, recipientId });
        const outsider = randomUUID(),
          otherFamily = randomUUID();
        await c.query(
          "INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,'访客','unused')",
          [outsider],
        );
        await c.query("INSERT INTO families(id,name,owner_id) VALUES($1,'另一个家庭',$2)", [
          otherFamily,
          f.me,
        ]);
        await c.query('INSERT INTO family_members VALUES($1,$2),($1,$3)', [otherFamily, outsider, f.me]);
        await c.query("INSERT INTO members VALUES($1,$2,'editor')", [f.shared, outsider]);
        await assert.rejects(invite(outsider, f.me), /权限/);
        await assert.rejects(invite(f.me, outsider), /同一家庭/);
        const people = await request(f.me, 'GET', 'people', {}, { familyId: f.family });
        assert.deepEqual(new Set(people.map((p: { id: string }) => p.id)), new Set([f.me, f.partner]));
        await c.query("UPDATE members SET role='viewer' WHERE book_id=$1 AND user_id=$2", [f.shared, f.me]);
        const access = await request(f.me, 'GET', 'for-record', {}, { id: bill });
        assert.equal(access.canInvite, true);
        assert.equal(access.canEdit, false);
        const invitation = await invite(f.me, f.partner);
        const pending = await request(f.partner, 'GET', invitation.id);
        assert.equal(pending.claim.status, 'pending');
        assert.equal((await familyOverview(f.me, q)).commonExpense, 39000);
        await assert.rejects(invite(f.partner, null), /原发起人/);
        await request(f.partner, 'POST', invitation.id, {
          operation: 'accept',
          version: pending.claim.version,
          bookId: f.shared,
        });
        assert.equal((await familyOverview(f.me, q)).commonExpense, 0);
        const accepted = await request(f.me, 'GET', invitation.id);
        await request(f.me, 'POST', invitation.id, {
          operation: 'withdraw',
          version: accepted.claim.version,
        });
        assert.equal((await familyOverview(f.me, q)).commonExpense, 39000);
        const self = await invite(f.me, f.me);
        const own = await request(f.me, 'GET', self.id);
        assert.equal(own.claim.status, 'accepted');
        assert.equal(own.claim.target_id, bill);
        assert.equal((await invite(f.me, f.me)).id, self.id);
        assert.equal((await ownership()).attributed_owner, f.me);
        const claimed = await familyOverview(f.me, q);
        assert.deepEqual(claimed.categories, []);
        assert.equal(claimed.commonExpense, 0);
        assert.equal(claimed.claimedExpense, 39000);
        assert.equal(claimed.closingBalance, 161000);
        await request(f.me, 'POST', self.id, { operation: 'withdraw', version: own.claim.version });
        assert.equal((await familyOverview(f.me, q)).commonExpense, 39000);
        await c.query('DELETE FROM members WHERE book_id=$1 AND user_id=$2', [f.shared, f.me]);
        await assert.rejects(invite(f.me, f.me), /可编辑的账本/);
        const privateClaim = await request(f.me, 'POST', 'invite', {
          sourceId: bill,
          recipientId: f.me,
          bookId: f.myBook,
        });
        const moved = await request(f.me, 'GET', privateClaim.id);
        assert.equal(moved.targetBookId, f.myBook);
        assert.equal((await familyOverview(f.me, q)).commonExpense, 0);
        await c.query('DELETE FROM family_members WHERE family_id=$1 AND user_id=$2', [f.family, f.me]);
        assert.equal((await request(f.me, 'GET', privateClaim.id)).claim.status, 'withdrawn');
        assert.equal((await familyOverview(f.partner, q)).commonExpense, 39000);
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);
