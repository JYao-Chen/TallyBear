import { z } from 'zod';
import { db } from '../../db';
import { Failure } from '../../access';
import { categoryPartsSql } from '../../item-category-sql';
import { movementKindSql } from './gift';
import { fundRowsPage, summarizeWalletFunds, type FundEvent } from '@/lib/wallet-funds';

export const balanceCentsSql = `(a.opening+COALESCE((SELECT sum(CASE WHEN v.target_id=a.id THEN v.amount ELSE -v.amount END) FROM family_movements v WHERE v.status='confirmed' AND (v.source_id=a.id OR v.target_id=a.id)),0)+COALESCE((SELECT sum(flow) FROM (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) CASE WHEN t.kind IN ('income','refund') THEN t.amount ELSE -t.amount END AS flow FROM transactions t WHERE t.account_id=a.id AND NOT t.deleted ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id) outgoing),0)+COALESCE((SELECT sum(amount) FROM (SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.amount FROM transactions t WHERE t.target_id=a.id AND NOT t.deleted ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id) incoming),0)+COALESCE((SELECT sum(j.amount) FROM account_adjustments j WHERE j.account_id=a.id),0))::bigint`;
export const walletIdentity = `a.id,a.name,a.type,a.holder,a.institution,a.suffix,a.ownership,a.archived,a.version,a.owner_id,a.family_id,COALESCE(f.name,u.name) AS owner_name`;

type Wallet = { id: string; name: string; opening: number; type?: string };
type WalletScope = { user: string; owner: string; account: string };

async function walletData(selection: Wallet[] | WalletScope, from: string, to: string) {
  const supplied = Array.isArray(selection);
  const args: unknown[] = supplied
    ? [selection.map(a => a.id), from, to]
    : [
        selection.user,
        from,
        to,
        selection.owner === 'personal' ? null : selection.owner,
        selection.account === 'all' ? null : selection.account,
      ];
  const scope = supplied ? 'SELECT $1::uuid[] AS ids' : 'SELECT ARRAY(SELECT id FROM wallets) AS ids';
  const wallets = supplied
    ? ''
    : `access AS (SELECT $4::uuid IS NULL OR EXISTS(SELECT 1 FROM family_members WHERE family_id=$4 AND user_id=$1) AS allowed),
    wallets AS (SELECT ${walletIdentity},a.opening,${balanceCentsSql} AS balance,true AS usable
      FROM accounts a LEFT JOIN users u ON u.id=a.owner_id LEFT JOIN families f ON f.id=a.family_id
      WHERE (SELECT allowed FROM access) AND (CASE WHEN $4::uuid IS NULL THEN a.owner_id=$1 ELSE a.family_id=$4 END)
      AND ($5::uuid IS NULL OR a.id=$5) ORDER BY a.archived,a.name,a.id),`;
  const {
    rows: [data],
  } = await db.query(
    `WITH ${wallets} selected AS (${scope}), entries AS (
    SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.* FROM transactions t,selected
    WHERE NOT t.deleted AND (t.account_id=ANY(selected.ids) OR t.target_id=ANY(selected.ids))
    ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id
  ), flows AS (
    SELECT t.id,t.book_id,t.account_id,t.target_id,t.kind,t.amount,t.date,t.created_at,t.occurred_at,
      COALESCE(NULLIF(t.title,''),NULLIF(t.payee,''),t.kind) AS title,t.payee,t.payee AS counterparty,t.note,COALESCE(NULLIF(t.external_id,''),t.order_id,'') AS reference,
      'transaction' AS origin, EXISTS(SELECT 1 FROM family_contributions c WHERE c.origin='transaction' AND c.event_id=COALESCE(t.event_id,t.id)) AS contribution,
      CASE WHEN t.date >= $2::date AND t.kind<>'transfer' THEN ${categoryPartsSql()} END AS parts,NULL AS cost_title
    FROM entries t WHERE t.date <= $3::date
    UNION ALL
    SELECT v.id,NULL,CASE WHEN k.kind='income' THEN v.target_id ELSE v.source_id END,CASE WHEN k.kind='transfer' THEN v.target_id END,
      k.kind,v.amount,v.date,v.created_at,NULL,CASE WHEN v.source_id=ANY(selected.ids) THEN '转给 '||COALESCE(r.name,'共同钱包') ELSE '收到 '||s.name||'的转账' END,
      CASE WHEN v.source_id=ANY(selected.ids) THEN r.name ELSE s.name END,CASE WHEN v.source_id=ANY(selected.ids) THEN COALESCE(r.name,'共同钱包') ELSE s.name END,v.note,COALESCE(v.external_id,''),'family',
      EXISTS(SELECT 1 FROM family_contributions c WHERE c.origin='family' AND c.event_id=v.id),
      jsonb_build_array(jsonb_build_object('category','人情往来','amount',v.amount)),cs.rule->>'title'
    FROM selected CROSS JOIN family_movements v JOIN users s ON s.id=v.sender_id LEFT JOIN users r ON r.id=v.recipient_id
      LEFT JOIN cost_schedule_settlements x ON x.movement_id=v.id LEFT JOIN cost_schedules cs ON cs.id=x.schedule_id
      CROSS JOIN LATERAL (SELECT ${movementKindSql('wallets')} AS kind) k
    WHERE v.status='confirmed' AND v.date <= $3::date AND (v.source_id=ANY(selected.ids) OR v.target_id=ANY(selected.ids))
    UNION ALL
    SELECT j.id,NULL,j.account_id,NULL,'adjustment',j.amount,j.effective_date,j.created_at,NULL,'余额校准','','',j.note,NULL,'adjustment',NULL,NULL,NULL
    FROM account_adjustments j,selected WHERE j.account_id=ANY(selected.ids) AND j.effective_date <= $3::date
  ) SELECT ${supplied ? '' : "(SELECT allowed FROM access) AS allowed,(SELECT COALESCE(json_agg(wallets),'[]') FROM wallets) AS accounts,"}
    COALESCE(json_agg(detail),'[]') AS flows FROM (
      SELECT flows.*,a.type AS source_type,b.type AS target_type FROM flows LEFT JOIN accounts a ON a.id=flows.account_id LEFT JOIN accounts b ON b.id=flows.target_id
    ) detail`,
    args,
  );
  if (!supplied && !data.allowed) throw new Failure('只有家庭成员可以查看家庭资产', 403);
  const accounts: Record<string, any>[] = supplied ? selection : data.accounts;
  if (!supplied && selection.account !== 'all' && !accounts.length)
    throw new Failure('没有此资产的查看权限', 403);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const historic: Record<string, any>[] = data.flows;
  const events = historic.map((r): FundEvent => ({
    id: r.id,
    date: r.date,
    createdAt: new Date(r.created_at).toISOString(),
    kind: r.kind,
    amount: r.amount,
    sourceId: r.account_id,
    targetId: r.target_id,
    title: r.title,
    counterparty: r.counterparty,
    sourceName: names.get(r.account_id) || '',
    targetName: names.get(r.target_id) || '',
    note: r.note,
    origin: r.origin,
    sourceType: r.source_type ?? undefined,
    targetType: r.target_type ?? undefined,
    ...(r.origin === 'transaction' ? { bookId: r.book_id, occurredAt: r.occurred_at } : {}),
    ...(r.origin === 'adjustment' ? {} : { contribution: r.contribution, reference: r.reference }),
    ...(r.cost_title ? { costTitle: r.cost_title } : {}),
  }));
  return {
    accounts,
    funds: summarizeWalletFunds(events, accounts as Wallet[], from, to),
    flows: historic.filter(r => r.date >= from && r.kind !== 'adjustment'),
  };
}

export async function walletFunds(accounts: Wallet[], from: string, to: string) {
  return (await walletData(accounts, from, to)).funds;
}
export async function accountReport(user: string, params: URLSearchParams) {
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
  const p = z
    .object({
      from: date,
      to: date,
      owner: z.union([z.literal('personal'), z.string().uuid()]).default('personal'),
      account: z.union([z.literal('all'), z.string().uuid()]).default('all'),
    })
    .parse(Object.fromEntries(params));
  if (p.to < p.from) throw new Failure('结束日期不能早于开始日期');
  const {
    accounts,
    flows,
    funds: allFunds,
  } = await walletData({ user, owner: p.owner, account: p.account }, p.from, p.to);
  const ids = accounts.map(a => a.id);
  for (const a of accounts) {
    Object.assign(a, { income: 0, expense: 0, refund: 0, transferIn: 0, transferOut: 0 });
    for (const t of flows) {
      if (t.account_id === a.id) a[t.kind === 'transfer' ? 'transferOut' : t.kind] += t.amount;
      if (t.target_id === a.id) a.transferIn += t.amount;
    }
  }
  const sourceMap = new Map<string, any>();
  for (const t of flows) {
    if (t.kind === 'transfer') continue;
    for (const part of t.parts) {
      const key = JSON.stringify([t.kind, part.category, t.payee]);
      const s = sourceMap.get(key) || {
        kind: t.kind,
        category: part.category,
        counterparty: t.payee || '',
        amount: 0,
        count: 0,
      };
      s.amount += part.amount;
      s.count++;
      sourceMap.set(key, s);
    }
  }
  const dailyMap = new Map<string, { date: string; income: number; expense: number }>(),
    categoryMap = new Map<string, number>();
  for (const t of flows) {
    if (t.kind === 'transfer') continue;
    const day = dailyMap.get(t.date) || { date: t.date, income: 0, expense: 0 };
    if (t.kind === 'income') day.income += t.amount;
    else day.expense += t.kind === 'refund' ? -t.amount : t.amount;
    dailyMap.set(t.date, day);
    if (t.kind === 'expense' || t.kind === 'refund')
      for (const part of t.parts)
        categoryMap.set(
          part.category,
          (categoryMap.get(part.category) || 0) + (t.kind === 'refund' ? -part.amount : part.amount),
        );
  }
  const cashPaid = flows
    .filter(
      t =>
        ids.includes(t.account_id) &&
        t.source_type !== 'credit' &&
        (t.kind === 'expense' || (t.kind === 'transfer' && t.target_type === 'credit')),
    )
    .reduce((n, t) => n + t.amount, 0);
  const debtPurchases = flows
    .filter(t => ids.includes(t.account_id) && t.source_type === 'credit' && t.kind === 'expense')
    .reduce((n, t) => n + t.amount, 0);
  const summary = {
    cashPaid,
    debtPurchases,
    bankDeposits: accounts.filter(a => a.type === 'bank').reduce((n, a) => n + Math.max(0, a.balance), 0),
    walletAndCash: accounts
      .filter(a => ['wechat', 'alipay', 'cash'].includes(a.type))
      .reduce((n, a) => n + Math.max(0, a.balance), 0),
    assets: accounts.reduce((n, a) => n + Math.max(0, a.balance), 0),
    liabilities: accounts.reduce((n, a) => n + Math.max(0, -a.balance), 0),
    netAssets: accounts.reduce((n, a) => n + a.balance, 0),
    income: accounts.reduce((n, a) => n + a.income, 0),
    expense: accounts.reduce((n, a) => n + a.expense, 0),
    refund: accounts.reduce((n, a) => n + a.refund, 0),
  };
  const funds = { summary: allFunds.summary, daily: allFunds.daily, ...fundRowsPage(allFunds.rows, params) };
  return {
    funds,
    period: { from: p.from, to: p.to },
    scope: p.owner,
    accounts,
    sources: [...sourceMap.values()].sort((a, b) => b.amount - a.amount),
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    categories: [...categoryMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    ownershipGroups: [
      {
        ownership: p.owner,
        count: accounts.length,
        netAssets: summary.netAssets,
        expense: summary.expense - summary.refund,
      },
    ],
    summary,
  };
}
