import { ownedJob, watchJob } from '@/server/jobs';
import { NextResponse } from 'next/server';
import { db, transaction } from '@/server/db';
import { member, Failure } from '@/server/auth';
import { type Route, type UserHandler, uuid } from '../handler';

const job: UserHandler = async ({ user: u, req, query, body, params }) => {
  const id = uuid.parse(params.id);
  const j = await ownedJob(id, u);
  if (req.method === 'GET') {
    if (query.get('stream') === '1') return watchJob(id, req.signal);
    const { payload, ...safe } = j;
    return NextResponse.json(safe);
  }
  if (req.method === 'POST' && body.operation === 'retry') {
    if (j.book_id) await member(j.book_id, u, j.kind === 'assistant');
    await transaction(async c => {
      if (j.kind === 'chat') {
        await c.query('SELECT id FROM finance_conversations WHERE id=$1 FOR UPDATE', [j.payload.id]);
        const later = await c.query(
          'SELECT 1 FROM finance_turns WHERE conversation_id=$1 AND created_at>(SELECT created_at FROM finance_turns WHERE id=$2)',
          [j.payload.id, id],
        );
        if (later.rowCount) throw new Failure('已有后续对话，请在对话中重新发送问题');
      }
      const r = await c.query(
        "UPDATE ai_jobs SET status='queued',stage='等待续跑',error='',cancel_requested=false,finished_at=NULL WHERE id=$1 AND (status IN ('error','cancelled') OR (status='complete' AND kind='assistant' AND jsonb_array_length(COALESCE(result->'entries','[]'::jsonb))=0 AND jsonb_array_length(COALESCE(result->'ignored','[]'::jsonb))=0)) AND (kind='connection' OR payload<>'{}'::jsonb) RETURNING id",
        [id],
      );
      if (!r.rowCount) throw new Failure('这个任务不能续跑，请重新提交', 409);
      await c.query('DELETE FROM ai_job_events WHERE job_id=$1', [id]);
      if (j.kind === 'chat')
        await c.query("UPDATE finance_turns SET status='running',error='' WHERE id=$1", [id]);
    });
    return NextResponse.json({ ok: true });
  }
  if (req.method === 'POST' && body.operation === 'cancel') {
    await transaction(async c => {
      const row = (await c.query('SELECT status FROM ai_jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (row.status === 'queued') {
        await c.query(
          "UPDATE ai_jobs SET status='cancelled',stage='已取消',error='任务已取消',finished_at=now(),cancel_requested=true WHERE id=$1",
          [id],
        );
        await c.query("UPDATE finance_turns SET status='stopped',error='任务已取消' WHERE id=$1", [id]);
      } else if (row.status === 'running')
        await c.query('UPDATE ai_jobs SET cancel_requested=true WHERE id=$1', [id]);
    });
    return NextResponse.json({ ok: true });
  }
  throw new Failure('操作不存在', 404);
};

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/jobs',
    auth: 'user',
    handler: async ({ user: u }) => {
      return NextResponse.json(
        (
          await db.query(
            `SELECT j.id,j.kind,j.status,j.stage,j.error,j.book_id,b.name AS book_name,j.created_at,j.started_at,j.finished_at FROM ai_jobs j LEFT JOIN books b ON b.id=j.book_id WHERE j.user_id=$1 AND (j.book_id IS NULL OR EXISTS(SELECT 1 FROM members m WHERE m.book_id=j.book_id AND m.user_id=$1)) ORDER BY j.created_at DESC LIMIT 100`,
            [u.id],
          )
        ).rows,
      );
    },
  },
  { method: 'GET', pattern: '/jobs/:id', auth: 'user', handler: job },
  { method: 'POST', pattern: '/jobs/:id', auth: 'user', handler: job },
  {
    method: 'POST',
    pattern: '/jobs/:id/retry',
    auth: 'user',
    handler: ctx => job({ ...ctx, body: { operation: 'retry' } }),
  },
  {
    method: 'POST',
    pattern: '/jobs/:id/cancel',
    auth: 'user',
    handler: ctx => job({ ...ctx, body: { operation: 'cancel' } }),
  },
];
