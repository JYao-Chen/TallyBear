ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verification_reason text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS receipt_files(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,mime text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS transaction_receipts(transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,file_id uuid REFERENCES receipt_files(id) ON DELETE CASCADE,PRIMARY KEY(transaction_id,file_id));
CREATE TABLE IF NOT EXISTS ai_job_steps(job_id uuid REFERENCES ai_jobs(id) ON DELETE CASCADE,step text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(job_id,step));
CREATE TABLE IF NOT EXISTS wallets(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,primary_account uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL;
