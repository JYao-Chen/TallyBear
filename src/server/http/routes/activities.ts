import {
  listActivities,
  changeActivity,
  activityReport,
  assignActivity,
  entryActivity,
} from '@/server/activities';
import { NextResponse } from 'next/server';
import { type Route, methods } from '../handler';

export const routes: Route[] = [
  {
    method: 'PUT',
    pattern: '/activities/assign',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await assignActivity(u.id, body));
    },
  },
  {
    method: 'GET',
    pattern: '/activities/entry',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await entryActivity(u.id, query.get('book') || '', query.get('id') || ''));
    },
  },
  {
    method: 'GET',
    pattern: '/activities/:id',
    auth: 'user',
    handler: async ({ user: u, query, params }) => {
      return NextResponse.json(await activityReport(u.id, params.id, query));
    },
  },
  {
    method: 'GET',
    pattern: '/activities',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(await listActivities(u.id));
    },
  },
  ...methods(['POST', 'PUT', 'PATCH', 'DELETE'], {
    pattern: '/activities',
    auth: 'user',
    handler: async ({ user: u, body, req }) => {
      return NextResponse.json(await changeActivity(u.id, req.method, body));
    },
  }),
];
