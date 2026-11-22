import pg from 'pg';

export function testDatabaseUrl(variable) {
  const raw = process.env[variable];
  if (!raw) throw new Error(`请设置 ${variable}，指向本机可重建的测试库`);
  const url = new URL(raw);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) ||
    url.pathname.length > 64 ||
    url.search
  )
    throw new Error('只允许 127.0.0.1 上以 _test 结尾的数据库，请勿附加连接参数');
  return url;
}

export async function recreateDatabase(url) {
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}
