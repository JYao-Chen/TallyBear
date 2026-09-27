CREATE TABLE IF NOT EXISTS cost_projects (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id),
 family_id uuid REFERENCES families(id), title text NOT NULL,
 archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 active_plan jsonb, proposed_plan jsonb, active_stale boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cost_projects ADD COLUMN IF NOT EXISTS active_stale boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS cost_project_members (
 project_id uuid NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id), accepted_version integer,
 display_book_id uuid REFERENCES books(id),
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS cost_source_claims (
 project_id uuid NOT NULL REFERENCES cost_projects(id) ON DELETE CASCADE,
 transaction_id uuid NOT NULL REFERENCES transactions(id), event_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('expense','income')),
 amount bigint NOT NULL CHECK(amount>0), source_amount bigint NOT NULL,
 account_id uuid NOT NULL, date date NOT NULL,
 PRIMARY KEY(project_id,event_id)
);
CREATE INDEX IF NOT EXISTS cost_source_claims_event ON cost_source_claims(event_id);
CREATE TABLE IF NOT EXISTS cost_settlements (
 project_id uuid NOT NULL REFERENCES cost_projects(id),
 movement_id uuid NOT NULL REFERENCES family_movements(id),
 amount bigint NOT NULL CHECK(amount>0), PRIMARY KEY(project_id,movement_id)
);
CREATE TABLE IF NOT EXISTS cost_project_changes (
 id bigserial PRIMARY KEY, project_id uuid NOT NULL REFERENCES cost_projects(id),
 actor_id uuid NOT NULL REFERENCES users(id), operation text NOT NULL,
 version integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cost_member_offsets (
 project_id uuid NOT NULL REFERENCES cost_projects(id),
 user_id uuid NOT NULL REFERENCES users(id), entries jsonb NOT NULL DEFAULT '[]',
 PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS cost_member_income_claims (
 project_id uuid NOT NULL REFERENCES cost_projects(id), user_id uuid NOT NULL REFERENCES users(id),
 transaction_id uuid NOT NULL REFERENCES transactions(id), event_id uuid NOT NULL,
 amount bigint NOT NULL CHECK(amount>0), source_amount bigint NOT NULL,
 account_id uuid NOT NULL, date date NOT NULL,
 PRIMARY KEY(project_id,user_id,event_id)
);

-- Wallet IDs here are snapshots; wallet merges must remain possible.
ALTER TABLE cost_source_claims DROP CONSTRAINT IF EXISTS cost_source_claims_account_id_fkey;
ALTER TABLE cost_member_income_claims DROP CONSTRAINT IF EXISTS cost_member_income_claims_account_id_fkey;
