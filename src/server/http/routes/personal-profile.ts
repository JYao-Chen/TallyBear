import { personalProfileRoute } from '@/server/personal-profile';
import { NextResponse } from 'next/server';
import { type Route, methods } from '../handler';

export const routes: Route[] = [
  ...methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    pattern: '/personal-profile',
    auth: 'user',
    handler: async ({ user: u, query, body, req }) => {
      return NextResponse.json(await personalProfileRoute(u, req.method, query, body));
    },
  }),
];
