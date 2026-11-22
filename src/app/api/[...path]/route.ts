import { dispatch } from '@/server/http/router';
import type { NextRequest } from 'next/server';
export const runtime = 'nodejs';
const handle = async (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) =>
  dispatch(req, (await ctx.params).path);
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
