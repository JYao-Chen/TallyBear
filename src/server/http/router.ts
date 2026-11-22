import type { NextRequest } from 'next/server';
import { member, type User } from '@/server/access';
import { accessibleActivity } from '@/server/activities';
import { handle, uuid, type Route, type UserHandler } from './handler';
import { routes as session } from './routes/session';
import { routes as help } from './routes/help';
import { routes as memories } from './routes/memories';
import { routes as personalProfile } from './routes/personal-profile';
import { routes as activities } from './routes/activities';
import { routes as expenseClaims } from './routes/expense-claims';
import { routes as discussions } from './routes/discussions';
import { routes as costProjects } from './routes/cost-projects';
import { routes as costSchedules } from './routes/cost-schedules';
import { routes as families } from './routes/families';
import { routes as familyInbox } from './routes/family-inbox';
import { routes as bookMovements } from './routes/book-movements';
import { routes as familyFinance } from './routes/family-finance';
import { routes as searchOptions } from './routes/search-options';
import { routes as search } from './routes/search';
import { routes as queueSettings } from './routes/queue-settings';
import { routes as jobs } from './routes/jobs';
import { routes as users } from './routes/users';
import { routes as installments } from './routes/installments';
import { routes as assets } from './routes/assets';
import { routes as aiSettings } from './routes/ai-settings';
import { routes as assistantAiSettings } from './routes/assistant-ai-settings';
import { routes as books } from './routes/books';
import { routes as booksReports } from './routes/books-reports';
import { routes as booksEntries } from './routes/books-entries';
import { routes as booksSettings } from './routes/books-settings';
import { routes as receipts } from './routes/receipts';
function bookAccess(route: Route): Route {
  if (route.auth === 'public' || !route.pattern.startsWith('/books/:book/')) return route;
  const resource = route.pattern.split('/')[3];
  const write = route.method !== 'GET';
  return {
    ...route,
    async handler(ctx: Parameters<UserHandler>[0]) {
      const book = uuid.parse(ctx.params.book);
      await member(
        book,
        ctx.user,
        write && !['chat', 'categories'].includes(resource),
        write && ['members', 'metadata'].includes(resource),
      );
      if (['report', 'chart-details', 'export'].includes(resource) && ctx.query.has('activity'))
        await accessibleActivity(ctx.user.id, ctx.query.get('activity') || '');
      return route.handler(ctx);
    },
  };
}
export const routes: Route<unknown, unknown>[] = [
  ...session,
  ...help,
  ...memories,
  ...personalProfile,
  ...activities,
  ...expenseClaims,
  ...discussions,
  ...costProjects,
  ...costSchedules,
  ...families,
  ...familyInbox,
  ...bookMovements,
  ...familyFinance,
  ...searchOptions,
  ...search,
  ...queueSettings,
  ...jobs,
  ...users,
  ...installments,
  ...assets,
  ...aiSettings,
  ...assistantAiSettings,
  ...books.map(bookAccess),
  ...booksReports.map(bookAccess),
  ...booksEntries.map(bookAccess),
  ...booksSettings.map(bookAccess),
  ...receipts,
];

const table = routes.map(route => ({ route, segments: route.pattern.slice(1).split('/') }));
export function matchRoute(method: string, path: string[]) {
  for (const { route, segments } of table) {
    if (method !== route.method || segments.length !== path.length) continue;
    const params: Record<string, string> = {};
    if (
      segments.every((segment, i) => {
        if (segment.startsWith(':') && path[i]) {
          params[segment.slice(1)] = path[i];
          return true;
        }
        return segment === path[i];
      })
    )
      return { route, params };
  }
}
export function dispatch(req: NextRequest, path: string[], actor?: User) {
  return handle(req, path, matchRoute(req.method, path), actor);
}
