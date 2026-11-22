import { costProjects } from '@/server/cost-projects';
import { NextResponse } from 'next/server';
import { type Route, type UserHandler } from '../handler';
const handle: UserHandler = async ({ user: u, req, path, body, query }) =>
  NextResponse.json(await costProjects(u.id, req.method, path, body, query));
export const routes: Route[] = [
  { method: 'GET', pattern: '/cost-projects/report', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-projects/options', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-projects/sources', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/preview', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-projects', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-projects/:id/movements', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/settlement-transfer', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/personal-offsets', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/respond', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/display', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/settlements', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/cost-projects/:id/archive', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/cost-projects/:id', auth: 'user', handler: handle },
  { method: 'PUT', pattern: '/cost-projects/:id', auth: 'user', handler: handle },
];
