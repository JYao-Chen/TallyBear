// Characterization snapshot of every statistics basis (see docs/refactor/STATS-AUDIT.md §1).
// Run against a restored copy, never production:  DATABASE_URL=… npx tsx scripts/stats-snapshot.ts out.json [YYYY-MM …]
// Output holds aggregates only (paged rows are dropped); compare two snapshots with scripts/stats-diff.mjs.
import { writeFileSync } from 'node:fs';
import { db } from '../src/server/db';
import { report, personalExpenseReport, personalWalletReport } from '../src/server/reports';
import { accountReport } from '../src/server/accounts';
import { activityReport } from '../src/server/activities';

const [out, ...requested] = process.argv.slice(2);
if (!out) throw new Error('用法：stats-snapshot.ts <输出.json> [YYYY-MM …]');
const months = requested.length ? requested : ['2026-09', '2026-10', '2026-11'];
const range = (m: string) => {
  const [y, n] = m.split('-').map(Number);
  return { from: m + '-01', to: new Date(Date.UTC(y, n, 0)).toISOString().slice(0, 10) };
};
const params = (v: Record<string, string>) => new URLSearchParams({ limit: '1', offset: '0', ...v });
const aggregates = (r: any) => {
  const { rows: _rows, funds, accounts, ...rest } = r;
  return {
    ...rest,
    ...(funds ? { funds: { summary: funds.summary, daily: funds.daily } } : {}),
    ...(accounts
      ? {
          accounts: accounts.map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            balance: a.balance,
            income: a.income,
            expense: a.expense,
            refund: a.refund,
            transferIn: a.transferIn,
            transferOut: a.transferOut,
          })),
        }
      : {}),
  };
};
const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, sorted(v[k])]),
        )
      : v;

async function capture(label: string, run: () => Promise<any>) {
  try {
    return aggregates(await run());
  } catch (e) {
    return { error: label + ': ' + (e as Error).message };
  }
}

const snapshot: any = { generatedAt: new Date().toISOString(), months, users: {} };
const users = (await db.query('SELECT id,username FROM users ORDER BY username')).rows;
for (const u of users) {
  const books = (
    await db.query(
      'SELECT b.id,b.name,b.kind FROM books b JOIN members m ON m.book_id=b.id AND m.user_id=$1 ORDER BY b.name,b.id',
      [u.id],
    )
  ).rows;
  const families = (
    await db.query('SELECT family_id AS id FROM family_members WHERE user_id=$1 ORDER BY family_id', [u.id])
  ).rows;
  const activities = (
    await db.query(
      'SELECT a.id,a.name FROM activities a WHERE a.owner_id=$1 OR a.family_id IN (SELECT family_id FROM family_members WHERE user_id=$1) ORDER BY a.name,a.id',
      [u.id],
    )
  ).rows;
  const ids = books.map(b => b.id),
    perUser: any = {};
  for (const m of months) {
    const r = range(m),
      entry: any = {};
    for (const b of books) {
      entry[`A.ledger.${b.kind}.${b.name}`] = await capture('A', () => report([b.id], params(r), u.id));
      entry[`A.ledger-cashflow.${b.kind}.${b.name}`] = await capture('A-cash', () =>
        report([b.id], params({ ...r, basis: 'cashflow' }), u.id),
      );
    }
    entry['A.ledger.all-books'] = await capture('A-all', () => report(ids, params(r), u.id));
    entry['B.my-expense'] = await capture('B', () => personalExpenseReport(u.id, params(r), ids));
    entry['C.personal-wallet'] = await capture('C', () => personalWalletReport(u.id, params(r)));
    entry['D+E.assets.personal'] = await capture('D', () =>
      accountReport(u.id, new URLSearchParams({ ...r, owner: 'personal' })),
    );
    for (const f of families)
      entry[`D+E.assets.family.${f.id}`] = await capture('D-family', () =>
        accountReport(u.id, new URLSearchParams({ ...r, owner: f.id })),
      );
    perUser[m] = entry;
  }
  for (const a of activities)
    perUser[`F.activity.${a.name}`] = await capture('F', () => activityReport(u.id, a.id, params({})));
  snapshot.users[u.username] = perUser;
}
writeFileSync(out, JSON.stringify(sorted(snapshot), null, 1));
console.log(`已写入 ${out}：${users.length} 个用户，${months.length} 个月`);
await db.end();
