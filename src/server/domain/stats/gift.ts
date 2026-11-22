// Ledger gifts count as income/expense in a personal book scope. Wallet gifts
// count when the counterparty is outside the selection. Internal gifts are transfers.
export function movementKindSql(view: 'ledger' | 'wallets') {
  const scope =
    view === 'ledger'
      ? '(SELECT personal FROM personal_scope)'
      : 'NOT (v.source_id=ANY(selected.ids) AND COALESCE(v.target_id=ANY(selected.ids),false))';
  const outgoing = view === 'ledger' ? 'v.sender_id=l.user_id' : 'v.source_id=ANY(selected.ids)';
  return `CASE WHEN v.status='confirmed' AND v.kind='gift' AND ${scope}
    THEN CASE WHEN ${outgoing} THEN 'expense' ELSE 'income' END ELSE 'transfer' END`;
}
