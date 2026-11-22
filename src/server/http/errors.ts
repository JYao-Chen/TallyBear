import { z } from 'zod';
import { translate, type Language } from '@/lib/i18n';
import { Failure } from '@/server/access';

const codes = {
  400: 'validation',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'too_large',
  429: 'rate_limited',
  500: 'internal',
} as const;
export type ErrorCode = (typeof codes)[keyof typeof codes];
function statusCode(status: number): ErrorCode {
  if (status === 410) return 'not_found';
  return codes[status as keyof typeof codes] ?? (status >= 500 ? 'internal' : 'validation');
}
export function errorResponse(error: unknown, locale: Language) {
  function response(status: number, message: string, code = statusCode(status)) {
    return Response.json({ error: translate(message, locale), code }, { status });
  }
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || '填写内容无效', code: 'validation' },
      { status: 400 },
    );
  if (error instanceof Failure) return response(error.status, error.message, error.code);
  if (error instanceof Error && ['VerificationError', 'CostPlanError'].includes(error.name))
    return response(400, error.message);
  const code = (error as { code?: string } | null)?.code;
  if (code === 'P0001') return response(409, (error as Error).message);
  if (code === '23505') return response(409, '名称或账号已存在');
  if (code === '23503') return response(400, '账户不存在或不属于当前账本');
  console.error('API operation failed', error instanceof Error ? error.name : 'unknown');
  return response(500, '操作未完成，请稍后重试');
}
