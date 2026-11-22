import { discussions } from '@/server/discussions';
import { NextResponse } from 'next/server';
import { type Route, type UserHandler } from '../handler';
const handle: UserHandler = async ({ user: u, req, path, body, query }) =>
  NextResponse.json(await discussions(u.id, req.method, path, body, query));
export const routes: Route[] = [
  { method: 'GET', pattern: '/discussions/inbox', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/discussions/messages', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/discussions/read', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/discussions', auth: 'user', handler: handle },
];
