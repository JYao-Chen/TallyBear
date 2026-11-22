import assert from 'node:assert/strict';
import test from 'node:test';
import { copyEntryDraft, resolveEntryDetail } from '../src/lib/entry-detail';
import type { LedgerRow } from '../src/lib/ledger-types';
const row = { id: 'entry', book_id: 'source-book', amount: 100, version: 1, title: '统计投影' } as LedgerRow;
test('all entry points resolve the current original amount, fields and mutation version', async () => {
  const result = await resolveEntryDetail(row, 'current-book', async (book, id) => {
    assert.equal(book, 'source-book');
    assert.equal(id, 'entry');
    return [{ ...row, amount: 5000, version: 4, title: '完整账单', note: '原始备注' }];
  });
  assert.equal(result.amount, 5000);
  assert.equal(result.version, 4);
  assert.equal(result.title, '完整账单');
  assert.equal(result.note, '原始备注');
});
test('missing source fails instead of editing a stale report row', async () => {
  await assert.rejects(
    resolveEntryDetail(row, 'book', async () => []),
    /记录不存在或已删除/,
  );
});
test('movements and allocated cost summaries retain their own source operations', async () => {
  for (const special of [
    { ...row, family_movement_id: 'movement' },
    { ...row, cost_row_key: 'legacy:event:month' },
  ]) {
    assert.equal(
      await resolveEntryDetail(special, 'book', async () => {
        throw Error('invalid transaction lookup');
      }),
      special,
    );
  }
});

test('copy keeps integer amounts and wallet routing while assigning new record and item identities', () => {
  let seq = 0;
  const source = {
    ...row,
    kind: 'transfer' as const,
    account_id: 'checking',
    target_id: 'cash',
    external_id: 'bank-ref',
    order_id: 'merchant-order',
    activity_id: 'trip',
    line_items: [{ id: 'original-item', name: 'Meal', quantity: null, unitPrice: null, amount: 100 }],
  };
  const draft = copyEntryDraft(source, '2026-11-23', () => String(++seq));
  assert.equal(draft.action, 'create');
  assert.equal(draft.id, '1');
  assert.equal(draft.date, '2026-11-23');
  assert.equal(draft.amount, 100);
  assert.equal(draft.accountId, 'checking');
  assert.equal(draft.targetId, 'cash');
  assert.equal(draft.activityId, 'trip');
  assert.equal(draft.lineItems?.[0].id, '2');
  assert.equal(source.line_items[0].id, 'original-item');
  for (const key of ['externalId', 'orderId', 'version', 'event_id']) assert.ok(!(key in draft));
});
