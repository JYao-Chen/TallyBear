import assert from 'node:assert/strict';
import test from 'node:test';
import type { Draft } from '../src/components/DraftReview';
import { missingEntryFields } from '../src/lib/missing-entry-fields';

const credit = [{ id: 'credit', type: 'credit' }];
const draft: Draft = {
  id: 'draft',
  kind: 'expense',
  date: '2026-11-23',
  amount: 3200,
  accountId: 'credit',
  category: '餐饮',
  payee: '',
  note: '',
};

test('draft cards require a date, credit wallet and explicit installment fees', () => {
  assert.deepEqual(missingEntryFields({ ...draft, date: '', installment: { firstDate: '' } }, []), [
    '分期期数',
    '首次还款日期',
    '总手续费',
    '信用账户',
    '交易日期',
  ]);
  assert.deepEqual(
    missingEntryFields({ ...draft, installment: { terms: 3, firstDate: draft.date, fees: 0 } }, credit),
    [],
  );
});
test('draft cards respect skip, enrichment and transfer requirements', () => {
  assert.deepEqual(missingEntryFields({ ...draft, date: '', action: 'skip' }, []), []);
  assert.deepEqual(
    missingEntryFields({ ...draft, date: '', action: 'merge', mergeId: 'old', mergeVersion: 1 }, []),
    [],
  );
  assert.deepEqual(missingEntryFields({ ...draft, kind: 'transfer', targetId: 'credit' }, credit), [
    '转入账户',
  ]);
});
