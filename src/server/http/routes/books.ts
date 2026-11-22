import { sanitizeProfileContext } from '@/server/personal-profile';
import { organize } from '@/server/organize';
import { moveEntry, movePreview } from '@/server/move-entry';
import { linkReceipts } from '@/server/receipts';
import { enqueue, watchJob } from '@/server/jobs';
import { financeChat } from '@/server/finance-chat';
import { reuse } from '@/server/reuse';
import { bookMetadata } from '@/server/management';
import { allocations } from '@/server/allocations';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, transaction } from '@/server/db';
import { Failure } from '@/server/auth';
import { schedules } from '@/server/schedules';
import { listCategories, changeCategory } from '@/server/categories';
import { templates } from '@/server/templates';
import { getDraft, saveDraft } from '@/server/drafts';
import { listAccounts } from '@/server/accounts';
import { review } from '@/server/recognize';
import { type Route, methods, imageJsonLimit, uuid, name } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/books',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(
        (
          await db.query(
            'SELECT b.*,m.role,f.name AS family_name FROM books b JOIN members m ON m.book_id=b.id LEFT JOIN families f ON f.id=b.family_id WHERE m.user_id=$1 ORDER BY b.created_at',
            [u.id],
          )
        ).rows,
      );
    },
  },
  {
    method: 'POST',
    pattern: '/books',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      const b = z.object({ name, kind: z.enum(['private', 'shared']) }).parse(body);
      const id = randomUUID();
      await transaction(async c => {
        await c.query('INSERT INTO books(id,name,kind,owner_id) VALUES($1,$2,$3,$4)', [
          id,
          b.name,
          b.kind,
          u.id,
        ]);
        await c.query('INSERT INTO members VALUES($1,$2,$3)', [id, u.id, 'owner']);
      });
      return NextResponse.json({ id });
    },
  },
  ...methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    pattern: '/books/:book/chat',
    auth: 'user',
    maxBytes: imageJsonLimit,
    handler: async ({ user: u, req, query, body, params: { book } }) => {
      const result = await financeChat(book, u, req.method, body, query, req.signal);
      return result instanceof Response ? result : NextResponse.json(result);
    },
  }),
  {
    method: 'GET',
    pattern: '/books/:book/organize',
    auth: 'user',
    handler: async ({ query, params: { book } }) => {
      return NextResponse.json(await movePreview(book, query.getAll('id')));
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/organize',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      return NextResponse.json(await organize(book, u.id, body));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/move',
    auth: 'user',
    handler: async ({ query, params: { book } }) => {
      return NextResponse.json(await movePreview(book, query.get('id') || ''));
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/move',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      return NextResponse.json(await moveEntry(book, u.id, body));
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/reuse',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      return NextResponse.json(await reuse(book, u.id, body));
    },
  },
  {
    method: 'PUT',
    pattern: '/books/:book/metadata',
    auth: 'user',
    handler: async ({ body, params: { book } }) => {
      return NextResponse.json(await bookMetadata(book, body));
    },
  },
  ...methods(['GET', 'PUT'], {
    pattern: '/books/:book/allocations',
    auth: 'user',
    handler: async ({ query, body, params: { book }, req }) => {
      return NextResponse.json(await allocations(book, req.method, body, query));
    },
  }),
  ...methods(['GET', 'PUT', 'POST', 'PATCH', 'DELETE'], {
    pattern: '/books/:book/schedules',
    auth: 'user',
    handler: async ({ user: u, body, params: { book }, req }) => {
      return NextResponse.json(await schedules(book, u.id, req.method, body));
    },
  }),
  ...methods(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], {
    pattern: '/books/:book/templates',
    auth: 'user',
    handler: async ({ user: u, body, params: { book }, req }) => {
      return NextResponse.json(await templates(book, u.id, req.method, body));
    },
  }),
  {
    method: 'GET',
    pattern: '/books/:book/drafts',
    auth: 'user',
    handler: async ({ user: u, query, params: { book } }) => {
      return NextResponse.json(await getDraft(book, u.id, query.get('section')));
    },
  },
  {
    method: 'PUT',
    pattern: '/books/:book/drafts',
    auth: 'user',
    maxBytes: imageJsonLimit,
    handler: async ({ user: u, body, params: { book } }) => {
      return NextResponse.json(await saveDraft(book, u.id, body));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/members',
    auth: 'user',
    handler: async ({ params: { book } }) => {
      return NextResponse.json(
        (
          await db.query(
            'SELECT u.id,u.name,u.username,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.book_id=$1',
            [book],
          )
        ).rows,
      );
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/members',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      const b = z.object({ username: name, role: z.enum(['editor', 'viewer']) }).parse(body);
      const type = (await db.query('SELECT kind FROM books WHERE id=$1', [book])).rows[0];
      if (type.kind !== 'shared') throw new Failure('私人账本不能添加其他成员');
      const target = (await db.query('SELECT id FROM users WHERE username=$1', [b.username])).rows[0];
      if (!target) throw new Failure('账号不存在，请管理员先创建账号');
      if (target.id === u.id) throw new Failure('不能更改自己的所有者权限');
      await db.query(
        'INSERT INTO members VALUES($1,$2,$3) ON CONFLICT(book_id,user_id) DO UPDATE SET role=$3',
        [book, target.id, b.role],
      );
      return NextResponse.json({ ok: true });
    },
  },
  {
    method: 'DELETE',
    pattern: '/books/:book/members',
    auth: 'user',
    handler: async ({ body, params: { book } }) => {
      const id = uuid.parse(body.id);
      await db.query("DELETE FROM members WHERE book_id=$1 AND user_id=$2 AND role<>'owner'", [book, id]);
      return NextResponse.json({ ok: true });
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/categories',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(await listCategories(u.id));
    },
  },
  {
    method: 'PUT',
    pattern: '/books/:book/categories',
    auth: 'user',
    handler: async ({ user: u, body }) => {
      return NextResponse.json(await changeCategory(u.id, body));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/accounts',
    auth: 'user',
    handler: async ({ user: u, params: { book } }) => {
      return NextResponse.json(await listAccounts(book, u.id));
    },
  },
  {
    method: 'GET',
    pattern: '/books/:book/receipts',
    auth: 'user',
    handler: async ({ query, params: { book } }) => {
      return NextResponse.json(
        (
          await db.query(
            "SELECT DISTINCT f.id,f.name,r.purpose FROM receipt_files f JOIN transaction_receipts r ON r.file_id=f.id JOIN transactions t ON t.book_id=$1 AND t.id=$2 WHERE r.transaction_id=t.id OR EXISTS(SELECT 1 FROM expense_claim_links l JOIN expense_claims ec ON ec.id=l.claim_id WHERE l.target_id=t.id AND l.source_id=r.transaction_id AND l.active AND ec.status='accepted')",
            [book, uuid.parse(query.get('transaction'))],
          )
        ).rows,
      );
    },
  },
  ...methods(['POST', 'DELETE'], {
    pattern: '/books/:book/photos',
    auth: 'user',
    handler: async ({ user: u, body, params: { book }, req }) => {
      const b = z.object({ transaction: uuid, ids: z.array(uuid) }).parse(body);
      await transaction(async c => {
        const t = await c.query(
          'SELECT id FROM transactions WHERE id=$1 AND book_id=$2 AND NOT deleted FOR UPDATE',
          [b.transaction, book],
        );
        if (!t.rowCount) throw new Failure('账目不存在', 404);
        if (req.method === 'POST') await linkReceipts(c, book, u.id, b.transaction, b.ids, true, 'photo');
        else
          for (const id of b.ids) {
            await c.query(
              "DELETE FROM transaction_receipts WHERE transaction_id=$1 AND file_id=$2 AND purpose='photo'",
              [b.transaction, id],
            );
            await c.query(
              'UPDATE receipt_files SET temporary=true,created_at=now() WHERE id=$1 AND book_id=$2 AND NOT EXISTS(SELECT 1 FROM transaction_receipts WHERE file_id=$1)',
              [id, book],
            );
          }
      });
      return NextResponse.json({ ok: true });
    },
  }),
  {
    method: 'POST',
    pattern: '/books/:book/review',
    auth: 'user',
    handler: async ({ body, params: { book } }) => {
      return NextResponse.json(await review(book, body));
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/assistant',
    auth: 'user',
    maxBytes: imageJsonLimit,
    handler: async ({ user: u, req, body, params: { book } }) => {
      body.profileContext = await sanitizeProfileContext(u.id, body.profileContext);
      const id = await enqueue(u, book, 'assistant', body);
      return body.background === true
        ? NextResponse.json({ jobId: id }, { status: 202 })
        : watchJob(id, req.signal);
    },
  },
];
