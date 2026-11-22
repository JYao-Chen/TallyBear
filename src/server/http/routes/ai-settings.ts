import { enqueue, watchJob } from '@/server/jobs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { Failure } from '@/server/auth';
import { encrypt } from '@/server/ai';
import { type Route, name } from '../handler';

export function settingsRoutes(assistant: boolean): Route[] {
  const table = assistant ? 'assistant_ai_settings' : 'ai_settings';
  const pattern = assistant ? '/assistant-ai-settings' : '/ai-settings';
  return [
    {
      method: 'GET',
      pattern,
      auth: 'admin',
      handler: async () => {
        const { rows } = await db.query(
          `SELECT base_url AS "baseUrl",model,vision_model AS "visionModel",true AS "hasKey" FROM ${table} WHERE id=1`,
        );
        return NextResponse.json(rows[0] || {});
      },
    },
    {
      method: 'PUT',
      pattern,
      auth: 'admin',
      handler: async ({ body }) => {
        const b = z
          .object({
            baseUrl: z
              .string()
              .url()
              .refine(s => s.startsWith('https://'), '模型地址需使用HTTPS'),
            model: name,
            visionModel: name,
            key: z.string().max(500).optional(),
          })
          .parse(body);
        const old = (await db.query(`SELECT encrypted_key FROM ${table} WHERE id=1`)).rows[0];
        if (!b.key && !old) throw new Failure('首次配置需要填写API Key');
        await db.query(
          `INSERT INTO ${table} VALUES(1,$1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET base_url=$1,model=$2,vision_model=$3,encrypted_key=$4`,
          [b.baseUrl, b.model, b.visionModel, b.key ? encrypt(b.key) : old.encrypted_key],
        );
        return NextResponse.json({ ok: true });
      },
    },
    {
      method: 'POST',
      pattern,
      auth: 'admin',
      handler: async ({ user: u, req, body }) => {
        const id = await enqueue(u, null, 'connection', { scope: assistant ? 'assistant' : 'recognition' });
        return body.background ? NextResponse.json({ jobId: id }, { status: 202 }) : watchJob(id, req.signal);
      },
    },
  ];
}
export const routes = settingsRoutes(false);
