import { costSchedules } from '@/server/cost-schedules';
import { NextResponse } from 'next/server';
import { type Route, type UserHandler } from '../handler';
const handle: UserHandler = async ({ user: u, req, path, body, query }) =>
  NextResponse.json(await costSchedules(u.id, req.method, path, body, query));
export const routes: Route[] = [
  { method: 'GET', pattern: '/cost-schedules', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-schedules/:id', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-schedules/:id/history', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/receive', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/respond', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/edit', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/pause', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/confirm', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-schedules/:id/skip', auth: 'user', handler: handle },
];
