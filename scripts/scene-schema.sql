ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scene jsonb NOT NULL DEFAULT '{}'::jsonb;
