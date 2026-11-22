import { categoryPartsSql, hasItemCategoriesSql } from './item-category-sql';
import { transaction } from './db';
import { calculateCostPlan, intersectAmount } from '@/lib/cost-attribution';
import { movementReportSource } from './movement-report';
import { advancePeriod, periodShare } from '@/lib/period';
import { scheduledCostPlan } from '@/lib/cost-schedule';

// Projections only. No synthetic transaction is written and no wallet is charged.
export async function unifiedExpenseSource(
  books: string[],
  from: string,
  to: string,
  values: unknown[],
  movementSource = movementReportSource,
) {
  const payload = await transaction(async c => {
    const claims: { event: string; amount: number }[] = [],
      rows: any[] = [],
      excluded: string[] = [],
      refunds: string[] = [];
    const until = new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10);
    const prepaid = (
      await c.query(
        `SELECT s.id,s.rule,s.version,v.sender_id,m.book_id,to_char(x.due_date,'YYYY-MM-DD') AS due_date,sum(x.amount)::bigint AS amount,jsonb_agg(jsonb_build_object('wallet',v.source_id,'date',v.date) ORDER BY v.date,v.id) AS payments,min(x.created_at) AS created_at
   FROM cost_schedule_settlements x JOIN cost_schedules s ON s.id=x.schedule_id JOIN family_movements v ON v.id=x.movement_id
   JOIN cost_schedule_members m ON m.schedule_id=s.id AND m.user_id=v.sender_id
   JOIN members access ON access.book_id=m.book_id AND access.user_id=m.user_id
   JOIN family_members f ON f.family_id=s.family_id AND f.user_id=m.user_id
   WHERE m.book_id=ANY($1::uuid[]) AND v.status='confirmed'
    AND NOT EXISTS(SELECT 1 FROM cost_schedule_occurrences o WHERE o.schedule_id=x.schedule_id AND o.due_date=x.due_date)
   GROUP BY s.id,v.sender_id,m.book_id,x.due_date`,
        [books],
      )
    ).rows;
    for (const p of prepaid) {
      const scheduled = scheduledCostPlan(p.rule, p.due_date, p.id);
      const { plan, periods } = calculateCostPlan({
        ...scheduled,
        sources: [{ transactionId: p.id, amount: Number(p.amount) }],
        shares: [{ userId: p.sender_id, amount: Number(p.amount) }],
      });
      for (const period of periods) {
        const start = period.start > from ? period.start : from,
          end = period.end < until ? period.end : until;
        if (end <= start) continue;
        const amount = intersectAmount(period.amount, period.start, period.end, start, end);
        if (!amount) continue;
        rows.push({
          id: p.id,
          payments: p.payments,
          book_id: p.book_id,
          created_by: p.sender_id,
          kind: 'expense',
          amount,
          date: start,
          occurred_at: '00:00:00',
          title: plan.title,
          category: plan.category,
          payee: '',
          note: '',
          line_items: [],
          scene: {},
          deleted: false,
          version: p.version,
          created_at: p.created_at,
          updated_at: p.created_at,
          cost_project_id: null,
          cost_owner_id: p.sender_id,
          cost_basis_amount: period.amount,
          cost_basis_start: period.start,
          cost_basis_end: period.end,
          cost_period_end: end,
          cost_row_key: `prepaid:${p.id}:${p.due_date}:${p.sender_id}:${period.start}`,
        });
      }
    }
    const projects = (
      await c.query(
        `WITH selected_projects AS (SELECT p.* FROM cost_projects p WHERE p.active_plan IS NOT NULL AND (
   EXISTS(SELECT 1 FROM cost_source_claims s JOIN transactions t ON COALESCE(t.event_id,t.id)=s.event_id WHERE s.project_id=p.id AND t.book_id=ANY($1::uuid[]))
   OR EXISTS(SELECT 1 FROM cost_project_members m WHERE m.project_id=p.id AND m.display_book_id=ANY($1::uuid[]))
   OR EXISTS(SELECT 1 FROM cost_project_members m JOIN books b ON b.owner_id=m.user_id AND b.kind='private' WHERE m.project_id=p.id AND m.display_book_id IS NULL AND b.id=ANY($1::uuid[]))
  )), sources AS (
      SELECT s.project_id,s.transaction_id,COALESCE(t.event_id,t.id) AS event,t.account_id,to_char(t.date,'YYYY-MM-DD') AS date,
        (NOT t.deleted AND t.kind=s.kind AND a.owner_id=p.owner_id AND m.role<>'viewer'
         AND t.account_id=s.account_id AND t.date=s.date
         AND NOT EXISTS(SELECT 1 FROM expense_claims ec WHERE ec.event_id=COALESCE(t.event_id,t.id) AND ec.status IN ('pending','accepted'))
         AND s.source_amount=GREATEST(0,t.amount-CASE WHEN s.kind='expense' THEN COALESCE((
           SELECT sum(amount) FROM (
             SELECT DISTINCT ON(COALESCE(r.event_id,r.id)) r.amount FROM transactions r JOIN transactions o ON o.id=r.refund_of
             WHERE COALESCE(o.event_id,o.id)=COALESCE(t.event_id,t.id) AND r.kind='refund' AND NOT r.deleted
             ORDER BY COALESCE(r.event_id,r.id),r.created_at
           ) refunds),0) ELSE 0 END)) AS valid,
        ARRAY(SELECT DISTINCT copy.book_id FROM transactions copy JOIN books b ON b.id=copy.book_id
          WHERE COALESCE(copy.event_id,copy.id)=COALESCE(t.event_id,t.id) AND NOT copy.deleted
          AND b.kind='shared' AND b.id=ANY($1::uuid[])) AS shared_books
      FROM cost_source_claims s JOIN selected_projects p ON p.id=s.project_id
      LEFT JOIN transactions t ON t.id=s.transaction_id LEFT JOIN accounts a ON a.id=t.account_id
      LEFT JOIN members m ON m.book_id=t.book_id AND m.user_id=p.owner_id
      WHERE NOT p.active_stale), eligible_members AS (
      SELECT m.project_id,m.user_id,COALESCE(m.display_book_id,(SELECT b.id FROM books b JOIN members bm ON bm.book_id=b.id AND bm.user_id=m.user_id WHERE b.owner_id=m.user_id AND b.kind='private' ORDER BY b.created_at,b.id LIMIT 1)) AS book_id
      FROM cost_project_members m JOIN selected_projects p ON p.id=m.project_id WHERE NOT p.active_stale
      AND (m.user_id=p.owner_id OR EXISTS(SELECT 1 FROM family_members f WHERE f.family_id=p.family_id AND f.user_id=m.user_id)))
    SELECT p.*, (SELECT json_agg(s) FROM sources s WHERE s.project_id=p.id) AS reserved,
      (SELECT json_agg(m) FROM eligible_members m WHERE m.project_id=p.id) AS project_members
    FROM selected_projects p ORDER BY p.id`,
        [books],
      )
    ).rows;
    for (const p of projects) {
      const reserved:
        | {
            transaction_id: string;
            valid: boolean;
            event: string;
            shared_books: string[];
            account_id: string;
            date: string;
          }[]
        | null = p.reserved;
      if (p.active_stale || !reserved?.length || reserved.some(s => !s.valid)) {
        excluded.push(p.title);
        continue;
      }
      const { plan, periods } = calculateCostPlan(p.active_plan);
      const sharedBooks = new Set<string>();
      const payments = plan.sources.map(s => {
        const original = reserved.find(r => r.transaction_id === s.transactionId)!;
        claims.push({ event: original.event, amount: s.amount });
        for (const book of original.shared_books) sharedBooks.add(book);
        return { wallet: original.account_id, date: original.date };
      });
      const members = p.project_members || [];
      for (const m of members) {
        const destinations = new Set([...sharedBooks, ...(books.includes(m.book_id) ? [m.book_id] : [])]);
        if (!destinations.size) continue;
        for (const period of periods) {
          const start = period.start > from ? period.start : from,
            end = period.end < until ? period.end : until;
          if (end <= start) continue;
          const amount = intersectAmount(
            period.shares.find(s => s.userId === m.user_id)?.amount || 0,
            period.start,
            period.end,
            start,
            end,
          );
          if (!amount) continue;
          for (const bookId of destinations)
            rows.push({
              id: p.id,
              payments,
              book_id: bookId,
              created_by: m.user_id,
              kind: 'expense',
              amount,
              date: start,
              occurred_at: '00:00:00',
              title: plan.title,
              category: plan.category,
              payee: '',
              note: '',
              line_items: [],
              scene: {},
              deleted: false,
              version: p.version,
              created_at: p.created_at,
              updated_at: p.updated_at,
              cost_project_id: p.id,
              cost_owner_id: m.user_id,
              cost_basis_amount: period.shares.find(s => s.userId === m.user_id)?.amount || 0,
              cost_basis_start: period.start,
              cost_basis_end: period.end,
              cost_period_end: end,
              cost_row_key: `${p.id}:${m.user_id}:${period.start}`,
            });
        }
      }
    }
    // Existing single-entry allocations join the same report rather than retaining a second total.
    const legacy = (
      await c.query(
        `SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.*,COALESCE(t.event_id,t.id) AS event, acc.owner_id,acc.family_id, to_char(t.date,'YYYY-MM-DD') AS paid_on, ${categoryPartsSql()} AS parts,${hasItemCategoriesSql('t')} AS categorized,
   to_char(COALESCE(a.start_date,a.start_month),'YYYY-MM-DD') AS start,a.period_unit,COALESCE(a.period_count,a.months) AS period_count
   FROM expense_allocations a JOIN transactions t ON t.id=a.transaction_id LEFT JOIN accounts acc ON acc.id=t.account_id WHERE NOT t.deleted AND t.kind='expense'
   AND EXISTS(SELECT 1 FROM transactions copy WHERE COALESCE(copy.event_id,copy.id)=COALESCE(t.event_id,t.id) AND NOT copy.deleted AND copy.book_id=ANY($1::uuid[]))
   ORDER BY COALESCE(t.event_id,t.id),t.created_at,t.id`,
        [books],
      )
    ).rows;
    const events = legacy.map(t => t.event);
    const refundRows = (
      await c.query(
        `
      SELECT DISTINCT ON(COALESCE(original.event_id,original.id),COALESCE(r.event_id,r.id))
        COALESCE(original.event_id,original.id) AS original,COALESCE(r.event_id,r.id) AS event,r.amount,${hasItemCategoriesSql('r')} AS categorized,${categoryPartsSql('r')} AS parts
      FROM transactions r JOIN transactions original ON original.id=r.refund_of
      WHERE COALESCE(original.event_id,original.id)=ANY($1::uuid[]) AND NOT r.deleted AND r.kind='refund'
      ORDER BY COALESCE(original.event_id,original.id),COALESCE(r.event_id,r.id),r.created_at,r.id`,
        [events],
      )
    ).rows;
    const copyRows = (
      await c.query(
        `
      SELECT COALESCE(event_id,id) AS event,id,book_id,created_by FROM transactions
      WHERE COALESCE(event_id,id)=ANY($1::uuid[]) AND NOT deleted AND book_id=ANY($2::uuid[])`,
        [events, books],
      )
    ).rows;
    const refundsByOriginal = Map.groupBy(refundRows, r => r.original);
    const copiesByEvent = Map.groupBy(copyRows, r => r.event);
    const reservedEvents = new Set(claims.map(s => s.event));
    for (const t of legacy) {
      if (reservedEvents.has(t.event)) continue;
      const returned = refundsByOriginal.get(t.event) || [];
      const net = Number(t.amount) - returned.reduce((n, r) => n + Number(r.amount), 0);
      let categoryItems = t.line_items;
      if (net && (t.categorized || returned.some(r => r.categorized))) {
        const parts = new Map<string, number>(
          t.parts.map((p: { category: string; amount: number }) => [p.category, p.amount]),
        );
        for (const refund of returned)
          for (const p of refund.parts) parts.set(p.category, (parts.get(p.category) || 0) - p.amount);
        categoryItems = [...parts].map(([category, amount]) => ({
          name: category,
          category,
          kind: 'item',
          amount: amount * Math.sign(net),
          quantity: null,
          unitPrice: null,
        }));
      }
      refunds.push(...returned.map(r => r.event));
      claims.push({ event: t.event, amount: Number(t.amount) });
      const copies = copiesByEvent.get(t.event) || [];
      const finish = advancePeriod(t.start, t.period_unit, t.period_count);
      const costOwner = t.owner_id || (t.family_id ? 'family:' + t.family_id : t.created_by);
      for (let month = from.slice(0, 7) + '-01'; month <= to; month = advancePeriod(month, 'month', 1)) {
        const monthEnd = advancePeriod(month, 'month', 1),
          start = [month, t.start, from].sort().at(-1)!,
          end = [monthEnd, finish, until].sort()[0];
        if (end <= start) continue;
        const monthAmount = periodShare(
          Math.abs(net),
          t.start,
          t.period_unit,
          t.period_count,
          month.slice(0, 7),
        );
        const periodStart = month > t.start ? month : t.start,
          periodEnd = monthEnd < finish ? monthEnd : finish;
        const amount = intersectAmount(monthAmount, periodStart, periodEnd, start, end);
        if (!amount) continue;
        for (const copy of copies)
          rows.push({
            ...t,
            payments: [{ wallet: t.account_id, date: t.paid_on }],
            id: copy.id,
            event_id: null,
            book_id: copy.book_id,
            created_by: copy.created_by,
            account_id: null,
            target_id: null,
            cost_owner_id: costOwner,
            cost_basis_amount: monthAmount,
            cost_basis_start: periodStart,
            cost_basis_end: periodEnd,
            amount,
            kind: net < 0 ? 'refund' : 'expense',
            date: start,
            occurred_at: '00:00:00',
            line_items: categoryItems,
            cost_period_end: end,
            cost_row_key: `legacy:${t.event}:${month}`,
          });
      }
    }
    return { claims, rows, excluded, refunds };
  });
  values.push(JSON.stringify(payload));
  const arg = '$' + values.length;
  const source = movementSource.replace('ledger_source AS', 'cash_source AS');
  // Keep cash rows as native columns so book/date filters can use transaction indexes.
  const transactionFields =
    't.id,t.book_id,t.account_id,t.target_id,t.kind,t.date,t.payee,t.category,t.note,t.external_id,t.created_by,t.version,t.deleted,t.created_at,t.platform,t.order_id,t.product,t.occurred_at,t.refund_of,t.event_id,t.line_items,t.verification_reason,t.title,t.scene,t.updated_at';
  return {
    excluded: payload.excluded,
    source: `${source}, cost_payload AS(SELECT ${arg}::jsonb AS data), cost_claims AS(
 SELECT (j->>'event')::uuid AS event,sum((j->>'amount')::bigint) AS amount FROM cost_payload,jsonb_array_elements(data->'claims') j GROUP BY 1
 ), ledger_source AS (
 SELECT ${transactionFields},CASE WHEN t.kind='expense' THEN GREATEST(0,t.amount-COALESCE(c.amount,0))::bigint ELSE t.amount END AS amount,
 t.family_movement_id,t.movement_family_id,t.movement_status,NULL::uuid AS cost_project_id,NULL::date AS cost_period_end,NULL::text AS cost_row_key,t.amount AS actual_amount,NULL::text AS cost_owner_id,NULL::bigint AS cost_basis_amount,NULL::date AS cost_basis_start,NULL::date AS cost_basis_end,NULL::jsonb AS payments
 FROM cash_source t LEFT JOIN cost_claims c ON c.event=COALESCE(t.event_id,t.id)
 WHERE (t.kind<>'expense' OR t.amount>COALESCE(c.amount,0)) AND NOT EXISTS(SELECT 1 FROM cost_payload,jsonb_array_elements_text(data->'refunds') r WHERE r::uuid=COALESCE(t.event_id,t.id))
 UNION ALL
 SELECT ${transactionFields},t.amount,NULL::uuid,NULL::uuid,NULL::text,(j->>'cost_project_id')::uuid,(j->>'cost_period_end')::date,j->>'cost_row_key',NULL::bigint,j->>'cost_owner_id',(j->>'cost_basis_amount')::bigint,(j->>'cost_basis_start')::date,(j->>'cost_basis_end')::date,j->'payments'
 FROM cost_payload,jsonb_array_elements(data->'rows') j CROSS JOIN LATERAL jsonb_populate_record(NULL::transactions,j) t
 )`,
  };
}
