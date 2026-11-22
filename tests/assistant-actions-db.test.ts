import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { migrate } from '../scripts/migrate.mjs';
import { testDatabaseUrl } from './helpers/test-database.mjs';
import type { AgentArtifact } from '../src/server/finance-agent';

test(
  'assistant execution, confirmation, scoped history and versioned undo',
  { skip: !process.env.ASSISTANT_ACTIONS_TEST_DATABASE_URL },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl('ASSISTANT_ACTIONS_TEST_DATABASE_URL').href;
    const origin = (process.env.APP_ORIGIN = 'http://localhost');
    const { db, withConnection } = await import('../src/server/db');
    const { dispatch } = await import('../src/server/http/router');
    const { executeFinanceTool } = await import('../src/server/finance-agent');
    const { confirmChatAction } = await import('../src/server/chat-actions');
    const c = await db.connect();
    try {
      await migrate(c);
      await c.query('BEGIN');
      await withConnection(c, async () => {
        const user = {
          id: randomUUID(),
          username: 'actions-test',
          name: '测试',
          admin: false,
          theme: 'bear' as const,
          avatar: '',
        };
        const book = randomUUID(),
          wallet = randomUUID(),
          conversation = randomUUID(),
          turnId = randomUUID();
        await c.query("INSERT INTO deployment_settings VALUES(1,'CNY') ON CONFLICT DO NOTHING");
        await c.query("INSERT INTO users(id,username,name,password) VALUES($1,$2,$3,'unused')", [
          user.id,
          user.username,
          user.name,
        ]);
        await c.query("INSERT INTO books(id,name,kind,owner_id) VALUES($1,'测试账本','private',$2)", [
          book,
          user.id,
        ]);
        await c.query("INSERT INTO members VALUES($1,$2,'owner')", [book, user.id]);
        await c.query(
          "INSERT INTO accounts(id,name,type,ownership,owner_id) VALUES($1,'现金','cash','personal',$2)",
          [wallet, user.id],
        );
        await c.query("INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,'测试')", [
          conversation,
          book,
          user.id,
        ]);
        await c.query(
          "INSERT INTO finance_turns(id,conversation_id,question,status) VALUES($1,$2,'记账','complete')",
          [turnId, conversation],
        );
        const ctx = { user, book, turnId, images: [], signal: new AbortController().signal };
        const artifacts: AgentArtifact = { charts: [], drafts: [], tools: [], actions: [] };
        const tool = (name: string, args: unknown) => executeFinanceTool(name, args, ctx, artifacts);
        async function api(path: string, actor = user, status = 200) {
          const undo = path.endsWith('/undo');
          const res = await dispatch(
            new NextRequest(origin + '/api/' + path, {
              method: undo ? 'POST' : 'GET',
              headers: { origin },
              body: undo ? '{}' : undefined,
            }),
            path.split('?')[0].split('/'),
            actor,
          );
          const value = await res.json();
          assert.equal(res.status, status, JSON.stringify(value));
          return value;
        }
        const create = (title: string) =>
          tool('prepare_action', {
            kind: 'entry',
            bookId: book,
            data: {
              title,
              kind: 'expense',
              accountId: wallet,
              amount: 456,
              date: '2026-11-01',
              category: '其他',
            },
          });
        const execute = (id: string) => tool('execute_action', { actionId: id, acknowledgeWarnings: true });
        const change = (id: string, operation: string, title?: string) =>
          tool('prepare_transaction_change', {
            bookId: book,
            transactionId: id,
            operation,
            changes: title ? { title } : {},
          });
        const state = async (id: string) =>
          (await c.query('SELECT title,deleted,version FROM transactions WHERE id=$1', [id])).rows[0];
        const history = () => api('assistant-actions?limit=50');
        const undo = (id: string) => api('assistant-actions/' + id + '/undo');
        const first = await create('第一笔');
        await execute(first.action.id);
        const [log] = await history();
        assert.equal(log.risk, 'write');
        assert.equal(log.status, 'success');
        assert.equal(log.canUndo, true);
        const stranger = { ...user, id: randomUUID() };
        assert.deepEqual(await api('assistant-actions', stranger), []);
        assert.equal((await api('assistant-actions/' + log.id + '/undo', stranger, 404)).code, 'not_found');
        await undo(log.id);
        assert.equal((await state(first.action.id)).deleted, true);
        await undo(log.id);
        assert.equal((await history())[0].status, 'undone');
        const second = (await create('原始标题')).action;
        await execute(second.id);
        const edit = await change(second.id, 'update', '修改标题');
        await execute(edit.id);
        assert.equal((await state(second.id)).title, '修改标题');
        const editLog = (await history()).find(
          (r: { operation: string }) => r.operation === 'transaction_update',
        );
        await undo(editLog.id);
        assert.equal((await state(second.id)).title, '原始标题');
        const edit2 = await change(second.id, 'update', '再次修改');
        await execute(edit2.id);
        await c.query("UPDATE transactions SET title='人工修改',version=version+1 WHERE id=$1", [second.id]);
        const conflict = (await history()).find(
          (r: { operation: string; status: string }) =>
            r.operation === 'transaction_update' && r.status === 'success',
        );
        assert.equal((await api('assistant-actions/' + conflict.id + '/undo', user, 409)).code, 'conflict');
        assert.equal((await state(second.id)).title, '人工修改');
        const deletion = await change(second.id, 'delete');
        assert.equal((await execute(deletion.id)).status, 'pending');
        assert.equal((await state(second.id)).deleted, false);
        assert.equal((await history()).length, 4);
        await confirmChatAction(book, user, {
          operation: 'confirm_action',
          id: conversation,
          turnId,
          actionId: deletion.id,
        });
        assert.equal((await state(second.id)).deleted, true);
        const deletionLog = (await history()).find(
          (r: { operation: string }) => r.operation === 'transaction_delete',
        );
        assert.equal(deletionLog.risk, 'confirm');
        await undo(deletionLog.id);
        assert.equal((await state(second.id)).deleted, false);
        const prep = await tool('prepare_system_action', {
          operation: 'draft_save',
          params: {
            bookId: book,
            section: 'invalid',
            version: 0,
            value: { nested: [{ apiKey: 'private' }] },
          },
        });
        await assert.rejects(execute(prep.id));
        const failed = (
          await c.query(
            "SELECT params,status FROM assistant_action_log WHERE operation='draft_save' AND user_id=$1",
            [user.id],
          )
        ).rows[0];
        assert.equal(failed.status, 'failed');
        assert.deepEqual(failed.params.value, { nested: [{}] });
      });
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db.end();
    }
  },
);
