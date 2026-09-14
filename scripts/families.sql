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
