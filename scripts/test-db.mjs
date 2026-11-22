// npm run test:db — recreate a local *_test database, then run every self-contained database test against it.
// TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5439/tallybear_test npm run test:db
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const raw = process.env.TEST_DATABASE_URL;
if (!raw)
  throw new Error('请设置 TEST_DATABASE_URL，例如 postgres://user:pass@127.0.0.1:5439/tallybear_test');
const url = new URL(raw),
  name = url.pathname.slice(1);
if (url.hostname !== '127.0.0.1' || !/^[a-z0-9_]+_test$/.test(name))
  throw new Error('只允许 127.0.0.1 上以 _test 结尾的数据库');

const admin = new URL(url);
admin.pathname = '/postgres';
const c = new pg.Client({ connectionString: admin.toString() });
await c.connect();
try {
  await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${name}`);
} finally {
  await c.end();
}

// Tests that seed their own fixtures. Demo-data tests (CHAT_, FUNDS_) and the help index test need extra setup and stay opt-in.
const env = { ...process.env, MIGRATION_TEST_DATABASE_URL: url.toString() };
for (const key of ['STATS', 'CASH', 'DISCUSSION', 'CLAIM', 'INLINE', 'MOVEMENT', 'WALLET_DELETE'])
  env[key + '_TEST_DATABASE_URL'] = url.toString();
const files = readdirSync('tests')
  .filter(f => f.endsWith('-db.test.ts'))
  .sort()
  .map(f => 'tests/' + f);
const result = spawnSync('npx', ['tsx', '--test', '--test-concurrency=1', ...files], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
