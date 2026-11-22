import { prepareHelp, searchHelp } from '@/server/help';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Route } from '../handler';

export const routes: Route<Record<string, unknown>, string>[] = [
  {
    auth: 'user',
    method: 'GET',
    pattern: '/help',
    query: z
      .instanceof(URLSearchParams)
      .transform(p => p.get('q') || '')
      .pipe(z.string().max(300)),
    handler: async ({ user: u, req, query: q, locale }) => {
      return NextResponse.json(
        q.trim() ? await searchHelp(u.id, q, locale, req.signal) : await prepareHelp(u.id),
      );
    },
  },
];
