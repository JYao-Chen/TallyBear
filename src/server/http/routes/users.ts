import { manageUser, avatar } from '@/server/management';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/server/db';
import { newPassword, passwordHash } from '@/server/auth';
import { type Route, name } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/users',
    auth: 'admin',
    handler: async () => {
      return NextResponse.json(
        (await db.query('SELECT id,username,name,admin,avatar,disabled FROM users ORDER BY created_at')).rows,
      );
    },
  },
  {
    method: 'PATCH',
    pattern: '/users',
    auth: 'admin',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await manageUser(u, body));
    },
  },
  {
    method: 'POST',
    pattern: '/users',
    auth: 'admin',
    handler: async ({ body }) => {
      const b = z
        .object({
          username: name,
          name,
          password: newPassword,
          avatar: avatar.default('🧸'),
        })
        .parse(body);
      await db.query('INSERT INTO users(id,username,name,password,avatar) VALUES($1,$2,$3,$4,$5)', [
        randomUUID(),
        b.username,
        b.name,
        passwordHash(b.password),
        b.avatar,
      ]);
      return NextResponse.json({ ok: true });
    },
  },
];
