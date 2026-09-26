-- Apply after schema.sql. pgvector is installed separately; no production volume changes.
CREATE TABLE IF NOT EXISTS memory_settings(user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,enabled boolean NOT NULL DEFAULT true);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS memory_suggestions jsonb NOT NULL DEFAULT '[]';
-- Add only identity metadata, never rewrite monetary facts or item order.
BEGIN;
ALTER TABLE transactions DISABLE TRIGGER transaction_updated_at;
UPDATE transactions t SET line_items=(SELECT jsonb_agg(CASE WHEN item ? 'id' THEN item ELSE item||jsonb_build_object('id',gen_random_uuid()) END ORDER BY ordinal) FROM jsonb_array_elements(t.line_items) WITH ORDINALITY AS x(item,ordinal)) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.line_items) i WHERE NOT i ? 'id');
ALTER TABLE transactions ENABLE TRIGGER transaction_updated_at;
COMMIT;
CREATE TABLE IF NOT EXISTS memory_models(
 role text PRIMARY KEY CHECK(role IN ('embedding','extraction','judgment')),base_url text NOT NULL,model text NOT NULL,encrypted_key text NOT NULL,
 dimensions integer NOT NULL DEFAULT 1024 CHECK(dimensions BETWEEN 1 AND 4096),version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS memories(
 id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,family_id uuid REFERENCES families ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('product','preference','subscription','activity','conversation','todo','negative')),
 title text NOT NULL,content text NOT NULL DEFAULT '',attributes jsonb NOT NULL DEFAULT '{}',aliases jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('active','pending','disabled','forgotten')),
 explicit boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_owner ON memories(owner_id,status);
CREATE TABLE IF NOT EXISTS memory_sources(
 memory_id uuid NOT NULL REFERENCES memories ON DELETE CASCADE,source_type text NOT NULL CHECK(source_type IN ('transaction','turn')),
 source_id uuid NOT NULL,item_id text NOT NULL DEFAULT '',source_version integer NOT NULL DEFAULT 0,
 PRIMARY KEY(memory_id,source_type,source_id,item_id)
);
CREATE TABLE IF NOT EXISTS memory_exclusions(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,source_type text NOT NULL,source_id uuid NOT NULL,item_id text NOT NULL DEFAULT '',PRIMARY KEY(user_id,source_type,source_id,item_id));
ALTER TABLE memory_sources ADD COLUMN IF NOT EXISTS source_text text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS memory_events(id bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,memory_id uuid REFERENCES memories ON DELETE CASCADE,operation text NOT NULL,previous jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memory_vectors(memory_id uuid NOT NULL REFERENCES memories ON DELETE CASCADE,model_version integer NOT NULL,content_version integer NOT NULL,dimensions integer NOT NULL,embedding double precision[] NOT NULL,PRIMARY KEY(memory_id,model_version));
CREATE TABLE IF NOT EXISTS memory_model_calls(id bigserial PRIMARY KEY,role text NOT NULL,model text NOT NULL,elapsed_ms integer NOT NULL,success boolean NOT NULL,tokens integer,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS memory_embedding_versions(version integer PRIMARY KEY,base_url text NOT NULL,model text NOT NULL,encrypted_key text NOT NULL,dimensions integer NOT NULL);
CREATE TABLE IF NOT EXISTS memory_embedding_active(user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,version integer NOT NULL);
CREATE TABLE IF NOT EXISTS memory_outbox(id bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,source_type text NOT NULL,source_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,source_type,source_id));
CREATE OR REPLACE FUNCTION memory_transaction_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.created_by IS NOT NULL THEN
  INSERT INTO memory_outbox(user_id,source_type,source_id) VALUES(NEW.created_by,'transaction',NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS memory_transaction_changed ON transactions;
CREATE TRIGGER memory_transaction_changed AFTER INSERT OR UPDATE OF category,product,payee,line_items,deleted,memory_suggestions,title,scene,version ON transactions FOR EACH ROW EXECUTE FUNCTION memory_transaction_changed();
CREATE OR REPLACE FUNCTION memory_turn_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='complete' AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO memory_outbox(user_id,source_type,source_id) SELECT user_id,'turn',NEW.id FROM finance_conversations WHERE id=NEW.conversation_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS memory_turn_completed ON finance_turns;
CREATE TRIGGER memory_turn_completed AFTER UPDATE OF status ON finance_turns FOR EACH ROW EXECUTE FUNCTION memory_turn_completed();
