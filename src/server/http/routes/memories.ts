import { memoryRoute } from '@/server/memory';
import { NextResponse } from 'next/server';
import { type Route, methods } from '../handler';

export const routes: Route[] = [
  ...methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    pattern: '/memories',
    auth: 'user',
    handler: async ({ user: u, query, body, req }) => {
      return NextResponse.json(await memoryRoute(u, req.method, query, body));
    },
  }),
];
