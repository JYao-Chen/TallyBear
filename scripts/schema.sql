CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL, password text NOT NULL, admin boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(id text PRIMARY KEY,user_id uuid REFERENCES users ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS books(id uuid PRIMARY KEY,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('private','shared')),owner_id uuid NOT NULL REFERENCES users,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS members(book_id uuid REFERENCES books ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,role text NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(book_id,user_id));
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books ON DELETE CASCADE,name text NOT NULL,opening bigint NOT NULL DEFAULT 0,UNIQUE(book_id,id));
CREATE TABLE IF NOT EXISTS transactions(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books,account_id uuid NOT NULL, target_id uuid,kind text NOT NULL CHECK(kind IN ('income','expense','transfer')),amount bigint NOT NULL CHECK(amount>0),date date NOT NULL,payee text NOT NULL DEFAULT '',category text NOT NULL DEFAULT '其他',note text NOT NULL DEFAULT '',external_id text,created_by uuid NOT NULL REFERENCES users,version integer NOT NULL DEFAULT 1,deleted boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now(),FOREIGN KEY(book_id,account_id) REFERENCES accounts(book_id,id),FOREIGN KEY(book_id,target_id) REFERENCES accounts(book_id,id),CHECK((kind='transfer' AND target_id IS NOT NULL AND target_id<>account_id) OR (kind<>'transfer' AND target_id IS NULL)),UNIQUE(book_id,external_id));
CREATE INDEX IF NOT EXISTS transactions_book_date ON transactions(book_id,date DESC);
CREATE TABLE IF NOT EXISTS budgets(book_id uuid REFERENCES books,month text NOT NULL,category text NOT NULL,amount bigint NOT NULL CHECK(amount>=0),PRIMARY KEY(book_id,month,category));
CREATE TABLE IF NOT EXISTS ai_settings(id integer PRIMARY KEY CHECK(id=1),base_url text NOT NULL,model text NOT NULL,vision_model text NOT NULL,encrypted_key text NOT NULL);
CREATE TABLE IF NOT EXISTS assistant_ai_settings(id integer PRIMARY KEY CHECK(id=1),base_url text NOT NULL,model text NOT NULL,vision_model text NOT NULL,encrypted_key text NOT NULL);
-- Existing installations start with identical settings; administrators can then separate them safely.
INSERT INTO assistant_ai_settings SELECT * FROM ai_settings WHERE id=1 ON CONFLICT(id) DO NOTHING;
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
CREATE TABLE IF NOT EXISTS category_feedback(
 transaction_id uuid PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
 book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 proposed_category text NOT NULL DEFAULT '',original_category text NOT NULL DEFAULT '',final_category text NOT NULL,
 source text NOT NULL CHECK(source IN ('confirmed','manual')),corrected boolean NOT NULL DEFAULT false,
 confidence double precision,basis text,evidence_count integer NOT NULL DEFAULT 0,
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS category_feedback_user_idx ON category_feedback(user_id,confirmed_at DESC);

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

-- Accounts belong to people or families. Books classify entries, never assets.
BEGIN;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families(id);
DO $$
DECLARE item record; mapped record;
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='book_id') THEN
  UPDATE accounts a SET owner_id=b.owner_id FROM books b WHERE b.id=a.book_id;
  UPDATE accounts a SET owner_id=NULL,family_id=b.family_id FROM books b
   WHERE b.id=a.book_id AND a.ownership='shared' AND b.family_id IS NOT NULL;
  -- Remove only the compound account FKs; transaction/book and refund FKs stay.
  FOR item IN SELECT conrelid::regclass AS tbl,conname FROM pg_constraint
   WHERE confrelid='accounts'::regclass AND contype='f' AND array_length(conkey,1)=2
  LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',item.tbl,item.conname); END LOOP;
  -- Explicitly linked legacy wallets are one actual asset, not several balances.
  FOR mapped IN SELECT a.id,w.primary_account,w.owner_id FROM accounts a JOIN wallets w ON w.id=a.wallet_id WHERE a.id<>w.primary_account
  LOOP
   UPDATE transactions SET account_id=mapped.primary_account WHERE account_id=mapped.id;
   UPDATE transactions SET target_id=mapped.primary_account WHERE target_id=mapped.id;
   UPDATE account_adjustments SET account_id=mapped.primary_account WHERE account_id=mapped.id;
   UPDATE entry_drafts SET value=replace(value::text,mapped.id::text,mapped.primary_account::text)::jsonb WHERE value::text LIKE '%'||mapped.id::text||'%';
   UPDATE entry_templates SET value=replace(value::text,mapped.id::text,mapped.primary_account::text)::jsonb WHERE value::text LIKE '%'||mapped.id::text||'%';
   UPDATE bill_schedules SET value=replace(value::text,mapped.id::text,mapped.primary_account::text)::jsonb WHERE value::text LIKE '%'||mapped.id::text||'%';
   DELETE FROM accounts WHERE id=mapped.id;
  END LOOP;
  UPDATE accounts a SET owner_id=w.owner_id,family_id=NULL FROM wallets w WHERE a.id=w.primary_account;
  UPDATE transactions t SET account_id=original.account_id FROM (SELECT DISTINCT ON(event_id) event_id,account_id FROM transactions WHERE event_id IS NOT NULL ORDER BY event_id,created_at,id) original WHERE t.event_id=original.event_id;
  ALTER TABLE accounts DROP COLUMN book_id;
  ALTER TABLE account_adjustments DROP COLUMN book_id;
 END IF;
END $$;
ALTER TABLE accounts DROP COLUMN IF EXISTS wallet_id;
DROP TABLE IF EXISTS wallets;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_asset_owner;
ALTER TABLE accounts ADD CONSTRAINT accounts_asset_owner CHECK((owner_id IS NOT NULL)::int+(family_id IS NOT NULL)::int=1);
UPDATE accounts SET ownership=CASE WHEN owner_id IS NOT NULL THEN 'personal' ELSE 'shared' END;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='transactions_asset_account') THEN
  ALTER TABLE transactions ADD CONSTRAINT transactions_asset_account FOREIGN KEY(account_id) REFERENCES accounts(id);
  ALTER TABLE transactions ADD CONSTRAINT transactions_asset_target FOREIGN KEY(target_id) REFERENCES accounts(id);
  ALTER TABLE account_adjustments ADD CONSTRAINT adjustments_asset_account FOREIGN KEY(account_id) REFERENCES accounts(id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS accounts_owner_idx ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS accounts_family_idx ON accounts(family_id);
COMMIT;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scene jsonb NOT NULL DEFAULT '{}'::jsonb;

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
BEGIN;
CREATE TABLE IF NOT EXISTS installment_plans(
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), event_id uuid NOT NULL UNIQUE,
 name text NOT NULL, principal bigint NOT NULL CHECK(principal>0), schedule jsonb NOT NULL,
 schedule_base bigint NOT NULL DEFAULT 0, created_by uuid NOT NULL REFERENCES users(id),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS installment_payments(
 id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES installment_plans(id),
 principal bigint NOT NULL CHECK(principal>=0), fee bigint NOT NULL CHECK(fee>=0),
 date date NOT NULL, principal_event uuid UNIQUE, fee_event uuid UNIQUE,
 voided boolean NOT NULL DEFAULT false, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(principal+fee>0)
);
CREATE INDEX IF NOT EXISTS installment_payments_plan ON installment_payments(plan_id);
-- Finance changes must go through the plan; book moves and descriptive edits remain available.
CREATE OR REPLACE FUNCTION protect_installment_transactions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM installment_plans WHERE event_id=OLD.event_id) THEN
  IF NEW.date IS DISTINCT FROM OLD.date AND EXISTS(SELECT 1 FROM installment_payments r JOIN installment_plans p ON p.id=r.plan_id WHERE p.event_id=OLD.event_id AND NOT r.voided AND r.date<NEW.date) THEN RAISE EXCEPTION '购买日期不能晚于已登记的还款日期'; END IF;
  IF (NEW.amount,NEW.account_id,NEW.kind,NEW.event_id) IS DISTINCT FROM (OLD.amount,OLD.account_id,OLD.kind,OLD.event_id) THEN
   RAISE EXCEPTION '这笔消费已关联分期，请先移除分期计划后调整本金或负债账户';
  END IF;
  IF NEW.deleted AND NOT OLD.deleted AND NOT EXISTS(SELECT 1 FROM transactions WHERE event_id=OLD.event_id AND id<>OLD.id AND NOT deleted) THEN
   RAISE EXCEPTION '请先在分期与还款中处理关联计划，再删除原消费';
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM installment_payments WHERE NOT voided AND (principal_event=OLD.event_id OR fee_event=OLD.event_id)) AND
 (NEW.amount,NEW.account_id,NEW.target_id,NEW.kind,NEW.date,NEW.deleted,NEW.event_id) IS DISTINCT FROM (OLD.amount,OLD.account_id,OLD.target_id,OLD.kind,OLD.date,OLD.deleted,OLD.event_id) THEN
  RAISE EXCEPTION '请在分期与还款中撤销这次还款后重新登记';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS installment_transaction_guard ON transactions;
CREATE TRIGGER installment_transaction_guard BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION protect_installment_transactions();
COMMIT;
CREATE TABLE IF NOT EXISTS family_expense_shares (
 transaction_id uuid PRIMARY KEY REFERENCES transactions(id),
 family_id uuid NOT NULL REFERENCES families(id),
 shares jsonb NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_movements (
 id uuid PRIMARY KEY,
 family_id uuid NOT NULL REFERENCES families(id),
 sender_id uuid NOT NULL REFERENCES users(id),
 recipient_id uuid REFERENCES users(id),
 source_id uuid NOT NULL REFERENCES accounts(id),
 target_id uuid REFERENCES accounts(id),
 kind text NOT NULL CHECK(kind IN ('transfer','gift','aa','loan','repayment','contribution')),
 amount bigint NOT NULL CHECK(amount>0),
 date date NOT NULL,
 note text NOT NULL DEFAULT '',
 expense_id uuid REFERENCES transactions(id),
 loan_id uuid REFERENCES family_movements(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
 confirmed_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz,
 CHECK(target_id IS NULL OR target_id<>source_id)
);
CREATE INDEX IF NOT EXISTS family_movements_family ON family_movements(family_id,created_at DESC);
CREATE INDEX IF NOT EXISTS family_movements_source ON family_movements(source_id) WHERE status='confirmed';
CREATE INDEX IF NOT EXISTS family_movements_target ON family_movements(target_id) WHERE status='confirmed';
ALTER TABLE family_movements ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE family_movements ADD COLUMN IF NOT EXISTS platform text;
CREATE UNIQUE INDEX IF NOT EXISTS family_movement_reference ON family_movements(family_id,platform,external_id) WHERE external_id IS NOT NULL AND external_id<>'' AND status<>'cancelled';
CREATE TABLE IF NOT EXISTS family_movement_books(movement_id uuid NOT NULL REFERENCES family_movements(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,PRIMARY KEY(movement_id,user_id));
CREATE INDEX IF NOT EXISTS family_movement_books_book ON family_movement_books(book_id,user_id);
CREATE TABLE IF NOT EXISTS family_book_preferences(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,book_id uuid REFERENCES books(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS family_movement_details(
 movement_id uuid NOT NULL REFERENCES family_movements(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
 transaction_time text NOT NULL DEFAULT '', platform text NOT NULL DEFAULT '',
 external_id text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(movement_id,user_id)
);
ALTER TABLE receipt_files ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE receipt_files ADD COLUMN IF NOT EXISTS movement_id uuid REFERENCES family_movements(id) ON DELETE CASCADE;
ALTER TABLE receipt_files ADD COLUMN IF NOT EXISTS movement_purpose text;
