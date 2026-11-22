import { listInstallments, changeInstallment } from '@/server/installments';
import { NextResponse } from 'next/server';
import type { Route } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/installments',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(await listInstallments(u.id));
    },
  },
  {
    method: 'POST',
    pattern: '/installments',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await changeInstallment(u.id, body));
    },
  },
];
