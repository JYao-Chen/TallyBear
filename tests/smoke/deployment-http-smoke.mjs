import './database.mjs';
import { migrate, migrateWith } from '../../scripts/migrate.mjs';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let child;
try {
  await migrate(client);
  await client.query("INSERT INTO deployment_settings VALUES(1,'USD')");
  child = spawn(process.execPath, ['.next/standalone/server.js'], {
    env: {
      ...process.env,
      APP_LANGUAGE: 'en',
      APP_CURRENCY: 'USD',
      PORT: '3017',
      HOSTNAME: '127.0.0.1',
      APP_ORIGIN: 'http://127.0.0.1:3017',
    },
    stdio: 'ignore',
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:3017/api/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  assert.ok(ready, 'isolated English/USD server starts');
  for (const language of ['en', 'zh-CN']) {
    const r = await fetch('http://127.0.0.1:3017', {
      headers: { 'Accept-Language': language, Cookie: 'bubu_language=' + language },
    });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /<html[^>]*lang="en"/);
    assert.match(html, /data-currency="USD"/);
    assert.doesNotMatch(html, /class="language-switch"/);
  }
  await client.query("UPDATE deployment_settings SET currency='CNY'");
  const mismatch = await fetch('http://127.0.0.1:3017/api/health');
  assert.equal(mismatch.status, 500, 'mismatched currency blocks access');
  console.log(
    'PASS: isolated English/USD deployment ignores Chinese cookies; database currency mismatch rejected',
  );
} finally {
  if (child) {
    child.kill('SIGTERM');
    await new Promise(r => child.once('exit', r));
  }
  await client.end();
}
