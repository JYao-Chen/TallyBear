
-- Existing modification times are unknown; retain NULL until the next edit.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE OR REPLACE FUNCTION stamp_transaction_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.updated_at=now();
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS transaction_updated_at ON transactions;
CREATE TRIGGER transaction_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION stamp_transaction_update();
