import { expenseClaims } from '@/server/expense-claims';
import { NextResponse } from 'next/server';
import { type Route, type UserHandler } from '../handler';
const handle: UserHandler = async ({ user: u, req, path, body, query }) =>
  NextResponse.json(await expenseClaims(u.id, req.method, path, body, query));
export const routes: Route[] = [
  { method: 'GET', pattern: '/expense-claims/people', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/expense-claims/inbox', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/expense-claims/sent', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/expense-claims/for-record', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/expense-claims/invite', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/expense-claims/:id/receipts', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/expense-claims/:id', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/expense-claims/:id', auth: 'user', handler: handle },
];
