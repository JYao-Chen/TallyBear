import { bookMovements } from '@/server/family-books';
import { NextResponse } from 'next/server';
import type { Route } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/book-movements/:id',
    auth: 'user',
    handler: async ({ user: u, query, params }) => {
      return NextResponse.json(await bookMovements(u.id, params.id, query));
    },
  },
];
