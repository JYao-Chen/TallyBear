ALTER TABLE account_adjustments ADD COLUMN effective_date date;
UPDATE account_adjustments SET effective_date = (created_at AT TIME ZONE 'Asia/Shanghai')::date;
ALTER TABLE account_adjustments
  ALTER COLUMN effective_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Shanghai')::date),
  ALTER COLUMN effective_date SET NOT NULL;

CREATE VIEW family_contributions AS
WITH transfers AS (
  SELECT 'family' AS origin, id AS event_id, source_id, target_id, amount, date
  FROM family_movements WHERE status = 'confirmed' AND kind IN ('transfer', 'contribution')
  UNION ALL
  SELECT 'transaction', t.event_id, t.account_id, t.target_id, t.amount, t.date
  FROM (
    SELECT DISTINCT ON (COALESCE(event_id, id)) COALESCE(event_id, id) AS event_id,
           account_id, target_id, amount, date
    FROM transactions WHERE kind = 'transfer' AND NOT deleted
    ORDER BY COALESCE(event_id, id), created_at, id
  ) t
)
SELECT v.origin, v.event_id, v.date, v.amount, s.owner_id AS member_id, d.family_id
FROM transfers v
JOIN accounts s ON s.id = v.source_id
JOIN accounts d ON d.id = v.target_id
JOIN family_members m ON m.family_id = d.family_id AND m.user_id = s.owner_id;
