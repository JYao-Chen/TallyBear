CREATE TABLE IF NOT EXISTS expense_claims (
 id uuid PRIMARY KEY, event_id uuid NOT NULL,
 source_id uuid NOT NULL REFERENCES transactions(id),
 sender_id uuid NOT NULL REFERENCES users(id), recipient_id uuid NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('pending','accepted','declined','withdrawn')),
 target_id uuid REFERENCES transactions(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(sender_id<>recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS expense_claims_active_event ON expense_claims(event_id) WHERE status IN ('pending','accepted');
CREATE TABLE IF NOT EXISTS expense_claim_links (
 claim_id uuid NOT NULL REFERENCES expense_claims(id), source_id uuid NOT NULL REFERENCES transactions(id),
 target_id uuid NOT NULL REFERENCES transactions(id), managed boolean NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(claim_id,target_id)
);
CREATE TABLE IF NOT EXISTS expense_claim_events (
 id bigserial PRIMARY KEY, claim_id uuid NOT NULL REFERENCES expense_claims(id),
 user_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL,
 seen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_claim_events_unread ON expense_claim_events(user_id,id DESC) WHERE NOT seen;

CREATE OR REPLACE FUNCTION sync_expense_claim_facts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim record; changed boolean;
BEGIN
 changed := (NEW.amount,NEW.date,NEW.account_id,NEW.kind,NEW.title,NEW.product,NEW.payee,NEW.line_items,NEW.note,NEW.deleted)
  IS DISTINCT FROM (OLD.amount,OLD.date,OLD.account_id,OLD.kind,OLD.title,OLD.product,OLD.payee,OLD.line_items,OLD.note,OLD.deleted);
 IF NOT changed THEN RETURN NEW; END IF;
 FOR claim IN SELECT DISTINCT c.* FROM expense_claims c JOIN expense_claim_links l ON l.claim_id=c.id
  WHERE c.status='accepted' AND l.active AND l.source_id=NEW.id
 LOOP
  UPDATE transactions t SET amount=NEW.amount,date=NEW.date,account_id=NEW.account_id,kind=NEW.kind,
   title=CASE WHEN t.title IS NOT DISTINCT FROM OLD.title THEN NEW.title ELSE t.title END,product=NEW.product,payee=NEW.payee,line_items=NEW.line_items,deleted=NEW.deleted,
   version=t.version+1,updated_at=now()
  FROM expense_claim_links l WHERE l.claim_id=claim.id AND l.active AND l.source_id=NEW.id AND t.id=l.target_id AND t.id<>NEW.id;
 END LOOP;
 FOR claim IN SELECT * FROM expense_claims WHERE source_id=NEW.id AND status IN ('pending','accepted')
 LOOP
  IF NEW.deleted OR NEW.kind<>'expense' THEN
   UPDATE expense_claims SET snapshot=jsonb_build_object('title',NEW.title,'product',NEW.product,'payee',NEW.payee,'category',NEW.category,'note',NEW.note,'line_items',NEW.line_items,'amount',NEW.amount,'date',to_char(NEW.date,'YYYY-MM-DD'),'deleted',NEW.deleted,'refunded',(SELECT COALESCE(sum(r.amount),0) FROM transactions r WHERE r.refund_of=NEW.id AND NOT r.deleted)),status='withdrawn',version=version+1,updated_at=now() WHERE id=claim.id;
   UPDATE transactions t SET deleted=true,version=t.version+1 FROM expense_claim_links l
    WHERE l.claim_id=claim.id AND l.active AND l.managed AND t.id=l.target_id AND t.id<>NEW.id;
   UPDATE expense_claim_links SET active=false WHERE claim_id=claim.id;
  ELSE
   UPDATE expense_claims SET snapshot=jsonb_build_object('title',NEW.title,'product',NEW.product,'payee',NEW.payee,'category',NEW.category,'note',NEW.note,'line_items',NEW.line_items,'amount',NEW.amount,'date',to_char(NEW.date,'YYYY-MM-DD'),'deleted',NEW.deleted,'refunded',(SELECT COALESCE(sum(r.amount),0) FROM transactions r WHERE r.refund_of=NEW.id AND NOT r.deleted)),version=version+1,updated_at=now() WHERE id=claim.id;
  END IF;
  INSERT INTO expense_claim_events(claim_id,user_id,kind) VALUES(claim.id,claim.recipient_id,CASE WHEN NEW.deleted OR NEW.kind<>'expense' THEN 'source_deleted' ELSE 'source_changed' END);
 END LOOP;
 FOR claim IN SELECT * FROM expense_claims WHERE source_id=NEW.refund_of AND status IN ('pending','accepted')
 LOOP
  UPDATE expense_claims SET snapshot=jsonb_set(snapshot,'{refunded}',to_jsonb((SELECT COALESCE(sum(r.amount),0) FROM transactions r WHERE r.refund_of=claim.source_id AND NOT r.deleted))),version=version+1,updated_at=now() WHERE id=claim.id;
  INSERT INTO expense_claim_events(claim_id,user_id,kind) VALUES(claim.id,claim.recipient_id,'source_changed');
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expense_claim_facts ON transactions;
CREATE TRIGGER expense_claim_facts AFTER UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION sync_expense_claim_facts();

ALTER TABLE discussion_threads DROP CONSTRAINT IF EXISTS discussion_threads_kind_check;
ALTER TABLE discussion_threads ADD CONSTRAINT discussion_threads_kind_check CHECK(kind IN ('movement','transaction','project','schedule','claim'));

CREATE OR REPLACE FUNCTION withdraw_departed_expense_claims() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim record;
BEGIN
 FOR claim IN SELECT c.* FROM expense_claims c WHERE OLD.user_id IN(c.sender_id,c.recipient_id)
  AND c.status IN ('pending','accepted') AND NOT EXISTS(
   SELECT 1 FROM family_members a JOIN family_members b ON b.family_id=a.family_id
   WHERE a.user_id=c.sender_id AND b.user_id=c.recipient_id)
 LOOP
  UPDATE expense_claims SET status='withdrawn',version=version+1,updated_at=now() WHERE id=claim.id;
  UPDATE expense_claim_links SET active=false WHERE claim_id=claim.id;
  UPDATE transactions t SET deleted=true,version=t.version+1 FROM expense_claim_links l WHERE l.claim_id=claim.id AND l.managed AND t.id=l.target_id;
  INSERT INTO expense_claim_events(claim_id,user_id,kind) VALUES(claim.id,claim.sender_id,'membership_removed'),(claim.id,claim.recipient_id,'membership_removed');
 END LOOP;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS expense_claim_departure ON family_members;
CREATE TRIGGER expense_claim_departure AFTER DELETE ON family_members FOR EACH ROW EXECUTE FUNCTION withdraw_departed_expense_claims();
