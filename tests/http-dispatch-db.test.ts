import 'next/dist/server/node-environment-baseline';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createWorkStore } from 'next/dist/server/async-storage/work-store';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { migrate } from '../scripts/migrate.mjs';
import { testDatabaseUrl } from './helpers/test-database.mjs';

test('internal dispatch and login / me / logout', { skip: !process.env.HTTP_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl('HTTP_TEST_DATABASE_URL').href;
  const origin = 'http://localhost';
  process.env.APP_ORIGIN = origin;
  process.env.APP_CURRENCY = 'CNY';
  const { db, withConnection } = await import('../src/server/db');
  const { passwordHash } = await import('../src/server/auth');
  const { dispatch } = await import('../src/server/http/router');
  const c = await db.connect();
  try {
    await migrate(c);
    await c.query('BEGIN');
    await withConnection(c, async () => {
      const actor = {
        id: randomUUID(),
        username: 'http-test',
        name: '测试用户',
        admin: false,
        theme: 'bear' as const,
        avatar: '🧸',
      };
      const password = 'test-password';
      await c.query("INSERT INTO deployment_settings VALUES(1,'CNY') ON CONFLICT DO NOTHING");
      await c.query('INSERT INTO users(id,username,name,password,avatar) VALUES($1,$2,$3,$4,$5)', [
        actor.id,
        actor.username,
        actor.name,
        passwordHash(password),
        actor.avatar,
      ]);
      function request(method: string, path: string, body?: unknown, cookie = '') {
        return new NextRequest(origin + '/api/' + path, {
          method,
          headers: { origin, cookie },
          body: JSON.stringify(body),
        });
      }
      async function api(method: string, path: string, body?: unknown, status = 200) {
        const res = await dispatch(request(method, path, body), path.split('?')[0].split('/'), actor);
        const json = await res.json();
        assert.equal(res.status, status, JSON.stringify(json));
        return json;
      }
      function keys(data: object, ...fields: string[]) {
        assert.deepEqual(Object.keys(data).sort(), fields.sort());
      }
      const book = await api('POST', 'books', { name: '账本', kind: 'private' });
      keys(book, 'id');
      const account = await api('POST', 'assets', { name: '现金', type: 'cash' });
      keys(account, 'id');
      const record = {
        id: randomUUID(),
        accountId: account.id,
        kind: 'expense',
        amount: 1234,
        date: '2026-11-01',
      };
      const entries = 'books/' + book.id + '/transactions';
      assert.deepEqual(await api('POST', entries, { entries: [record] }), {
        added: 1,
        merged: 0,
        skipped: 0,
      });
      const dates = 'from=2026-11-01&to=2026-11-30';
      const report = await api('GET', 'books/' + book.id + '/report?basis=cashflow&' + dates);
      keys(report, 'accountingScope', 'rows', 'totals', 'categories', 'daily', 'groups');
      assert.equal(report.totals.expense, 1234);
      const changed = await api('PUT', entries, { ...record, amount: 2345, version: report.rows[0].version });
      keys(changed, 'version', 'book');
      assert.equal(changed.book, book.id);
      assert.equal(
        (await api('DELETE', entries, { id: record.id, version: changed.version - 1 }, 409)).code,
        'conflict',
      );
      keys(await api('DELETE', entries, { id: record.id, version: changed.version }), 'version');
      assert.deepEqual(await api('GET', 'book-movements/' + book.id + '?' + dates), { rows: [], total: 0 });
      const family = await api('POST', 'families', { name: '测试家庭' });
      const finance = await api('GET', 'family-finance/' + family.id);
      keys(finance, 'userId', 'people', 'wallets', 'movements', 'expenses', 'books', 'defaultBookId');
      assert.deepEqual(finance.movements, []);
      assert.deepEqual(await api('GET', 'expense-claims/inbox'), { rows: [], total: 0 });
      await c.query("INSERT INTO ai_jobs(id,user_id,kind,payload) VALUES($1,$2,'connection','{}')", [
        randomUUID(),
        actor.id,
      ]);
      const [job] = await api('GET', 'jobs');
      keys(
        job,
        'id',
        'kind',
        'status',
        'stage',
        'error',
        'book_id',
        'book_name',
        'created_at',
        'started_at',
        'finished_at',
      );
      const { runOperation } = await import('../src/server/assistant-operations');
      for (const [operation, status] of [
        ['job_cancel', 'cancelled'],
        ['job_retry', 'queued'],
      ]) {
        assert.deepEqual(await runOperation({ operation, params: { id: job.id } }, actor, true), {
          ok: true,
        });
        assert.equal((await api('GET', 'jobs/' + job.id)).status, status);
      }
      keys(await api('GET', 'search?q=现金'), 'total', 'totals', 'groups', 'rows');

      // Supply the same request-local storage that Next uses for cookies() in route handlers.
      async function external(req: NextRequest) {
        const work = createWorkStore({
          page: '/api/[...path]/route',
          buildId: 'test',
          deploymentId: 'test',
          previouslyRevalidatedTags: [],
          renderOpts: {
            supportsDynamicResponse: true,
            cacheComponents: false,
            validationLevel: 'warning',
            cacheLifeProfiles: { default: { stale: 0, revalidate: 1, expire: 60 } },
            staticPageGenerationTimeout: 60,
            experimental: { authInterrupts: false, useCacheTimeout: 60 },
            onClose: () => {},
            waitUntil: undefined,
            onAfterTaskError: undefined,
          },
        });
        let setCookies: string[] = [];
        const store = createRequestStoreForAPI(
          req,
          req.nextUrl,
          { tags: [], expirationsByCacheKind: new Map() },
          values => {
            setCookies = values;
          },
          undefined,
          undefined,
        );
        const res = await workAsyncStorage.run(work, () =>
          workUnitAsyncStorage.run(store, () => dispatch(req, req.nextUrl.pathname.slice(5).split('/'))),
        );
        return { res, setCookies };
      }
      const login = await external(request('POST', 'login', { username: actor.username, password }));
      assert.equal(login.res.status, 200);
      assert.deepEqual(await login.res.json(), { ok: true });
      const cookie = login.setCookies.find(v => v.startsWith('bubu_session='))?.split(';')[0];
      assert.ok(cookie);
      const me = await external(request('GET', 'me', undefined, cookie));
      assert.equal(me.res.status, 200);
      assert.deepEqual(await me.res.json(), actor);
      const logout = await external(request('POST', 'logout', {}, cookie));
      assert.equal(logout.res.status, 200);
      assert.deepEqual(await logout.res.json(), { ok: true });
      assert.match(logout.setCookies[0], /^bubu_session=;/);
      assert.equal((await external(request('GET', 'me', undefined, cookie))).res.status, 401);
    });
  } finally {
    try {
      await c.query('ROLLBACK');
    } finally {
      c.release();
      await db.end();
    }
  }
});
