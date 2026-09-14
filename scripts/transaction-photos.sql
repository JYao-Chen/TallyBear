ALTER TABLE transaction_receipts ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'receipt';
