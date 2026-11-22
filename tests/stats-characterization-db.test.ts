import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { migrate } from '../scripts/migrate.mjs';
import { householdMonth } from './helpers/household-month';

// Characterization: pins what each statistics basis reports today for one synthetic month, including the
// known defects listed in docs/refactor/STATS-BASIS.md. A fix must change the matching expectation on purpose.
test(
  '统计口径特征：同一个月在 A–F 各口径下的结果',
  { skip: !process.env.STATS_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.STATS_TEST_DATABASE_URL!);
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(url.pathname.endsWith('_test'));
    process.env.DATABASE_URL = url.toString();
    const { db, withConnection } = await import('../src/server/db');
    const { report, personalExpenseReport, personalWalletReport } = await import('../src/server/reports');
    const { accountReport } = await import('../src/server/accounts');
    const { activityReport } = await import('../src/server/activities');
    const c = await db.connect();
    try {
      await migrate(c);
      await c.query('BEGIN');
      await withConnection(c, async () => {
        const f = await householdMonth(c);
        const month = { from: '2026-11-01', to: '2026-11-30' };
        const q = (v: Record<string, string> = {}) =>
          new URLSearchParams({ ...month, limit: '1', offset: '0', ...v });
        const totals = (r: any) => ({
          income: r.totals.income,
          expense: r.totals.expense,
          refund: r.totals.refund,
          categories: Object.fromEntries(
            r.categories.map((x: any) => [x.name ?? x.category, x.value ?? x.amount]),
          ),
        });
        const assets = (r: any) => ({
          income: r.summary.income,
          expense: r.summary.expense,
          refund: r.summary.refund,
          cashPaid: r.summary.cashPaid,
          debtPurchases: r.summary.debtPurchases,
          netAssets: r.summary.netAssets,
          funds: Object.fromEntries(
            [
              'income',
              'expense',
              'refund',
              'transferIn',
              'transferOut',
              'internalTransfer',
              'repayment',
              'adjustment',
              'inflow',
              'outflow',
              'balanceChange',
            ].map(k => [k, r.funds.summary[k]]),
          ),
        });
        const actual = {
          A_myBook: totals(await report([f.myBook], q(), f.me)),
          A_myBook_cashflow: totals(await report([f.myBook], q({ basis: 'cashflow' }), f.me)),
          A_shared: totals(await report([f.shared], q(), f.me)),
          A_allMyBooks: totals(await report([f.myBook, f.shared], q(), f.me)),
          B_myExpense: totals(await personalExpenseReport(f.me, q())),
          B_partnerExpense: totals(await personalExpenseReport(f.partner, q())),
          C_myWallets: totals(await personalWalletReport(f.me, q())),
          D_myAssets: assets(await accountReport(f.me, new URLSearchParams({ ...month, owner: 'personal' }))),
          D_family: assets(await accountReport(f.me, new URLSearchParams({ ...month, owner: f.family }))),
          F_activity: totals(await activityReport(f.me, f.activity, new URLSearchParams())),
        };
        if (process.env.PRINT_STATS) writeFileSync(process.env.PRINT_STATS, JSON.stringify(actual, null, 1));
        assert.deepEqual(actual, EXPECTED);
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);

// Cents. Hand-checked against tests/helpers/household-month.ts on 2026-11-22.
const EXPECTED = {
  // A, period basis: cash 200 + credit 300 + 1/12 of the 1,200 annual fee; refund 50 nets 购物 to 250.
  // P2-5: the 50 gift to the partner is not an expense here.
  A_myBook: {
    income: 800000,
    expense: 60000,
    refund: 5000,
    categories: { 购物: 25000, 餐饮: 20000, 会员: 10000 },
  },
  // A, cash basis: the whole annual fee lands in November.
  A_myBook_cashflow: {
    income: 800000,
    expense: 170000,
    refund: 5000,
    categories: { 会员: 120000, 购物: 25000, 餐饮: 20000 },
  },
  A_shared: { income: 0, expense: 100000, refund: 0, categories: { 餐饮: 60000, 居住: 40000 } },
  A_allMyBooks: {
    income: 800000,
    expense: 160000,
    refund: 5000,
    categories: { 餐饮: 80000, 居住: 40000, 购物: 25000, 会员: 10000 },
  },
  // B: my shared-book dinner counts fully as mine (no claim, P2-9).
  // P1-1: the 400 family-wallet bill belongs to nobody — neither B_myExpense nor B_partnerExpense has 居住.
  B_myExpense: {
    income: 800000,
    expense: 120000,
    refund: 5000,
    categories: { 餐饮: 80000, 购物: 25000, 会员: 10000 },
  },
  B_partnerExpense: { income: 0, expense: 15000, refund: 0, categories: { 交通: 15000 } },
  // C, cash basis on my wallets: still no gift.
  C_myWallets: {
    income: 800000,
    expense: 230000,
    refund: 5000,
    categories: { 会员: 120000, 餐饮: 80000, 购物: 25000 },
  },
  // D/E: the gift is an expense here (P2-5); cashPaid = cash spending 2,050 + repayment 250 (P1-4).
  // The 30 adjustment moves the balance but no income/expense line (P1-2).
  D_myAssets: {
    income: 800000,
    expense: 235000,
    refund: 5000,
    cashPaid: 230000,
    debtPurchases: 30000,
    netAssets: 1473000,
    funds: {
      income: 800000,
      expense: 205000,
      refund: 0,
      transferIn: 0,
      transferOut: 125000,
      internalTransfer: 25000,
      repayment: 25000,
      adjustment: 3000,
      inflow: 800000,
      outflow: 330000,
      balanceChange: 473000,
    },
  },
  // Family wallet: both contribution styles arrive as transfers in.
  D_family: {
    income: 0,
    expense: 40000,
    refund: 0,
    cashPaid: 40000,
    debtPurchases: 0,
    netAssets: 160000,
    funds: {
      income: 0,
      expense: 40000,
      refund: 0,
      transferIn: 200000,
      transferOut: 0,
      internalTransfer: 0,
      repayment: 0,
      adjustment: 0,
      inflow: 200000,
      outflow: 40000,
      balanceChange: 160000,
    },
  },
  // F: whole purchase, no period spreading; the unlinked refund is not part of the activity (P2-6).
  F_activity: { income: 0, expense: 30000, refund: 0, categories: { 购物: 30000 } },
};
