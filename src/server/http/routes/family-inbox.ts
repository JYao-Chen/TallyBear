import { familyInbox } from '@/server/family-inbox';
import { NextResponse } from 'next/server';
import type { Route } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/family-inbox',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await familyInbox(u.id, query));
    },
  },
];
