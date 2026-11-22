import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { NextRequest } from 'next/server';
import { dispatch, matchRoute, routes } from '../src/server/http/router';
import { assistantOperations } from '../src/server/assistant-operations';
import { errorResponse } from '../src/server/http/errors';
import { Failure } from '../src/server/access';

// Method and access inventory from the catch-all and its delegated domain handlers.
const inventory = `
admin /ai-settings GET PUT POST
admin /assistant-ai-settings GET PUT POST
admin /queue-settings GET PUT POST PATCH DELETE
admin /users GET PATCH POST
public /health GET POST PUT PATCH DELETE
public /login POST
user /activities GET POST PUT PATCH DELETE
user /activities/:id GET
user /activities/assign PUT
user /activities/entry GET
user /assets GET POST PATCH
user /assets/funds GET
user /assets/funds/entry GET DELETE
user /assets/history GET
user /assets/merge POST
user /assets/report GET
user /book-movements/:id GET
user /books GET POST
user /books/:book/accounts GET
user /books/:book/allocations GET PUT
user /books/:book/assistant POST
user /books/:book/attention GET
user /books/:book/budgets GET PUT DELETE
user /books/:book/categories GET PUT
user /books/:book/chart-details GET
user /books/:book/chat GET POST PUT PATCH DELETE
user /books/:book/drafts GET PUT
user /books/:book/export GET
user /books/:book/members GET POST DELETE
user /books/:book/metadata PUT
user /books/:book/move GET POST
user /books/:book/organize GET POST
user /books/:book/photos POST DELETE
user /books/:book/receipts GET
user /books/:book/refund-options GET
user /books/:book/report GET
user /books/:book/reuse POST
user /books/:book/review POST
user /books/:book/schedules GET PUT POST PATCH DELETE
user /books/:book/templates GET POST PUT DELETE PATCH
user /books/:book/transaction-balance GET
user /books/:book/transactions GET POST PUT PATCH DELETE
user /cost-projects GET POST
user /cost-projects/:id GET PUT
user /cost-projects/:id/archive POST
user /cost-projects/:id/display POST
user /cost-projects/:id/movements GET
user /cost-projects/:id/personal-offsets POST
user /cost-projects/:id/respond POST
user /cost-projects/:id/settlement-transfer POST
user /cost-projects/:id/settlements POST
user /cost-projects/options GET
user /cost-projects/preview POST
user /cost-projects/report GET
user /cost-projects/sources GET
user /cost-schedules GET POST
user /cost-schedules/:id GET
user /cost-schedules/:id/confirm POST
user /cost-schedules/:id/edit POST
user /cost-schedules/:id/history GET
user /cost-schedules/:id/pause POST
user /cost-schedules/:id/receive POST
user /cost-schedules/:id/respond POST
user /cost-schedules/:id/skip POST
user /discussions GET
user /discussions/inbox GET
user /discussions/messages POST
user /discussions/read POST
user /expense-claims/:id GET POST
user /expense-claims/:id/receipts GET
user /expense-claims/for-record GET
user /expense-claims/inbox GET
user /expense-claims/invite POST
user /expense-claims/people GET
user /expense-claims/sent GET
user /families GET POST
user /families/:id GET PUT DELETE
user /families/:id/access PUT
user /families/:id/books POST DELETE
user /families/:id/invitation POST
user /families/:id/invitations POST DELETE
user /families/:id/members DELETE
user /families/:id/owner PUT
user /family-finance/:id GET POST PUT DELETE PATCH
user /family-finance/overview GET
user /family-inbox GET
user /help GET
user /installments GET POST
user /jobs GET
user /jobs/:id GET POST
user /jobs/:id/retry POST
user /jobs/:id/cancel POST
user /logout POST
user /me PATCH GET PUT
user /memories GET POST PUT PATCH DELETE
user /password PUT
user /personal-profile GET POST PUT PATCH DELETE
user /receipts POST GET
user /receipts/:id GET
user /search GET
user /search-options GET
`;
test('each legacy endpoint resolves to its registered pattern and access level', () => {
  const expected: string[] = [];
  for (const row of inventory.trim().split('\n')) {
    const [auth, pattern, ...methods] = row.split(' ');
    const path = pattern
      .slice(1)
      .split('/')
      .map(s => (s.startsWith(':') ? 'e554fe1a-02c7-4ebc-9f6c-abf54619fe2e' : s));
    for (const method of methods) {
      const key = method + ' ' + pattern;
      const match = matchRoute(method, path);
      assert.equal(match?.route.pattern, pattern, key);
      assert.equal(match.route.auth, auth, key);
      expected.push(key);
    }
  }
  assert.deepEqual(routes.map(r => r.method + ' ' + r.pattern).sort(), expected.sort());
  assert.equal(new Set(expected).size, expected.length);
});

test('every assistant operation has an internal dispatch target', () => {
  for (const [name, op] of Object.entries(assistantOperations)) {
    const path = op.path
      .split('/')
      .map(s => (s.startsWith(':') ? '6012966d-3b12-4fa9-b6ba-dae4825d3272' : s));
    assert.ok(matchRoute(op.method, path), name);
  }
});

test('HTTP boundary checks the origin, identity and actual bytes before business logic', async t => {
  const origin = 'http://localhost';
  t.mock.method(pg.Pool.prototype, 'query', async (sql: string) => {
    assert.equal(sql, 'SELECT currency FROM deployment_settings WHERE id=1');
    return { rows: [{ currency: 'CNY' }] };
  });
  process.env.APP_ORIGIN = origin;
  process.env.APP_CURRENCY = 'CNY';
  const get = (path: string) => dispatch(new NextRequest(origin + '/api/' + path), path.split('/'));
  const post = (
    path: string,
    body: BodyInit,
    headers: Record<string, string> = {},
    actor?: Parameters<typeof dispatch>[2],
  ) =>
    dispatch(
      new NextRequest(origin + '/api/' + path, { method: 'POST', body, headers: { origin, ...headers } }),
      path.split('/'),
      actor,
    );
  async function check(r: Response, status: number, code: string) {
    assert.equal(r.status, status);
    const json = await r.json();
    assert.equal(json.code, code);
    assert.equal(typeof json.error, 'string');
  }
  await check(await get('unknown'), 404, 'not_found');
  await check(await get('books/id/unknown'), 404, 'not_found');
  await check(await post('login', '{}', { origin: 'http://other.test' }), 403, 'forbidden');
  const actor = {
    id: 'test',
    username: 'test',
    name: '用户',
    theme: 'bear' as const,
    avatar: '',
    admin: false,
  };
  await check(await post('books', '!', { origin: 'http://other.test' }, actor), 403, 'forbidden');
  await check(await post('users', '!', {}, actor), 403, 'forbidden');
  await check(await post('books', '!'), 401, 'unauthorized');
  await check(await post('login', '{}', { 'content-length': '36000000' }), 400, 'validation');
  const chunk = new Uint8Array(1_000_000);
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(chunk);
      if (++sent === 36) controller.close();
    },
  });
  await check(await post('login', stream, { 'content-length': '1' }), 413, 'too_large');
  await check(await post('login', '{'), 500, 'internal');
});

test('domain and database errors retain the message and expose stable codes', async () => {
  for (const [error, status, code, message] of [
    [new Failure('请先登录', 401), 401, 'unauthorized', '请先登录'],
    [new Failure('登录尝试过多', 429), 429, 'rate_limited', '登录尝试过多'],
    [new Failure('版本改变', 409), 409, 'conflict', '版本改变'],
    [Object.assign(new Error('版本冲突'), { code: 'P0001' }), 409, 'conflict', '版本冲突'],
    [{ code: '23505' }, 409, 'conflict', '名称或账号已存在'],
    [{ code: '23503' }, 400, 'validation', '账户不存在或不属于当前账本'],
    ...['CostPlanError', 'VerificationError'].map(
      name =>
        [Object.assign(new Error('填写内容无效'), { name }), 400, 'validation', '填写内容无效'] as const,
    ),
  ] as const) {
    const response = errorResponse(error, 'zh-CN');
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: message, code });
  }
});
