
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
