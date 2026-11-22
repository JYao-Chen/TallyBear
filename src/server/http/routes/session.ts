import { profile } from '@/server/management';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db, transaction } from '@/server/db';
import {
  session,
  sessionDigest,
  authenticate,
  newPassword,
  passwordHash,
  verifyPassword,
  Failure,
} from '@/server/auth';
import { type Route, methods, name } from '../handler';
const loginBody = z.object({ username: name, password: z.string().min(1).max(200) });
const login: Route<z.infer<typeof loginBody>> = {
  method: 'POST',
  pattern: '/login',
  auth: 'public',
  body: loginBody,
  handler: async ({ req, body }) => {
    await session(await authenticate(body.username, body.password, req.headers));
    return NextResponse.json({ ok: true });
  },
};
export const routes: Route[] = [
  ...methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    pattern: '/health',
    auth: 'public',
    handler: async () => {
      await db.query('SELECT 1');
      return NextResponse.json({ ok: true, app: 'tallybear' });
    },
  }),
  login,
  {
    method: 'PATCH',
    pattern: '/me',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      const t = z.enum(['bear', 'minimal']).parse(body.theme);
      await db.query('UPDATE users SET theme=$1 WHERE id=$2', [t, u.id]);
      return NextResponse.json({ ok: true, theme: t });
    },
  },
  {
    method: 'GET',
    pattern: '/me',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(u);
    },
  },
  {
    method: 'PUT',
    pattern: '/me',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await profile(u, body));
    },
  },
  {
    method: 'POST',
    pattern: '/logout',
    auth: 'user',
    handler: async () => {
      const jar = await cookies();
      await db.query('DELETE FROM sessions WHERE id=$1', [sessionDigest(jar.get('bubu_session')?.value)]);
      jar.delete('bubu_session');
      return NextResponse.json({ ok: true });
    },
  },
  {
    method: 'PUT',
    pattern: '/password',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      const b = z.object({ oldPassword: z.string(), newPassword }).parse(body);
      const row = (await db.query('SELECT password FROM users WHERE id=$1', [u.id])).rows[0];
      if (!verifyPassword(b.oldPassword, row.password)) throw new Failure('当前密码不正确', 403);
      const token = (await cookies()).get('bubu_session')?.value;
      await transaction(async c => {
        await c.query('UPDATE users SET password=$1 WHERE id=$2', [passwordHash(b.newPassword), u.id]);
        await c.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2', [u.id, sessionDigest(token)]);
      });
      return NextResponse.json({ ok: true });
    },
  },
];
