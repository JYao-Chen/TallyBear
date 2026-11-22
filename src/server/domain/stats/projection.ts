import { categoryPartsSql, periodCategoryPartsSql } from '../../item-category-sql';

export const claimRecipient = `COALESCE((SELECT ec.recipient_id FROM expense_claims ec WHERE ec.event_id=COALESCE(t.event_id,t.id) AND ec.status='accepted' LIMIT 1),(SELECT ec.recipient_id FROM expense_claim_links el JOIN expense_claims ec ON ec.id=el.claim_id WHERE el.active AND ec.status='accepted' AND (el.target_id=t.id OR el.source_id=t.id) LIMIT 1))`;

export const signedCategoryAmount = "CASE WHEN kind='refund' THEN -1 ELSE 1 END*(p->>'amount')::bigint";

// Period rows may have multiple original payments across wallets and dates.
export function consumptionRows(options: {
  fields: string;
  joins: string;
  where: string;
  categoryPredicate: string;
  period?: boolean;
  owner?: string;
}) {
  const { fields, joins, where, categoryPredicate, period, owner } = options;
  const event = period
    ? 'COALESCE(t.cost_row_key,COALESCE(t.event_id,t.id)::text)'
    : 'COALESCE(t.event_id,t.id)::text';
  const accountOwner = `COALESCE((${claimRecipient})::text,a.owner_id::text,'family:'||a.family_id,CASE WHEN t.account_id IS NULL THEN t.created_by::text END)`;
  const attribution = period
    ? `CASE WHEN t.cost_row_key IS NOT NULL THEN t.cost_owner_id ELSE ${accountOwner} END`
    : accountOwner;
  const payment = "jsonb_build_array(jsonb_build_object('wallet',t.account_id,'date',t.date))";
  return `SELECT DISTINCT ON (${event}) ${fields},${event} AS event_key,${attribution} AS attributed_owner,
    t.date AS period_start,${period ? 'COALESCE(t.cost_period_end,t.date+1)' : 't.date+1'} AS period_end,
    ${period ? `COALESCE(t.payments,${payment})` : payment} AS payments,
    classification.parts AS category_parts,classification.matched_amount
    FROM ${joins} CROSS JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) AS parts,COALESCE(sum((p->>'amount')::bigint),0)::bigint AS matched_amount
      FROM jsonb_array_elements(${period ? periodCategoryPartsSql() : categoryPartsSql()}) p WHERE ${categoryPredicate}
    ) classification WHERE ${where}${owner ? ` AND (${attribution})=${owner}` : ''} ORDER BY ${event},t.created_at,t.id`;
}

// Internal attribution can include payments from books outside the viewer's scope.
export const publicPageRow =
  "to_jsonb(page) - ARRAY['event_key','attributed_owner','period_start','period_end','payments']";
