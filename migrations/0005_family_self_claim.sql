ALTER TABLE expense_claims
  DROP CONSTRAINT expense_claims_check,
  ADD CONSTRAINT expense_claims_self_status_check
    CHECK (sender_id <> recipient_id OR status IN ('accepted', 'withdrawn'));

CREATE OR REPLACE FUNCTION withdraw_departed_expense_claims() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE claim record;
BEGIN
  FOR claim IN
    SELECT c.* FROM expense_claims c
    JOIN transactions t ON t.id=c.source_id
    JOIN accounts wallet ON wallet.id=t.account_id
    WHERE OLD.user_id IN (c.sender_id,c.recipient_id)
      AND c.status IN ('pending','accepted')
      AND NOT EXISTS (
        SELECT 1 FROM family_members a JOIN family_members b USING(family_id)
        WHERE a.user_id=c.sender_id AND b.user_id=c.recipient_id
          AND (wallet.family_id IS NULL OR wallet.family_id=a.family_id)
      )
  LOOP
    UPDATE expense_claims SET status='withdrawn',version=version+1,updated_at=now() WHERE id=claim.id;
    UPDATE expense_claim_links SET active=false WHERE claim_id=claim.id;
    UPDATE transactions t SET deleted=true,version=t.version+1 FROM expense_claim_links l
      WHERE l.claim_id=claim.id AND l.managed AND t.id=l.target_id;
    INSERT INTO expense_claim_events(claim_id,user_id,kind)
      SELECT DISTINCT claim.id,member_id,'membership_removed'
      FROM unnest(ARRAY[claim.sender_id,claim.recipient_id]) member_id;
  END LOOP;
  RETURN OLD;
END $$;
