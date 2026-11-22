import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import { testDatabaseUrl } from './helpers/test-database.mjs';
import suite from './smoke/suite.json' with { type: 'json' };

test('every smoke entry point has a runner disposition', () => {
  const files = readdirSync(new URL('./smoke/', import.meta.url)).filter(
    name => /\.(?:tsx?|mjs)$/.test(name) && name !== 'database.mjs',
  );
  assert.deepEqual(Object.keys(suite).sort(), files.sort());
});

test('the runner and individual smokes require an explicit local test database', () => {
  const key = 'SMOKE_URL_VALIDATION_FIXTURE';
  try {
    assert.throws(() => testDatabaseUrl(key), /请设置/);
    for (const raw of [
      'postgres://example.org/ledger_test',
      'postgres://127.0.0.1/ledger',
      'postgres://127.0.0.1/ledger_test?host=example.org',
      'postgres://127.0.0.1/ledger_test?dbname=ledger',
      'postgres://127.0.0.1/' + 'x'.repeat(64) + '_test',
    ]) {
      process.env[key] = raw;
      assert.throws(() => testDatabaseUrl(key), /只允许/);
    }
    process.env[key] = 'postgres://tb:x@127.0.0.1:55486/custom_test';
    assert.equal(testDatabaseUrl(key).pathname, '/custom_test');
  } finally {
    delete process.env[key];
  }
});
