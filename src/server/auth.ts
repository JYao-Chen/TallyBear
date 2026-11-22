import { Failure, type User } from './access';
export { Failure, member, type User } from './access';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db, transaction } from './db';
export const newPassword = z.string().min(8, '密码至少 8 位').max(200);

export function sessionDigest(token: string | undefined) {
  if (!token) throw new Failure('请先登录', 401);
  return createHash('sha256').update(token).digest('hex');
}

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const b = Buffer.from(hash, 'hex');
  const a = scryptSync(password, salt, 64);
  return b.length === a.length && timingSafeEqual(a, b);
}
export async function user(): Promise<User> {
  const token = (await cookies()).get('bubu_session')?.value;
  return sessionUser(token);
}
export async function sessionUser(token: string | undefined): Promise<User> {
  const { rows } = await db.query(
    'SELECT u.id,u.username,u.name,u.admin,u.avatar,u.theme FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now() AND NOT u.disabled',
    [sessionDigest(token)],
  );
  if (!rows[0]) throw new Failure('登录已过期，请重新登录', 401);
  return rows[0];
}
export async function session(id: string) {
  const token = randomBytes(32).toString('hex');
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [sessionDigest(token), id]);
  (await cookies()).set('bubu_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.APP_ORIGIN?.startsWith('https://'),
    path: '/',
    maxAge: 604800,
  });
}

export async function authenticate(username: string, password: string, headers: Headers) {
  // nginx sets X-Real-IP; the left part of X-Forwarded-For is client-supplied, so only its last hop is trusted.
  const ip =
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    'unknown';
  const outcome = await transaction(async c => {
    // Reserve each attempt under a row lock so concurrent requests share the same limits.
    async function reserve(scope: 'ip' | 'username', key: string, limit: number) {
      const row = await c.query(
        `INSERT INTO login_attempts(scope,username,count) VALUES($1,$2,1)
         ON CONFLICT(scope,username) DO UPDATE SET
           count=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.count+1 END,
           window_start=CASE WHEN login_attempts.count=0 OR login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END
         WHERE login_attempts.count<$3 OR login_attempts.window_start<now()-interval '15 minutes'`,
        [scope, key, limit],
      );
      return row.rowCount === 1;
    }
    if (!(await reserve('ip', ip, 30)) || !(await reserve('username', username, 15))) return { status: 429 };
    const account = (await c.query('SELECT id,password,disabled FROM users WHERE username=$1', [username]))
      .rows[0];
    if (!account || account.disabled || !verifyPassword(password, account.password)) {
      return { status: 401 };
    }
    await c.query("UPDATE login_attempts SET count=count-1 WHERE scope='ip' AND username=$1", [ip]);
    await c.query("DELETE FROM login_attempts WHERE scope='username' AND username=$1", [username]);
    return { id: account.id as string };
  });
  if (outcome.status === 429) throw new Failure('登录尝试过多，请15分钟后再试', 429);
  if (outcome.status === 401) throw new Failure('账号或密码不正确', 401);
  return outcome.id!;
}
