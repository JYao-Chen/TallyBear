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
