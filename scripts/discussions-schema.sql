CREATE TABLE IF NOT EXISTS discussion_threads (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('movement','transaction','project','schedule')),
 target_id uuid NOT NULL,
 scope text NOT NULL DEFAULT '',
 UNIQUE(kind,target_id,scope),
 CHECK(scope='' OR (kind='schedule' AND scope ~ '^\d{4}-\d{2}-\d{2}$'))
);
CREATE TABLE IF NOT EXISTS discussion_messages (
 id uuid PRIMARY KEY,
 seq bigserial NOT NULL UNIQUE,
 thread_id uuid NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
 reply_to uuid REFERENCES discussion_messages(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discussion_messages_thread_seq ON discussion_messages(thread_id,seq DESC);
CREATE TABLE IF NOT EXISTS discussion_reads (
 thread_id uuid NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_seq bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(thread_id,user_id)
);
