import { z } from 'zod';
import { actionNames } from '@/lib/chat-actions';
import { assistantOperations, runOperation } from '@/server/assistant-operations';
import { entryActivity } from '@/server/activities';
import { Failure, member } from '@/server/access';
import { db, lockBook, transaction, withConnection } from '@/server/db';
import { changeInstallment } from '@/server/installments';
import { applyTransactionChange } from '@/server/transaction-changes';
import { type Route, uuid } from '../handler';

const titles: Record<string, string> = {
  ...actionNames,
  transaction_update: '修改账目',
  transaction_delete: '删除账目',
  family_confirm: '确认家庭收款',
  family_shares: '设置费用份额',
  family_create_movement: '记录家庭往来',
  memory_save: '保存财务记忆',
  memory_share: '共享财务记忆',
  memory_forget: '遗忘财务记忆',
  memory_status: '修改记忆状态',
};

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/assistant-actions',
    auth: 'user',
    handler: async ({ user, query }) => {
      const limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(query.get('limit') ?? 50);
      const ids = query.has('ids') ? z.array(uuid).min(1).max(50).parse(query.get('ids')!.split(',')) : null;
      const { rows } = await db.query(
        `SELECT id,operation,risk,status,created_at,undone_at,undo IS NOT NULL AND undone_at IS NULL AS "canUndo" FROM assistant_action_log
      WHERE user_id=$1 AND ($3::uuid[] IS NULL OR id=ANY($3)) ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, limit, ids],
      );
      return Response.json(
        rows.map(row => ({
          ...row,
          title: assistantOperations[row.operation]?.title || titles[row.operation] || row.operation,
        })),
      );
    },
  },
  {
    method: 'POST',
    pattern: '/assistant-actions/:id/undo',
    auth: 'user',
    handler: async ({ user, params }) => {
      const id = uuid.parse(params.id);
      await transaction(c =>
        withConnection(c, async () => {
          const log = (
            await c.query(
              'SELECT undo,undone_at FROM assistant_action_log WHERE id=$1 AND user_id=$2 FOR UPDATE',
              [id, user.id],
            )
          ).rows[0];
          if (!log) throw new Failure('操作记录不存在', 404, 'not_found');
          if (log.undone_at) return;
          if (!log.undo) throw new Failure('不可撤销', 409, 'conflict');
          const {
            bookId,
            transactionId,
            expectedVersion,
            operation,
            value,
            planVersion,
            previousEventId,
            expectedActivityId,
          } = log.undo;
          await lockBook(c, bookId);
          await member(bookId, user, true);
          const current = (
            await c.query('SELECT version FROM transactions WHERE id=$1 AND book_id=$2 FOR UPDATE', [
              transactionId,
              bookId,
            ])
          ).rows[0];
          if (current?.version !== expectedVersion)
            throw new Failure('账目已被修改，无法撤销', 409, 'conflict');
          if (
            expectedActivityId !== undefined &&
            (await entryActivity(user.id, bookId, transactionId)).activityId !== expectedActivityId
          )
            throw new Failure('账目已被修改，无法撤销', 409, 'conflict');
          if (planVersion !== undefined) {
            await changeInstallment(
              user.id,
              { operation: 'delete', id: transactionId, version: planVersion },
              c,
            );
            if (previousEventId === null)
              await c.query('UPDATE transactions SET event_id=NULL WHERE id=$1', [transactionId]);
          }
          if (operation === 'restore') {
            await runOperation(
              {
                operation: 'transaction_restore',
                params: { bookId, id: transactionId, version: expectedVersion },
              },
              user,
              true,
            );
          } else {
            await applyTransactionChange(c, bookId, user.id, {
              operation,
              transactionId,
              version: expectedVersion,
              value,
            });
          }
          await c.query("UPDATE assistant_action_log SET status='undone',undone_at=now() WHERE id=$1", [id]);
        }),
      );
      return Response.json({ ok: true });
    },
  },
];
