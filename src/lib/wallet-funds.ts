import { detailSort, sortDetails } from './detail-sort';
export type FundEvent = {
  id: string;
  date: string;
  createdAt?: string;
  occurredAt?: string;
  kind: 'income' | 'expense' | 'refund' | 'transfer' | 'adjustment';
  amount: number;
  sourceId: string | null;
  targetId: string | null;
  title: string;
  counterparty: string;
  sourceName: string;
  targetName: string;
  note: string;
  origin: 'transaction' | 'family' | 'adjustment';
  bookId?: string;
  reference?: string;
  costTitle?: string;
  sourceType?: string;
  targetType?: string;
};
export type FundRow = FundEvent & {
  inflow: number;
  outflow: number;
  delta: number;
  balanceDelta: number;
  repayment: boolean;
  internal: boolean;
};
export function fundRowsPage(rows: FundRow[], params: URLSearchParams) {
  const query = (params.get('q') || '').trim().toLowerCase(),
    flow = params.get('flow') || 'all';
  const filtered = rows.filter(
    r =>
      (!query ||
        [r.title, r.costTitle, r.counterparty, r.sourceName, r.targetName, r.note, r.reference, r.date]
          .join(' ')
          .toLowerCase()
          .includes(query)) &&
      (flow === 'all' ||
        (flow === 'in' && r.inflow > 0) ||
        (flow === 'out' && r.outflow > 0) ||
        (flow === 'transfer' && r.kind === 'transfer' && !r.internal) ||
        (flow === 'repayment' && r.repayment) ||
        (flow === 'internal' && r.internal && !r.repayment) ||
        (flow === 'adjustment' && r.kind === 'adjustment')),
  );
  const offset = Math.max(0, Number(params.get('offset')) || 0),
    limit = 20;
  return {
    rows: sortDetails(filtered, detailSort(params.get('sort')), r => ({
      date: r.date,
      time: r.occurredAt,
      created: r.createdAt,
      amount: r.amount,
      id: r.id,
    })).slice(offset, offset + limit),
    count: filtered.length,
    offset,
    hasMore: offset + limit < filtered.length,
  };
}
export type FundsData = Omit<ReturnType<typeof summarizeWalletFunds>, 'rows'> &
  ReturnType<typeof fundRowsPage>;
export function summarizeWalletFunds(
  events: FundEvent[],
  accounts: { id: string; opening: number; type?: string }[],
  from: string,
  to: string,
) {
  const owned = new Set(accounts.map(a => a.id));
  const cash = new Set(accounts.filter(a => a.type !== 'credit').map(a => a.id));
  let opening = accounts.reduce((n, a) => n + Number(a.opening), 0),
    cashOpening = accounts.filter(a => cash.has(a.id)).reduce((n, a) => n + Number(a.opening), 0);
  const summary = {
    income: 0,
    expense: 0,
    refund: 0,
    transferIn: 0,
    transferOut: 0,
    internalTransfer: 0,
    adjustment: 0,
    inflow: 0,
    outflow: 0,
    flowChange: 0,
    balanceChange: 0,
    openingBalance: 0,
    closingBalance: 0,
    cashOpeningBalance: 0,
    cashClosingBalance: 0,
    cashAdjustment: 0,
    repayment: 0,
  };
  const rows: FundRow[] = [],
    daily = new Map<
      string,
      { date: string; inflow: number; outflow: number; adjustment: number; delta: number }
    >();
  for (const e of events) {
    const source = !!e.sourceId && owned.has(e.sourceId),
      target = !!e.targetId && owned.has(e.targetId);
    if ((!source && !target) || e.date > to) continue;
    const internal = e.kind === 'transfer' && source && target;
    const balanceDelta =
      e.kind === 'adjustment'
        ? source
          ? e.amount
          : 0
        : e.kind === 'income' || e.kind === 'refund'
          ? source
            ? e.amount
            : 0
          : (target ? e.amount : 0) - (source ? e.amount : 0);
    const cashSource = !!e.sourceId && cash.has(e.sourceId),
      cashTarget = !!e.targetId && cash.has(e.targetId);
    const delta =
      e.kind === 'adjustment'
        ? cashSource
          ? e.amount
          : 0
        : e.kind === 'income' || e.kind === 'refund'
          ? cashSource
            ? e.amount
            : 0
          : (cashTarget ? e.amount : 0) - (cashSource ? e.amount : 0);
    const repayment =
      e.kind === 'transfer' &&
      e.sourceType !== 'credit' &&
      (e.targetType || accounts.find(a => a.id === e.targetId)?.type) === 'credit';
    if (e.date < from) {
      opening += balanceDelta;
      cashOpening += delta;
      continue;
    }
    const inflow = e.kind === 'adjustment' ? 0 : Math.max(0, delta),
      outflow = e.kind === 'adjustment' ? 0 : Math.max(0, -delta);
    rows.push({ ...e, inflow, outflow, delta, balanceDelta, repayment, internal });
    summary.balanceChange += balanceDelta;
    if (repayment) summary.repayment += outflow;
    if (e.kind === 'transfer') {
      if (internal) summary.internalTransfer += e.amount;
      summary.transferIn += inflow;
      summary.transferOut += outflow;
    } else if (e.kind === 'adjustment') {
      summary.adjustment += balanceDelta;
      summary.cashAdjustment += delta;
    } else summary[e.kind] += e.kind === 'expense' ? outflow : inflow;
    summary.inflow += inflow;
    summary.outflow += outflow;
    const d = daily.get(e.date) || { date: e.date, inflow: 0, outflow: 0, adjustment: 0, delta: 0 };
    d.inflow += inflow;
    d.outflow += outflow;
    d.delta += delta;
    if (e.kind === 'adjustment') d.adjustment += delta;
    daily.set(e.date, d);
  }
  summary.flowChange = summary.inflow - summary.outflow;
  summary.cashOpeningBalance = cashOpening;
  summary.cashClosingBalance = cashOpening + summary.flowChange + summary.cashAdjustment;
  summary.openingBalance = opening;
  summary.closingBalance = opening + summary.balanceChange;
  return {
    summary,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    rows: rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  };
}
