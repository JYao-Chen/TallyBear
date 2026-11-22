import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWalletFunds, fundRowsPage, type FundEvent } from '../src/lib/wallet-funds';
const accounts = [
  { id: 'a', opening: 200000 },
  { id: 'b', opening: 0 },
];
const event = (
  id: string,
  kind: FundEvent['kind'],
  amount: number,
  extra: Partial<FundEvent> = {},
): FundEvent => ({
  id,
  kind,
  amount,
  date: '2026-10-04',
  sourceId: 'a',
  targetId: null,
  title: 'Record',
  counterparty: 'Yier',
  sourceName: 'WeChat',
  targetName: '',
  note: '',
  origin: 'transaction',
  ...extra,
});
const report = (events: FundEvent[]) => summarizeWalletFunds(events, accounts, '2026-10-01', '2026-10-31');
test('家庭转账进入资金口径，不混进消费；真实示例净流出1179.53', () => {
  const r = report([
    event('expense', 'expense', 109653),
    event('out', 'transfer', 14000, { targetId: 'other', origin: 'family' }),
    event('in', 'transfer', 5700, { sourceId: 'other', targetId: 'a', origin: 'family' }),
  ]);
  assert.equal(r.summary.expense, 109653);
  assert.equal(r.summary.transferOut, 14000);
  assert.equal(r.summary.transferIn, 5700);
  assert.equal(r.summary.flowChange, -117953);
  assert.equal(r.summary.closingBalance, 82047);
});
test('自有现金钱包互转净抵消；别人的流水排除', () => {
  const r = report([
    event('own', 'transfer', 10000, { targetId: 'b' }),
    event('foreign', 'expense', 999999, { sourceId: 'other' }),
  ]);
  assert.equal(r.summary.internalTransfer, 10000);
  assert.equal(r.summary.inflow, 0);
  assert.equal(r.summary.outflow, 0);
  assert.equal(r.summary.flowChange, 0);
  assert.equal(r.rows.length, 1);
});
test('退款、收入和校准分离，期初期末余额可还原', () => {
  const r = report([
    event('before', 'expense', 5000, { date: '2026-09-30' }),
    event('income', 'income', 10000),
    event('refund', 'refund', 2000),
    event('expense', 'expense', 6000),
    event('adjust', 'adjustment', -500, { origin: 'adjustment' }),
    event('future', 'expense', 999, { date: '2026-11-01' }),
  ]);
  assert.equal(r.summary.openingBalance, 195000);
  assert.equal(r.summary.flowChange, 6000);
  assert.equal(r.summary.adjustment, -500);
  assert.equal(r.summary.closingBalance, 200500);
  assert.equal(r.summary.balanceChange, 5500);
});
test('单钱包范围的转出转入正确，信用余额可为负', () => {
  const r = summarizeWalletFunds(
    [
      event('credit', 'expense', 3000),
      event('repay', 'transfer', 1000, { sourceId: 'outside', targetId: 'a' }),
    ],
    [{ id: 'a', opening: 0 }],
    '2026-10-01',
    '2026-10-31',
  );
  assert.equal(r.summary.closingBalance, -2000);
  assert.equal(r.summary.transferIn, 1000);
});
test('搜索分页保留完整期间汇总，可以按成员、钱包、支付编号和方向筛选', () => {
  const r = report(
    Array.from({ length: 25 }, (_, i) =>
      event(String(i), 'transfer', 100, { targetId: 'other', reference: 'PAY-' + i, origin: 'family' }),
    ),
  );
  const p = fundRowsPage(r.rows, new URLSearchParams({ q: 'Yier', flow: 'out' }));
  assert.equal(p.count, 25);
  assert.equal(p.rows.length, 20);
  assert.equal(p.hasMore, true);
  assert.equal(r.summary.outflow, 2500);
  assert.equal(fundRowsPage(r.rows, new URLSearchParams({ q: 'PAY-24' })).count, 1);
  assert.equal(fundRowsPage(r.rows, new URLSearchParams({ flow: 'in' })).count, 0);
});

test('808.47信用卡还款在全部钱包、单钱包及方向筛选中一致', () => {
  const events = [
    event('repay', 'transfer', 80847, { targetId: 'b', targetType: 'credit', title: '11月招商银行还款' }),
  ];
  const all = summarizeWalletFunds(
    events,
    [
      { id: 'a', opening: 200000 },
      { id: 'b', opening: -100000, type: 'credit' },
    ],
    '2026-10-01',
    '2026-10-31',
  );
  assert.equal(all.summary.transferOut, 80847);
  assert.equal(all.summary.transferIn, 0);
  assert.equal(all.summary.outflow, 80847);
  assert.equal(all.summary.inflow, 0);
  assert.equal(all.summary.flowChange, -80847);
  assert.equal(all.summary.closingBalance, 100000);
  assert.equal(all.summary.expense, 0);
  assert.deepEqual(all.daily, [
    { date: '2026-10-04', inflow: 0, outflow: 80847, adjustment: 0, delta: -80847 },
  ]);
  for (const flow of ['out', 'repayment'])
    assert.equal(fundRowsPage(all.rows, new URLSearchParams({ flow })).count, 1);
  const bank = summarizeWalletFunds(events, [{ id: 'a', opening: 200000 }], '2026-10-01', '2026-10-31');
  assert.equal(bank.summary.outflow, 80847);
  assert.equal(bank.summary.closingBalance, 119153);
  const credit = summarizeWalletFunds(
    events,
    [{ id: 'b', opening: -100000, type: 'credit' }],
    '2026-10-01',
    '2026-10-31',
  );
  assert.equal(credit.summary.inflow, 0);
  assert.equal(credit.summary.closingBalance, -19153);
});

test('信用卡消费和退款只改变负债；还款改变现金，净资产按原账还原', () => {
  const accounts = [
    { id: 'a', opening: 100000, type: 'bank' },
    { id: 'b', opening: 0, type: 'credit' },
  ];
  const events = [
    event('buy', 'expense', 10000, { sourceId: 'b' }),
    event('refund', 'refund', 2000, { sourceId: 'b' }),
    event('repay', 'transfer', 5000, { targetId: 'b', targetType: 'credit' }),
  ];
  const r = summarizeWalletFunds(events, accounts, '2026-10-01', '2026-10-31');
  assert.equal(r.summary.expense, 0);
  assert.equal(r.summary.refund, 0);
  assert.equal(r.summary.outflow, 5000);
  assert.equal(r.summary.flowChange, -5000);
  assert.equal(r.summary.repayment, 5000);
  assert.equal(r.summary.cashOpeningBalance, 100000);
  assert.equal(r.summary.cashClosingBalance, 95000);
  assert.equal(r.summary.closingBalance, 92000);
  assert.equal(r.summary.balanceChange, -8000);
  assert.equal(r.rows.find(r => r.id === 'buy')?.delta, 0);
  assert.equal(r.rows.find(r => r.id === 'buy')?.balanceDelta, -10000);
  const later = summarizeWalletFunds(events, accounts, '2026-10-05', '2026-10-31');
  assert.equal(later.summary.cashOpeningBalance, 95000);
  assert.equal(later.summary.openingBalance, 92000);
});
