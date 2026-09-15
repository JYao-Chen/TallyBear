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
