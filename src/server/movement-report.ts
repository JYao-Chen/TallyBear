// Display projections only: balances continue to use the single family movement.
export const movementReportSource=`WITH selected_books AS (SELECT * FROM books WHERE id=ANY($1::uuid[])), personal_scope AS (SELECT count(DISTINCT owner_id)=1 AND bool_and(kind='private') AS personal FROM selected_books), ledger_source AS (
 SELECT t.*,NULL::uuid AS family_movement_id,NULL::uuid AS movement_family_id,NULL::text AS movement_status FROM transactions t
 UNION ALL
 SELECT (jsonb_populate_record(NULL::transactions,jsonb_build_object(
 'id',v.id,'book_id',l.book_id,'created_by',l.user_id,'account_id',CASE WHEN v.sender_id=l.user_id THEN v.source_id ELSE v.target_id END,
 'kind',CASE WHEN v.status='confirmed' AND v.kind='gift' AND (SELECT personal FROM personal_scope) THEN CASE WHEN v.sender_id=l.user_id THEN 'expense' ELSE 'income' END ELSE 'transfer' END,
 'amount',v.amount,'date',v.date,'title',CASE WHEN v.sender_id=l.user_id THEN '转给 '||COALESCE(r.name,'共同钱包') ELSE '收到 '||s.name||'的转账' END,
 'payee',CASE WHEN v.sender_id=l.user_id THEN COALESCE(r.name,'共同钱包') ELSE s.name END,
 'category',CASE WHEN v.kind='gift' THEN '人情往来' ELSE '家庭转账' END,'note',v.note,'platform',v.platform,'external_id',v.external_id,
 'created_at',v.created_at,'updated_at',COALESCE(v.confirmed_at,v.created_at),'version',0,'deleted',false,'line_items','[]'::jsonb,'scene','{}'::jsonb
 ))).*,v.id,v.family_id,v.status
 FROM family_movement_books l JOIN family_movements v ON v.id=l.movement_id JOIN books b ON b.id=l.book_id AND b.owner_id=l.user_id AND b.kind='private' JOIN users s ON s.id=v.sender_id LEFT JOIN users r ON r.id=v.recipient_id
 WHERE l.book_id=ANY($1::uuid[]) AND v.status<>'cancelled' AND (v.sender_id=l.user_id OR v.status='confirmed')
)`;
