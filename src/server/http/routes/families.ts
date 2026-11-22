import { families } from '@/server/families';
import { NextResponse } from 'next/server';
import { type Route, type UserHandler } from '../handler';
const handle: UserHandler = async ({ user: u, req, path, body }) =>
  NextResponse.json(await families(u.id, req.method, path, body));
export const routes: Route[] = [
  { method: 'GET', pattern: '/families', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/families', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/families/:id', auth: 'user', handler: handle },
  { method: 'PUT', pattern: '/families/:id', auth: 'user', handler: handle },
  { method: 'DELETE', pattern: '/families/:id', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/families/:id/invitation', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/families/:id/invitations', auth: 'user', handler: handle },
  { method: 'DELETE', pattern: '/families/:id/invitations', auth: 'user', handler: handle },
  { method: 'DELETE', pattern: '/families/:id/members', auth: 'user', handler: handle },
  { method: 'PUT', pattern: '/families/:id/owner', auth: 'user', handler: handle },
  { method: 'POST', pattern: '/families/:id/books', auth: 'user', handler: handle },
  { method: 'DELETE', pattern: '/families/:id/books', auth: 'user', handler: handle },
  { method: 'PUT', pattern: '/families/:id/access', auth: 'user', handler: handle },
];
