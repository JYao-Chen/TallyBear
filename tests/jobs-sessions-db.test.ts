import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { NextRequest } from 'next/server';
import { readEvents } from '../src/lib/events';

test('任务事件与会话', { skip: !process.env.JOBS_TEST_DATABASE_URL }, async t => {
  const base = new URL(process.env.JOBS_TEST_DATABASE_URL!);
  assert.equal(base.hostname, '127.0.0.1');
  assert.match(base.pathname, /^\/[a-z0-9_]+_test$/);
  const name = 'jobs_' + randomBytes(8).toString('hex') + '_test';
  const admin = new pg.Client({ connectionString: base.href });
  await admin.connect();
  await admin.query('CREATE DATABASE ' + name);
  t.after(async () => {
    try {
      await admin.query('DROP DATABASE ' + name + ' WITH (FORCE)');
    } finally {
      await admin.end();
    }
  });
  base.pathname = '/' + name;
  process.env.DATABASE_URL = base.href;
  process.env.APP_ORIGIN = 'http://localhost';
  process.env.APP_CURRENCY = 'CNY';
  const { db } = await import('../src/server/db');
  const { authenticate, passwordHash, sessionUser, sessionDigest } = await import('../src/server/auth');
  const { executeJob, cleanupExpiredSessions } = await import('../src/server/job-worker');
  const { watchJob } = await import('../src/server/jobs');
  const { dispatch } = await import('../src/server/http/router');
  const uid = randomUUID(),
    job = randomUUID(),
    oldJob = randomUUID();
  const token = randomBytes(32).toString('hex');
  try {
    await db.query(await readFile('migrations/0001_baseline.sql', 'utf8'));
    await db.query("INSERT INTO users(id,username,name,password) VALUES($1,'legacy','用户',$2)", [
      uid,
      passwordHash('old'),
    ]);
    await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [token, uid]);
    await db.query(
      "INSERT INTO ai_jobs(id,user_id,kind,payload,status) VALUES($1,$3,'assistant','{}','complete'),($2,$3,'chat','{}','running')",
      [oldJob, job, uid],
    );
    await db.query(
      `INSERT INTO ai_job_events(job_id,event,data) VALUES($1,'delta','"old"'),($2,'delta','"initial"')`,
      [oldJob, job],
    );
    await db.query(await readFile('migrations/0002_jobs_sessions.sql', 'utf8'));
    await db.query("INSERT INTO deployment_settings VALUES(1,'CNY')");

    await t.test('旧 cookie 迁移后可用，库中摘要不能作为 cookie 登录', async () => {
      assert.equal((await db.query('SELECT id FROM sessions')).rows[0].id, sessionDigest(token));
      assert.equal((await sessionUser(token)).id, uid);
      await assert.rejects(sessionUser(sessionDigest(token)), /过期/);
    });

    await t.test('活跃订阅随通知收到事件，终态清理后仍返回结果', async () => {
      assert.deepEqual((await db.query('SELECT job_id FROM ai_job_events')).rows, [{ job_id: job }]);
      const controller = new AbortController();
      const response = watchJob(job, controller.signal);
      assert.equal(response.headers.get('X-Task-Id'), job);
      const events: { event: string; data: unknown }[] = [];
      const reading = readEvents(response.body!, raw => events.push(JSON.parse(raw)));
      async function waitFor(data: string) {
        const until = Date.now() + 1400;
        while (!events.some(e => e.data === data) && Date.now() < until) await delay(10);
        assert.ok(
          events.some(e => e.data === data),
          'missing event: ' + data,
        );
      }
      try {
        await waitFor('initial');
        const second = watchJob(job, controller.signal);
        const listeners = async () =>
          (
            await db.query(
              "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND query='LISTEN ai_job_events' AND state='idle'",
            )
          ).rows;
        async function listenerPid(previous?: number) {
          const until = Date.now() + 4000;
          while (Date.now() < until) {
            const rows = await listeners();
            if (rows.length && rows[0].pid !== previous) {
              assert.equal(rows.length, 1);
              return rows[0].pid as number;
            }
            await delay(10);
          }
          throw new Error('LISTEN connection did not become ready');
        }
        const pid = await listenerPid();
        await second.body!.cancel();
        await db.query('SELECT pg_terminate_backend($1)', [pid]);
        await listenerPid(pid);
        // Two consecutive wakes distinguish delivery from the catch-up read on reconnect.
        for (const data of ['live', 'next']) {
          await db.query(
            `WITH inserted AS (
               INSERT INTO ai_job_events(job_id,event,data) VALUES($1,'delta',$2) RETURNING job_id
             ) SELECT pg_notify('ai_job_events',job_id::text) FROM inserted`,
            [job, JSON.stringify(data)],
          );
          await waitFor(data);
        }
        const running = (await db.query('SELECT * FROM ai_jobs WHERE id=$1', [job])).rows[0];
        await executeJob({ ...running, cancel_requested: true });
        await reading;
        const final = events.at(-1)!;
        assert.equal(final.event, 'done');
        assert.equal((final.data as { status: string }).status, 'stopped');
        assert.equal((await db.query('SELECT 1 FROM ai_job_events WHERE job_id=$1', [job])).rowCount, 0);
        for (const [id, expected] of [
          [job, 'done'],
          [oldJob, 'complete'],
        ]) {
          const replay: string[] = [];
          await readEvents(watchJob(id, controller.signal).body!, raw => replay.push(JSON.parse(raw).event));
          assert.deepEqual(replay, ['task', 'status', expected]);
        }
      } finally {
        controller.abort();
        await reading;
      }
    });

    await t.test('worker 非空批次和终态各通知一次，失败任务重连返回 error', async () => {
      const listener = new pg.Client({ connectionString: base.href });
      await listener.connect();
      try {
        const notifications: string[] = [];
        listener.on('notification', message => notifications.push(message.payload!));
        await listener.query('LISTEN ai_job_events');
        const id = randomUUID();
        const running = (
          await db.query(
            "INSERT INTO ai_jobs(id,user_id,kind,payload,status) VALUES($1,$2,'connection','{}','running') RETURNING *",
            [id, uid],
          )
        ).rows[0];
        // The non-admin user fails before a model connection is attempted.
        await executeJob(running);
        await listener.query('SELECT 1');
        assert.deepEqual(notifications, [id, id]);
        const replay: { event: string; data: unknown }[] = [];
        await readEvents(watchJob(id, new AbortController().signal).body!, raw =>
          replay.push(JSON.parse(raw)),
        );
        assert.deepEqual(
          replay.map(e => e.event),
          ['task', 'status', 'error'],
        );
        assert.equal(replay.at(-1)?.data, '需要管理员权限');
      } finally {
        await listener.end();
      }
    });

    await t.test('旧短密码能登录，成功只清用户名计数，第 31 次失败返回 429', async () => {
      const headers = {
        origin: process.env.APP_ORIGIN!,
        'x-forwarded-for': '192.0.2.1, 192.0.2.2',
        'x-real-ip': '192.0.2.3',
      };
      async function login(username: string) {
        return dispatch(
          new NextRequest('http://localhost/api/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username, password: 'bad' }),
          }),
          ['login'],
        );
      }
      assert.equal((await login('legacy')).status, 401);
      assert.equal(await authenticate('legacy', 'old', new Headers(headers)), uid);
      assert.deepEqual((await db.query('SELECT scope,username,count FROM login_attempts')).rows, [
        // X-Real-IP is set by the proxy; the left part of X-Forwarded-For is client-supplied.
        { scope: 'ip', username: '192.0.2.3', count: 1 },
      ]);
      for (let i = 1; i < 30; i++) assert.equal((await login('unknown' + i)).status, 401);
      assert.equal((await login('unknown30')).status, 429);
      await db.query("UPDATE login_attempts SET window_start=now()-interval '16 minutes' WHERE scope='ip'");
      assert.equal((await login('unknown30')).status, 401);
    });

    await t.test('清理过期会话和一天前的限流记录', async () => {
      await db.query("INSERT INTO sessions VALUES('expired',$1,now()-interval '1 minute')", [uid]);
      await db.query(
        "INSERT INTO login_attempts(username,window_start) VALUES('stale',now()-interval '25 hours')",
      );
      await cleanupExpiredSessions();
      assert.deepEqual((await db.query('SELECT id FROM sessions')).rows, [{ id: sessionDigest(token) }]);
      assert.equal((await db.query("SELECT 1 FROM login_attempts WHERE username='stale'")).rowCount, 0);
      assert.equal((await db.query("SELECT 1 FROM login_attempts WHERE scope='ip'")).rowCount, 1);
    });
  } finally {
    await db.end();
  }
});
