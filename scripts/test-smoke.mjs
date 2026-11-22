import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { migrate } from './migrate.mjs';
import { recreateDatabase, testDatabaseUrl } from '../tests/helpers/test-database.mjs';
import suite from '../tests/smoke/suite.json' with { type: 'json' };

const url = testDatabaseUrl('TEST_DATABASE_URL');
const env = {
  PATH: process.env.PATH,
  APP_ORIGIN: 'http://127.0.0.1:3016',
  TZ: 'Asia/Shanghai',
  SMOKE_DATABASE_URL: url.toString(),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};
let passed = 0,
  skipped = 0,
  failed = 0;
for (const [file, mode] of Object.entries(suite)) {
  if (mode !== 'db' && mode !== 'unit') {
    console.log(`跳过 ${file} — ${mode}`);
    skipped++;
    continue;
  }
  if (mode === 'db') {
    await recreateDatabase(url);
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    try {
      await migrate(client);
      await client.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY')");
    } finally {
      await client.end();
    }
  }
  console.log(`运行 ${file}`);
  const directory = mkdtempSync(join(process.cwd(), '.smoke-'));
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'tests/smoke/' + file], {
      stdio: 'inherit',
      env: { ...env, TMPDIR: directory, RECEIPT_DIR: join(directory, 'receipts') },
    });
    if (result.status === 0) passed++;
    else {
      console.error(`失败 ${file}`);
      failed++;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
console.log(`冒烟结果：通过 ${passed}，跳过 ${skipped}，失败 ${failed}`);
process.exitCode = failed ? 1 : 0;
