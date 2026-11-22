import { searchOptions } from '@/server/search';
import { NextResponse } from 'next/server';
import type { Route } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/search-options',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await searchOptions(u.id, query));
    },
  },
];
