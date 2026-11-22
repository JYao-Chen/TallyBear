import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { recordingDate } from '../src/lib/entry-time';
import { migrate } from '../scripts/migrate.mjs';
import { householdMonth } from './helpers/household-month';

test(
  '确认卡同时采用账本和钱包时，保存两项偏好依据',
  { skip: !process.env.PREFERENCE_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.PREFERENCE_TEST_DATABASE_URL!);
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(url.pathname.endsWith('_test'));
    process.env.DATABASE_URL = url.toString();
    const { db, withConnection } = await import('../src/server/db');
    const { prepareChatAction, parseAction } = await import('../src/server/chat-actions');
    const { entry } = await import('../src/server/model');
    const { insertEntry } = await import('../src/server/ledger');
    const c = await db.connect();
    try {
      await migrate(c);
      await c.query('BEGIN');
      await withConnection(c, async () => {
        const f = await householdMonth(c);
        const data = {
          kind: 'expense',
          amount: 2300,
          date: recordingDate(),
          payee: '面馆',
          title: '午餐',
          scene: { type: 'dining', merchant: '面馆', meal: '午餐' },
        };
        for (let i = 0; i < 4; i++)
          await insertEntry(
            c,
            f.myBook,
            f.me,
            entry.parse({ ...data, id: randomUUID(), category: '餐饮', accountId: f.myBank }),
          );
        const card = await prepareChatAction(
          { kind: 'entry', data },
          {
            book: f.shared,
            user: { id: f.me, name: '我', username: 'test', theme: 'bear', admin: false, avatar: '' },
            useHistory: true,
          },
          [],
        );
        assert.equal(card.bookId, f.myBook);
        assert.equal(card.data.accountId, f.myBank);
        await insertEntry(c, card.bookId, f.me, entry.parse(parseAction(card)));
        const stored = (
          await c.query('SELECT preference_suggestions FROM transactions WHERE id=$1', [card.id])
        ).rows[0].preference_suggestions;
        for (const [field, value] of [
          ['bookId', f.myBook],
          ['accountId', f.myBank],
        ]) {
          assert.ok(
            stored.some(
              (s: { field: string; value: string; state: string }) =>
                s.field === field && s.value === value && s.state === 'applied',
            ),
            field,
          );
        }
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);
