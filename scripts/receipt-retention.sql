ALTER TABLE receipt_files ADD COLUMN IF NOT EXISTS temporary boolean NOT NULL DEFAULT false;
