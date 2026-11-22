import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { type Route, methods } from '../handler';

export const routes: Route[] = [
  ...methods(['GET', 'PUT', 'POST', 'PATCH', 'DELETE'], {
    pattern: '/queue-settings',
    auth: 'admin',
    handler: async ({ body, req }) => {
      if (req.method === 'PUT') {
        const n = z.number().int().min(1).max(8).parse(body.concurrency);
        await db.query('UPDATE ai_queue_settings SET concurrency=$1 WHERE id=1', [n]);
      }
      return NextResponse.json(
        (await db.query('SELECT concurrency FROM ai_queue_settings WHERE id=1')).rows[0],
      );
    },
  }),
];
