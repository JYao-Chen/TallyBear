import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import pg from 'pg';
assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_memory_test'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const u = (
  await c.query(
    "SELECT id FROM users WHERE name='测试' AND EXISTS(SELECT 1 FROM members WHERE user_id=users.id) ORDER BY created_at DESC LIMIT 1",
  )
).rows[0];
await c.query("INSERT INTO deployment_settings(id,currency) VALUES(1,'CNY') ON CONFLICT DO NOTHING");
await c.query('UPDATE users SET admin=true WHERE id=$1', [u.id]);
const token = randomUUID();
await c.query(
  "INSERT INTO sessions VALUES(encode(sha256(convert_to($1,'UTF8')),'hex'),$2,now()+interval '1 hour')",
  [token, u.id],
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  const origin = process.env.TEST_ORIGIN || 'http://localhost:3119';
  await page
    .context()
    .addCookies([{ name: 'bubu_session', value: token, domain: new URL(origin).hostname, path: '/' }]);
  await page.goto(origin + '/me');
  await page.getByRole('tab', { name: '个人画像', exact: true }).click();
  await page
    .getByRole('navigation', { name: '个人画像栏目' })
    .getByRole('button', { name: '商品与服务' })
    .click();
  await page.getByLabel('搜索记忆', { exact: true }).waitFor();
  await page.getByRole('button', { name: '新增明确偏好' }).click();
  const label = '浏览器验证偏好 ' + randomUUID().slice(0, 8);
  await page.getByLabel('名称', { exact: true }).fill(label);
  await page.getByLabel('描述', { exact: true }).fill('订阅使用会员订阅分类');
  await page
    .getByRole('dialog', { name: '新增偏好' })
    .getByRole('button', { name: '保存', exact: true })
    .click();
  await page
    .getByRole('region', { name: '我的记忆' })
    .getByRole('combobox', { name: /^类型/ })
    .selectOption('preference');
  await page.getByText(label, { exact: true }).waitFor();
  await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: process.env.TEST_ARTIFACT_DIR + '/memory-' + width + '.png',
      fullPage: true,
    });
    const overflow = await page
      .getByRole('region', { name: '记忆中心', exact: true })
      .evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert.equal(overflow, false, `overflow ${width}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: memory center save and 360/390/1280 layouts without overflow');
} finally {
  await browser.close();
  await c.query('DELETE FROM sessions WHERE id=$1', [token]);
  await c.end();
}
