// Consumption belongs only to the accepted destination. Payment rows stay intact for wallets and claim history.
export function claimBookVisibility(alias='t'){
 return `NOT EXISTS(SELECT 1 FROM expense_claims claim_visibility JOIN transactions claim_destination ON claim_destination.id=claim_visibility.target_id
 WHERE claim_visibility.status='accepted' AND claim_destination.book_id<>${alias}.book_id
 AND (claim_visibility.event_id=COALESCE(${alias}.event_id,${alias}.id)
 OR claim_visibility.event_id=(SELECT COALESCE(claim_original.event_id,claim_original.id) FROM transactions claim_original WHERE claim_original.id=${alias}.refund_of)
 OR EXISTS(SELECT 1 FROM expense_claim_links claim_link WHERE claim_link.claim_id=claim_visibility.id AND claim_link.active AND (claim_link.source_id=${alias}.id OR claim_link.target_id=${alias}.id))))`;
}
