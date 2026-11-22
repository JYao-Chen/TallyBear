-- Personal context is separate from shared ledger rows and never affects balances.
CREATE TABLE IF NOT EXISTS profile_settings(
 user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
 location_enabled boolean NOT NULL DEFAULT false,
 retain_location boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profile_places(
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 name text NOT NULL, latitude double precision, longitude double precision,
 radius integer NOT NULL DEFAULT 1500 CHECK(radius BETWEEN 1500 AND 50000),
 version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_places_owner ON profile_places(user_id);
CREATE TABLE IF NOT EXISTS profile_contexts(
 user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 transaction_id uuid NOT NULL REFERENCES transactions ON DELETE CASCADE,
 place_id uuid REFERENCES profile_places ON DELETE SET NULL,
 context jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(user_id,transaction_id)
);
CREATE TABLE IF NOT EXISTS profile_rules(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 condition jsonb NOT NULL,field text NOT NULL,value text NOT NULL DEFAULT '',
 state text NOT NULL CHECK(state IN ('confirmed','rejected','disabled')),
 version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_rules_owner ON profile_rules(user_id);
CREATE TABLE IF NOT EXISTS profile_events(
 id bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 operation text NOT NULL,rule_id uuid,previous jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
