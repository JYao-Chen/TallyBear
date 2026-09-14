BEGIN;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS account_adjustments(id uuid PRIMARY KEY,book_id uuid NOT NULL REFERENCES books,account_id uuid NOT NULL,amount bigint NOT NULL CHECK(amount<>0),note text NOT NULL,created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(book_id,account_id) REFERENCES accounts(book_id,id));
COMMIT;
