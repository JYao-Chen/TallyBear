import { claimBookVisibility } from '@/server/claim-visibility';
import { detailOrder, detailSorts } from '@/lib/detail-sort';
import { itemReport } from '@/server/finance-items';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
import { search } from '@/server/search';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { member, type User } from '@/server/auth';
import { attachWalletBalances } from '@/server/wallet-history';
import { report, personalWalletReport, personalExpenseReport, exportCSV } from '@/server/reports';
import { type Route, uuid } from '../handler';

async function reportBooks(book: string, requested: string[], user: User) {
  const ids = requested.length
    ? z
        .array(z.string().uuid())
        .min(1)
        .parse([...new Set(requested)])
    : [book];
  for (const id of ids) await member(id, user);
  return ids;
}

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/books/:book/chart-details',
    auth: 'user',
    handler: async ({ user: u, query }) => {
      const p = query,
        metric = p.get('metric');
      const ids = z.array(z.string().uuid()).min(1).parse(p.getAll('book'));
      for (const id of ids) await member(id, u);
      if (metric && ['item_amount', 'unit_price', 'quantity'].includes(metric))
        return NextResponse.json(
          await itemReport(ids, p, u.id, metric as 'item_amount' | 'unit_price' | 'quantity'),
        );
      if (p.get('scope') === 'personal_wallet') return NextResponse.json(await personalWalletReport(u.id, p));
      if (p.get('scope') === 'personal_expense')
        return NextResponse.json(await personalExpenseReport(u.id, p, ids));
      return NextResponse.json(await report(ids, p, u.id));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/transaction-balance',
    auth: 'user',
    handler: async ({ user: u, query, params: { book } }) => {
      const id = uuid.parse(query.get('id'));
      const rows = (
        await db.query('SELECT id,event_id FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted', [
          id,
          book,
        ])
      ).rows;
      const result = await attachWalletBalances(u.id, rows);
      return NextResponse.json(
        (result[0] as { wallet_balances?: unknown[] } | undefined)?.wallet_balances || [],
      );
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/report',
    auth: 'user',
    handler: async ({ user: u, query, params: { book } }) => {
      const p = query,
        requested = p.getAll('book');
      const ids = await reportBooks(book, requested, u);
      const personal = p.get('scope') === 'personal_expense';
      return NextResponse.json(
        personal
          ? await personalExpenseReport(u.id, p, requested.length ? ids : undefined)
          : p.get('scope') === 'personal_wallet'
            ? await personalWalletReport(u.id, p)
            : await report(ids, p, u.id),
      );
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/export',
    auth: 'user',
    handler: async ({ user: u, query, params: { book }, locale }) => {
      const p = query,
        requested = p.getAll('book');
      const ids = await reportBooks(book, requested, u);
      const personal = p.get('scope') === 'personal_expense';
      return new Response(
        await exportCSV(
          personal && !requested.length
            ? (await db.query('SELECT book_id FROM members WHERE user_id=$1', [u.id])).rows.map(
                r => r.book_id,
              )
            : ids,
          p,
          locale,
          p.get('scope')?.startsWith('personal_') ? u.id : undefined,
        ),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=ledger.csv',
            'Cache-Control': 'no-store',
          },
        },
      );
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/refund-options',
    auth: 'user',
    handler: async ({ user: u, query, params: { book } }) => {
      const params = new URLSearchParams(query);
      if (!params.get('exclude')) params.delete('exclude');
      params.set('book', book);
      params.set('entity', 'transaction');
      params.set('kind', 'expense');
      params.set('state', 'active');
      const result = await search(u.id, params);
      return NextResponse.json(result.rows.map((r: { detail: unknown }) => r.detail));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/attention',
    auth: 'user',
    handler: async ({ query, params: { book } }) => {
      const trash = query.get('mode') === 'trash',
        sort = z.enum(detailSorts).parse(query.get('sort') || 'date_desc');
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .parse(query.get('offset') || 0);
      return NextResponse.json(
        (
          await db.query(
            `SELECT t.*,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,a.name AS account_name,u.name AS creator_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by WHERE t.book_id=$1 AND t.deleted=$2 AND ($2 OR ${claimBookVisibility()}) AND ($2 OR (jsonb_array_length(t.line_items)>0 AND (EXISTS(SELECT 1 FROM jsonb_array_elements(t.line_items) item WHERE item->>'amount' IS NULL) OR (SELECT sum((item->>'amount')::bigint) FROM jsonb_array_elements(t.line_items) item)<>t.amount))) ORDER BY ${detailOrder(sort, 't.amount', 't.id', true, 't.')} LIMIT $4 OFFSET $3`,
            [book, trash, offset, LIST_PAGE_SIZE],
          )
        ).rows,
      );
    },
  },
];
