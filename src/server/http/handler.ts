import { constants } from 'node:buffer';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { deployment, type Deployment } from '@/lib/deployment';
import { Failure, type User } from '@/server/access';
import { sessionUser } from '@/server/auth';
import { checkDeploymentCurrency } from '@/server/deployment';
import { errorResponse } from './errors';

export const name = z.string().trim().min(1).max(80);
export const uuid = z.string().uuid();
// Inline photos were exempt from the normal JSON cap. Use the runtime's string ceiling.
export const imageJsonLimit = constants.MAX_STRING_LENGTH;
type Context<B = Record<string, unknown>, Q = URLSearchParams> = {
  req: NextRequest;
  path: string[];
  params: Record<string, string>;
  query: Q;
  body: B;
  locale: Deployment['language'];
};
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type UserHandler = (ctx: Context & { user: User }) => Promise<Response>;
type Access<B, Q> =
  | { auth: 'public'; handler(ctx: Context<B, Q> & { user?: User }): Promise<Response> }
  | { auth: 'user' | 'admin'; handler(ctx: Context<B, Q> & { user: User }): Promise<Response> };
type Definition<B, Q> = {
  pattern: string;
  maxBytes?: number;
  stream?: boolean;
  body?: z.ZodType<B, z.ZodTypeDef, unknown>;
  query?: z.ZodType<Q, z.ZodTypeDef, unknown>;
} & Access<B, Q>;
export type Route<B = Record<string, unknown>, Q = URLSearchParams> = { method: Method } & Definition<B, Q>;
export function methods(
  list: Method[],
  route: Definition<Record<string, unknown>, URLSearchParams>,
): Route[] {
  return list.map(method => ({ ...route, method }));
}

async function readJson(req: NextRequest, limit: number) {
  let size = 0;
  const bounded = req.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > limit) throw new Failure('请求内容过大', 413);
        controller.enqueue(chunk);
      },
    }),
  );
  return new Response(bounded).json();
}

export async function handle(
  req: NextRequest,
  path: string[],
  match: { route: Route<unknown, unknown>; params: Record<string, string> } | undefined,
  actor?: User,
) {
  const locale = deployment().language;
  try {
    await checkDeploymentCurrency();
    if (req.method !== 'GET' && req.headers.get('origin') !== process.env.APP_ORIGIN)
      throw new Failure('请求来源不匹配', 403);
    if (!match)
      throw new Failure(path[0] === 'books' || path[0] === 'jobs' ? '操作不存在' : '页面不存在', 404);
    const { route, params } = match;
    const user =
      actor ??
      (route.auth === 'public' ? undefined : await sessionUser(req.cookies.get('bubu_session')?.value));
    if (route.auth === 'admin' && !user?.admin) throw new Failure('需要管理员权限', 403);
    const body =
      req.method === 'GET' || route.stream ? {} : await readJson(req, route.maxBytes ?? 35_000_000);
    if (body && typeof body === 'object' && !Array.isArray(body)) body.language = locale;
    const query = req.nextUrl.searchParams;
    const ctx = {
      req,
      path,
      params,
      query: route.query ? route.query.parse(query) : query,
      body: route.body ? route.body.parse(body) : body,
      locale,
    };
    if (route.auth === 'public') return await route.handler({ ...ctx, user });
    return await route.handler({ ...ctx, user: user! });
  } catch (error) {
    return errorResponse(error, locale);
  }
}
