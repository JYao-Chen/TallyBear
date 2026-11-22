import { receiptRoute } from '@/server/receipts';
import type { Route, UserHandler } from '../handler';

const handle: UserHandler = ({ user, req, path }) => receiptRoute(req, path, user);

export const routes: Route[] = [
  { method: 'POST', pattern: '/receipts', auth: 'user', stream: true, handler: handle },
  { method: 'GET', pattern: '/receipts', auth: 'user', handler: handle },
  { method: 'GET', pattern: '/receipts/:id', auth: 'user', handler: handle },
];
