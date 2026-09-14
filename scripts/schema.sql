CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL, password text NOT NULL, admin boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(id text PRIMARY KEY,user_id uuid REFERENCES users ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS books(id uuid PRIMARY KEY,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('private','shared')),owner_id uuid NOT NULL REFERENCES users,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS members(book_id uuid REFERENCES books ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,role text NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(book_id,user_id));
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books ON DELETE CASCADE,name text NOT NULL,opening bigint NOT NULL DEFAULT 0,UNIQUE(book_id,id));
CREATE TABLE IF NOT EXISTS transactions(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books,account_id uuid NOT NULL, target_id uuid,kind text NOT NULL CHECK(kind IN ('income','expense','transfer')),amount bigint NOT NULL CHECK(amount>0),date date NOT NULL,payee text NOT NULL DEFAULT '',category text NOT NULL DEFAULT '其他',note text NOT NULL DEFAULT '',external_id text,created_by uuid NOT NULL REFERENCES users,version integer NOT NULL DEFAULT 1,deleted boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now(),FOREIGN KEY(book_id,account_id) REFERENCES accounts(book_id,id),FOREIGN KEY(book_id,target_id) REFERENCES accounts(book_id,id),CHECK((kind='transfer' AND target_id IS NOT NULL AND target_id<>account_id) OR (kind<>'transfer' AND target_id IS NULL)),UNIQUE(book_id,external_id));
CREATE INDEX IF NOT EXISTS transactions_book_date ON transactions(book_id,date DESC);
CREATE TABLE IF NOT EXISTS budgets(book_id uuid REFERENCES books,month text NOT NULL,category text NOT NULL,amount bigint NOT NULL CHECK(amount>=0),PRIMARY KEY(book_id,month,category));
CREATE TABLE IF NOT EXISTS ai_settings(id integer PRIMARY KEY CHECK(id=1),base_url text NOT NULL,model text NOT NULL,vision_model text NOT NULL,encrypted_key text NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts(username text PRIMARY KEY,count integer NOT NULL DEFAULT 0,window_start timestamptz NOT NULL DEFAULT now());

BEGIN;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_check CHECK(kind IN ('income','expense','transfer','refund'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS order_id text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS occurred_at text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS refund_of uuid REFERENCES transactions(id);
COMMIT;

BEGIN;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS account_adjustments(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books,account_id uuid NOT NULL,amount bigint NOT NULL CHECK(amount<>0),note text NOT NULL,created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(book_id,account_id) REFERENCES accounts(book_id,id));
COMMIT;

CREATE TABLE IF NOT EXISTS entry_drafts(book_id uuid REFERENCES books ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,section text NOT NULL CHECK(section IN ('intake','images','manual')),value jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(book_id,user_id,section));

CREATE TABLE IF NOT EXISTS category_preferences(book_id uuid REFERENCES books ON DELETE CASCADE,name text NOT NULL,icon text NOT NULL DEFAULT '🧸',archived boolean NOT NULL DEFAULT false,PRIMARY KEY(book_id,name));
CREATE TABLE IF NOT EXISTS entry_templates(id uuid PRIMARY KEY,book_id uuid REFERENCES books ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,name text NOT NULL,value jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS bill_schedules(id uuid PRIMARY KEY,book_id uuid REFERENCES books ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,name text NOT NULL,value jsonb NOT NULL,frequency text NOT NULL CHECK(frequency IN ('weekly','monthly','yearly')),next_date date NOT NULL,anchor_day integer NOT NULL CHECK(anchor_day BETWEEN 1 AND 31),paused boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS schedule_occurrences(schedule_id uuid REFERENCES bill_schedules ON DELETE CASCADE,due_date date NOT NULL,transaction_id uuid REFERENCES transactions(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(schedule_id,due_date));

ALTER TABLE category_preferences ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

ALTER TABLE bill_schedules ADD COLUMN IF NOT EXISTS interval_months integer NOT NULL DEFAULT 0 CHECK(interval_months BETWEEN 0 AND 1200);
ALTER TABLE bill_schedules ADD COLUMN IF NOT EXISTS amortize boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS expense_allocations(transaction_id uuid PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,start_month date NOT NULL CHECK(EXTRACT(DAY FROM start_month)=1),months integer NOT NULL CHECK(months BETWEEN 1 AND 1200));

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT '🧸';
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '📒';
ALTER TABLE books ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS event_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_book_event ON transactions(book_id,event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_conversations(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,title text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS finance_turns(id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES finance_conversations ON DELETE CASCADE,question text NOT NULL,answer text NOT NULL DEFAULT '',artifacts jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'running',model text NOT NULL DEFAULT '',error text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS finance_reports(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,title text NOT NULL,content text NOT NULL,artifacts jsonb NOT NULL,model text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'bear';

CREATE TABLE IF NOT EXISTS ai_queue_settings (id int PRIMARY KEY CHECK(id=1), concurrency int NOT NULL DEFAULT 2 CHECK(concurrency BETWEEN 1 AND 8));
INSERT INTO ai_queue_settings VALUES(1,2) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ai_jobs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 book_id uuid REFERENCES books(id) ON DELETE CASCADE, kind text NOT NULL,
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'queued', stage text NOT NULL DEFAULT '等待处理',
 result jsonb, error text NOT NULL DEFAULT '', cancel_requested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_jobs_pending ON ai_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS ai_jobs_user ON ai_jobs(user_id,created_at);
CREATE TABLE IF NOT EXISTS ai_job_events (seq bigserial PRIMARY KEY,job_id uuid NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,event text NOT NULL,data jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS ai_job_events_job ON ai_job_events(job_id,seq);

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='type') THEN
  ALTER TABLE accounts ADD COLUMN type text NOT NULL DEFAULT 'other';
  UPDATE accounts SET type=CASE WHEN name='微信' THEN 'wechat' WHEN name='支付宝' THEN 'alipay' WHEN name='银行卡' THEN 'bank' WHEN name='现金' THEN 'cash' ELSE 'other' END;
 END IF;
END $$;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS holder text NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS institution text NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suffix text NOT NULL DEFAULT '';

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'unspecified' CHECK (ownership IN ('shared','personal','unspecified'));

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verification_reason text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS receipt_files(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,mime text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS transaction_receipts(transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,file_id uuid REFERENCES receipt_files(id) ON DELETE CASCADE,PRIMARY KEY(transaction_id,file_id));
CREATE TABLE IF NOT EXISTS ai_job_steps(job_id uuid REFERENCES ai_jobs(id) ON DELETE CASCADE,step text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(job_id,step));
CREATE TABLE IF NOT EXISTS wallets(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,primary_account uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL;

ALTER TABLE receipt_files ADD COLUMN IF NOT EXISTS temporary boolean NOT NULL DEFAULT false;

ALTER TABLE transaction_receipts ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'receipt';

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

ALTER TABLE bill_schedules DROP CONSTRAINT IF EXISTS bill_schedules_frequency_check;
ALTER TABLE bill_schedules ADD CONSTRAINT bill_schedules_frequency_check CHECK(frequency IN ('daily','weekly','monthly','yearly'));
ALTER TABLE bill_schedules DROP CONSTRAINT IF EXISTS bill_schedules_interval_months_check;
ALTER TABLE bill_schedules ADD COLUMN IF NOT EXISTS interval_count integer;
UPDATE bill_schedules SET frequency='monthly' WHERE interval_count IS NULL AND frequency='yearly' AND interval_months>0 AND interval_months%12<>0;
UPDATE bill_schedules SET interval_count=CASE WHEN frequency='weekly' THEN 1 WHEN frequency='yearly' THEN greatest(interval_months/12,1) ELSE greatest(interval_months,1) END WHERE interval_count IS NULL;
ALTER TABLE bill_schedules ALTER COLUMN interval_count SET DEFAULT 1;
ALTER TABLE bill_schedules ALTER COLUMN interval_count SET NOT NULL;
ALTER TABLE expense_allocations DROP CONSTRAINT IF EXISTS expense_allocations_months_check;
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS period_unit text NOT NULL DEFAULT 'month';
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS period_count integer;
ALTER TABLE expense_allocations ADD COLUMN IF NOT EXISTS start_date date;
UPDATE expense_allocations SET period_count=months,start_date=start_month WHERE period_count IS NULL;

ALTER TABLE bill_schedules ADD CONSTRAINT bill_schedules_interval_months_check CHECK(interval_months>=0);
ALTER TABLE expense_allocations ADD CONSTRAINT expense_allocations_months_check CHECK(months>=1);
CREATE TABLE IF NOT EXISTS families (
 id uuid PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
 owner_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_members (
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(family_id,user_id)
);
CREATE TABLE IF NOT EXISTS family_invitations (
 family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(family_id,user_id)
);
ALTER TABLE books ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS books_family_idx ON books(family_id);
ALTER TABLE families ADD COLUMN IF NOT EXISTS avatar text NOT NULL DEFAULT '🏡';
CREATE TABLE IF NOT EXISTS deployment_settings (
 id integer PRIMARY KEY CHECK(id=1), currency text NOT NULL CHECK(currency IN ('CNY','USD','EUR','GBP'))
);

ALTER TABLE category_preferences ADD COLUMN IF NOT EXISTS position integer;
