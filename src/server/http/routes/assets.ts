import { walletEntryDelete } from '@/server/wallet-entry-delete';
import { mergeAccounts } from '@/server/merge-accounts';
import { NextResponse } from 'next/server';
import { listAssets, createAccount, accountHistory, changeAccount, accountReport } from '@/server/accounts';
import { type Route, methods, uuid } from '../handler';

export const routes: Route[] = [
  ...methods(['GET', 'DELETE'], {
    pattern: '/assets/funds/entry',
    auth: 'user',
    handler: async ({ user: u, query, body, req }) => {
      return NextResponse.json(
        await walletEntryDelete(u.id, req.method, req.method === 'GET' ? { id: query.get('id') } : body),
      );
    },
  }),
  {
    method: 'GET',
    pattern: '/assets/funds',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json((await accountReport(u.id, query)).funds);
    },
  },
  {
    method: 'POST',
    pattern: '/assets/merge',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await mergeAccounts(u.id, body));
    },
  },
  {
    method: 'GET',
    pattern: '/assets/report',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await accountReport(u.id, query));
    },
  },
  {
    method: 'GET',
    pattern: '/assets/history',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      return NextResponse.json(await accountHistory(u.id, uuid.parse(query.get('account'))));
    },
  },
  {
    method: 'GET',
    pattern: '/assets',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(await listAssets(u.id));
    },
  },
  {
    method: 'POST',
    pattern: '/assets',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await createAccount(u.id, body));
    },
  },
  {
    method: 'PATCH',
    pattern: '/assets',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await changeAccount(u.id, body));
    },
  },
];
