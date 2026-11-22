// npm run test:db — recreate a local *_test database, then run every self-contained database test against it.
// TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5439/tallybear_test npm run test:db
import { testDatabaseUrl, recreateDatabase } from '../tests/helpers/test-database.mjs';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const url = testDatabaseUrl('TEST_DATABASE_URL');
await recreateDatabase(url);

// Tests that seed their own fixtures. Demo-data tests (CHAT_, FUNDS_) and the help index test need extra setup and stay opt-in.
const env = { ...process.env, MIGRATION_TEST_DATABASE_URL: url.toString() };
for (const key of [
  'ASSISTANT_ACTIONS',
  'HTTP',
  'JOBS',
  'STATS',
  'STATS_FAMILY',
  'STATS_PERF',
  'CASH',
  'DISCUSSION',
  'CLAIM',
  'PREFERENCE',
  'INLINE',
  'MOVEMENT',
  'WALLET_DELETE',
])
  env[key + '_TEST_DATABASE_URL'] = url.toString();
const files = readdirSync('tests')
  .filter(f => f.endsWith('-db.test.ts'))
  .sort()
  .map(f => 'tests/' + f);
const result = spawnSync(
  'npx',
  ['tsx', '--import', './tests/helpers/css-hooks.mjs', '--test', '--test-concurrency=1', ...files],
  {
    stdio: 'inherit',
    env,
  },
);
process.exit(result.status ?? 1);
