import { familyFinance } from '@/server/family-finance';
import { NextResponse } from 'next/server';
import { familyOverview } from '@/server/reports';
import { type Route, methods } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/family-finance/overview',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await familyOverview(u.id, query));
    },
  },
  ...methods(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], {
    pattern: '/family-finance/:id',
    auth: 'user',
    handler: async ({ user: u, body, params, req }) => {
      return NextResponse.json(await familyFinance(u.id, params.id, req.method, body));
    },
  }),
];
