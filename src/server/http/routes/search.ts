import { search } from '@/server/search';
import { NextResponse } from 'next/server';
import type { Route } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/search',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await search(u.id, query));
    },
  },
];
