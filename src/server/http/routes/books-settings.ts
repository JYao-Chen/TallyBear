import { renameCategoryRecords } from '@/server/category-rename';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, transaction } from '@/server/db';
import { Failure } from '@/server/auth';
import { lockBook } from '@/server/ledger';
import { type Route, methods, name } from '../handler';

export const routes: Route[] = [
  ...methods(['GET', 'PUT', 'DELETE'], {
    pattern: '/books/:book/budgets',
    auth: 'user',
    handler: async ({ query, body, params: { book }, req }) => {
      const month = req.method === 'GET' ? query.get('month') : body.month;
      if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Failure('月份无效');
      if (req.method === 'GET')
        return NextResponse.json(
          (
            await db.query(
              'SELECT category,amount::float8 AS amount FROM budgets WHERE book_id=$1 AND month=$2',
              [book, month],
            )
          ).rows,
        );
      if (req.method === 'DELETE') {
        const category = name.parse(body.category);
        await db.query('DELETE FROM budgets WHERE book_id=$1 AND month=$2 AND category=$3', [
          book,
          month,
          category,
        ]);
        return NextResponse.json({ ok: true });
      }
      if (req.method === 'PUT') {
        const b = z
          .object({
            category: name,
            previousCategory: name.optional(),
            amount: z.number().int().nonnegative().max(100000000000),
          })
          .parse(body);
        await transaction(async c => {
          await lockBook(c, book);
          if (b.previousCategory && b.previousCategory !== b.category) {
            if (
              (
                await c.query('SELECT 1 FROM budgets WHERE book_id=$1 AND month=$2 AND category=$3', [
                  book,
                  month,
                  b.category,
                ])
              ).rowCount
            )
              throw new Failure('该分类已有预算，请修改已有预算', 409);
            const result = await c.query(
              'UPDATE budgets SET category=$3,amount=$4 WHERE book_id=$1 AND month=$2 AND category=$5',
              [book, month, b.category, b.amount, b.previousCategory],
            );
            if (!result.rowCount) throw new Failure('预算已删除，请刷新后再试', 409);
            await renameCategoryRecords(c, [book], b.previousCategory, b.category);
          } else
            await c.query(
              'INSERT INTO budgets VALUES($1,$2,$3,$4) ON CONFLICT(book_id,month,category) DO UPDATE SET amount=$4',
              [book, month, b.category, b.amount],
            );
        });
        return NextResponse.json({ ok: true });
      }
      throw new Failure('操作不存在', 404);
    },
  }),
];
