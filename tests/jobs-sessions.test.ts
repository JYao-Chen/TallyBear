import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { newPassword } from '../src/server/auth';
import { checkDeploymentCurrency } from '../src/server/deployment';
import { deployment } from '../src/lib/deployment';
import { withConnection } from '../src/server/db';

test('新密码最短八位，保留原有长度上限', () => {
  for (const password of ['', '1234567']) assert.throws(() => newPassword.parse(password), /密码至少 8 位/);
  assert.equal(newPassword.parse('12345678'), '12345678');
  assert.equal(newPassword.safeParse('a'.repeat(201)).success, false);
});

test('币种校验失败后重试，并发和后续请求复用成功的 Promise', async () => {
  let queries = 0;
  const client = {
    async query() {
      queries++;
      return { rows: queries === 1 ? [] : [{ currency: deployment().currency }] };
    },
  } as unknown as PoolClient;
  await withConnection(client, async () => {
    await assert.rejects(checkDeploymentCurrency(), /does not match database currency \(unset\)/);
    const pending = checkDeploymentCurrency();
    assert.equal(checkDeploymentCurrency(), pending);
    assert.deepEqual(await pending, deployment());
    assert.equal(checkDeploymentCurrency(), pending);
    assert.equal(queries, 2);
  });
});
