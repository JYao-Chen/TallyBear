-- 0001 baseline：2026-11-22 从生产库 pg_dump --schema-only --no-owner --no-privileges 导出（main 4487483）。
-- 新库直接执行本文件；已有库由 scripts/migrate.mjs 先补跑 scripts/legacy-schema/ 再登记本版本，不重复建表。
-- pgvector 扩展为可选，由迁移程序单独尝试创建，本文件不依赖它。
-- 本文件发布后不再修改；结构变更写成新的编号迁移。

--
--

--
--

--
--

--
-- Name: memory_transaction_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.memory_transaction_changed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.created_by IS NOT NULL THEN
  INSERT INTO memory_outbox(user_id,source_type,source_id) VALUES(NEW.created_by,'transaction',NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;

--
-- Name: memory_turn_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.memory_turn_completed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.status='complete' AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO memory_outbox(user_id,source_type,source_id) SELECT user_id,'turn',NEW.id FROM finance_conversations WHERE id=NEW.conversation_id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;

--
-- Name: protect_installment_transactions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_installment_transactions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: stamp_transaction_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stamp_transaction_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 NEW.updated_at=now();
 RETURN NEW;
END;
$$;

--
-- Name: sync_expense_claim_facts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_expense_claim_facts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: withdraw_departed_expense_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.withdraw_departed_expense_claims() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

--
-- Name: account_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_adjustments (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    amount bigint NOT NULL,
    note text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_adjustments_amount_check CHECK ((amount <> 0))
);

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid NOT NULL,
    name text NOT NULL,
    opening bigint DEFAULT 0 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    type text DEFAULT 'other'::text NOT NULL,
    holder text DEFAULT ''::text NOT NULL,
    institution text DEFAULT ''::text NOT NULL,
    suffix text DEFAULT ''::text NOT NULL,
    ownership text DEFAULT 'unspecified'::text NOT NULL,
    owner_id uuid,
    family_id uuid,
    CONSTRAINT accounts_asset_owner CHECK (((((owner_id IS NOT NULL))::integer + ((family_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT accounts_ownership_check CHECK ((ownership = ANY (ARRAY['shared'::text, 'personal'::text, 'unspecified'::text])))
);

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    starts_on date,
    ends_on date,
    budget bigint,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT '其他'::text NOT NULL,
    family_id uuid,
    CONSTRAINT activities_budget_check CHECK (((budget IS NULL) OR (budget >= 0))),
    CONSTRAINT activities_check CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on)))
);

--
-- Name: activity_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_entries (
    transaction_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    activity_id uuid NOT NULL
);

--
-- Name: ai_job_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_job_events (
    seq bigint NOT NULL,
    job_id uuid NOT NULL,
    event text NOT NULL,
    data jsonb NOT NULL
);

--
-- Name: ai_job_events_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_job_events_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_job_events_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_job_events_seq_seq OWNED BY public.ai_job_events.seq;

--
-- Name: ai_job_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_job_steps (
    job_id uuid NOT NULL,
    step text NOT NULL,
    result jsonb NOT NULL
);

--
-- Name: ai_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_jobs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid,
    kind text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    stage text DEFAULT '等待处理'::text NOT NULL,
    result jsonb,
    error text DEFAULT ''::text NOT NULL,
    cancel_requested boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone
);

--
-- Name: ai_queue_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_queue_settings (
    id integer NOT NULL,
    concurrency integer DEFAULT 2 NOT NULL,
    CONSTRAINT ai_queue_settings_concurrency_check CHECK (((concurrency >= 1) AND (concurrency <= 8))),
    CONSTRAINT ai_queue_settings_id_check CHECK ((id = 1))
);

--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_settings (
    id integer NOT NULL,
    base_url text NOT NULL,
    model text NOT NULL,
    vision_model text NOT NULL,
    encrypted_key text NOT NULL,
    CONSTRAINT ai_settings_id_check CHECK ((id = 1))
);

--
-- Name: assistant_ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assistant_ai_settings (
    id integer NOT NULL,
    base_url text NOT NULL,
    model text NOT NULL,
    vision_model text NOT NULL,
    encrypted_key text NOT NULL,
    CONSTRAINT assistant_ai_settings_id_check CHECK ((id = 1))
);

--
-- Name: bill_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_schedules (
    id uuid NOT NULL,
    book_id uuid,
    user_id uuid,
    name text NOT NULL,
    value jsonb NOT NULL,
    frequency text NOT NULL,
    next_date date NOT NULL,
    anchor_day integer NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    interval_months integer DEFAULT 0 NOT NULL,
    amortize boolean DEFAULT false NOT NULL,
    interval_count integer DEFAULT 1 NOT NULL,
    CONSTRAINT bill_schedules_anchor_day_check CHECK (((anchor_day >= 1) AND (anchor_day <= 31))),
    CONSTRAINT bill_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text]))),
    CONSTRAINT bill_schedules_interval_months_check CHECK ((interval_months >= 0))
);

--
-- Name: books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.books (
    id uuid NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    icon text DEFAULT '📒'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    family_id uuid,
    CONSTRAINT books_kind_check CHECK ((kind = ANY (ARRAY['private'::text, 'shared'::text])))
);

--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    book_id uuid NOT NULL,
    month text NOT NULL,
    category text NOT NULL,
    amount bigint NOT NULL,
    CONSTRAINT budgets_amount_check CHECK ((amount >= 0))
);

--
-- Name: category_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_feedback (
    transaction_id uuid NOT NULL,
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    proposed_category text DEFAULT ''::text NOT NULL,
    original_category text DEFAULT ''::text NOT NULL,
    final_category text NOT NULL,
    source text NOT NULL,
    corrected boolean DEFAULT false NOT NULL,
    confidence double precision,
    basis text,
    evidence_count integer DEFAULT 0 NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT category_feedback_source_check CHECK ((source = ANY (ARRAY['confirmed'::text, 'manual'::text])))
);

--
-- Name: category_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_preferences (
    user_id uuid NOT NULL,
    name text NOT NULL,
    icon text DEFAULT '🧸'::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    "position" integer,
    family_shared boolean DEFAULT true NOT NULL
);

--
-- Name: cost_member_income_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_member_income_claims (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    event_id uuid NOT NULL,
    amount bigint NOT NULL,
    source_amount bigint NOT NULL,
    account_id uuid NOT NULL,
    date date NOT NULL,
    CONSTRAINT cost_member_income_claims_amount_check CHECK ((amount > 0))
);

--
-- Name: cost_member_offsets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_member_offsets (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entries jsonb DEFAULT '[]'::jsonb NOT NULL
);

--
-- Name: cost_project_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_project_changes (
    id bigint NOT NULL,
    project_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    operation text NOT NULL,
    version integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: cost_project_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cost_project_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: cost_project_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cost_project_changes_id_seq OWNED BY public.cost_project_changes.id;

--
-- Name: cost_project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    accepted_version integer,
    display_book_id uuid
);

--
-- Name: cost_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_projects (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    family_id uuid,
    title text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    active_plan jsonb,
    proposed_plan jsonb,
    active_stale boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: cost_schedule_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_schedule_members (
    schedule_id uuid NOT NULL,
    user_id uuid NOT NULL,
    accepted boolean DEFAULT false NOT NULL,
    book_id uuid
);

--
-- Name: cost_schedule_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_schedule_occurrences (
    schedule_id uuid NOT NULL,
    due_date date NOT NULL,
    project_id uuid,
    skipped boolean DEFAULT false NOT NULL
);

--
-- Name: cost_schedule_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_schedule_settlements (
    schedule_id uuid NOT NULL,
    due_date date NOT NULL,
    movement_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    amount bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cost_schedule_settlements_amount_check CHECK ((amount > 0))
);

--
-- Name: cost_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_schedules (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    family_id uuid,
    rule jsonb NOT NULL,
    next_date date NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: cost_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_settlements (
    project_id uuid NOT NULL,
    movement_id uuid NOT NULL,
    amount bigint NOT NULL,
    CONSTRAINT cost_settlements_amount_check CHECK ((amount > 0))
);

--
-- Name: cost_source_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_source_claims (
    project_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    event_id uuid NOT NULL,
    kind text NOT NULL,
    amount bigint NOT NULL,
    source_amount bigint NOT NULL,
    account_id uuid NOT NULL,
    date date NOT NULL,
    CONSTRAINT cost_source_claims_amount_check CHECK ((amount > 0)),
    CONSTRAINT cost_source_claims_kind_check CHECK ((kind = ANY (ARRAY['expense'::text, 'income'::text])))
);

--
-- Name: deployment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_settings (
    id integer NOT NULL,
    currency text NOT NULL,
    CONSTRAINT deployment_settings_currency_check CHECK ((currency = ANY (ARRAY['CNY'::text, 'USD'::text, 'EUR'::text, 'GBP'::text]))),
    CONSTRAINT deployment_settings_id_check CHECK ((id = 1))
);

--
-- Name: discussion_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_messages (
    id uuid NOT NULL,
    seq bigint NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    reply_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discussion_messages_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 2000)))
);

--
-- Name: discussion_messages_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discussion_messages_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: discussion_messages_seq_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discussion_messages_seq_seq OWNED BY public.discussion_messages.seq;

--
-- Name: discussion_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_reads (
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_seq bigint DEFAULT 0 NOT NULL
);

--
-- Name: discussion_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discussion_threads (
    id uuid NOT NULL,
    kind text NOT NULL,
    target_id uuid NOT NULL,
    scope text DEFAULT ''::text NOT NULL,
    CONSTRAINT discussion_threads_check CHECK (((scope = ''::text) OR ((kind = 'schedule'::text) AND (scope ~ '^\d{4}-\d{2}-\d{2}$'::text)))),
    CONSTRAINT discussion_threads_kind_check CHECK ((kind = ANY (ARRAY['movement'::text, 'transaction'::text, 'project'::text, 'schedule'::text, 'claim'::text])))
);

--
-- Name: entry_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_drafts (
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    section text NOT NULL,
    value jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entry_drafts_section_check CHECK ((section = ANY (ARRAY['intake'::text, 'images'::text, 'manual'::text])))
);

--
-- Name: entry_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entry_templates (
    id uuid NOT NULL,
    book_id uuid,
    user_id uuid,
    name text NOT NULL,
    value jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: expense_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_allocations (
    transaction_id uuid NOT NULL,
    start_month date NOT NULL,
    months integer NOT NULL,
    period_unit text DEFAULT 'month'::text NOT NULL,
    period_count integer,
    start_date date,
    CONSTRAINT expense_allocations_months_check CHECK ((months >= 1)),
    CONSTRAINT expense_allocations_start_month_check CHECK ((EXTRACT(day FROM start_month) = (1)::numeric))
);

--
-- Name: expense_claim_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_claim_events (
    id bigint NOT NULL,
    claim_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    seen boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: expense_claim_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_claim_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: expense_claim_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_claim_events_id_seq OWNED BY public.expense_claim_events.id;

--
-- Name: expense_claim_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_claim_links (
    claim_id uuid NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    managed boolean NOT NULL,
    active boolean DEFAULT true NOT NULL
);

--
-- Name: expense_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_claims (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    source_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    target_id uuid,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_claims_check CHECK ((sender_id <> recipient_id)),
    CONSTRAINT expense_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])))
);

--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar text DEFAULT '🏡'::text NOT NULL
);

--
-- Name: family_book_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_book_preferences (
    user_id uuid NOT NULL,
    book_id uuid
);

--
-- Name: family_expense_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_expense_shares (
    transaction_id uuid NOT NULL,
    family_id uuid NOT NULL,
    shares jsonb NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: family_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_invitations (
    family_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: family_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_members (
    family_id uuid NOT NULL,
    user_id uuid NOT NULL
);

--
-- Name: family_movement_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_movement_books (
    movement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid NOT NULL
);

--
-- Name: family_movement_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_movement_details (
    movement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    transaction_time text DEFAULT ''::text NOT NULL,
    platform text DEFAULT ''::text NOT NULL,
    external_id text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: family_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_movements (
    id uuid NOT NULL,
    family_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid,
    source_id uuid NOT NULL,
    target_id uuid,
    kind text NOT NULL,
    amount bigint NOT NULL,
    date date NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    expense_id uuid,
    loan_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    confirmed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    external_id text,
    platform text,
    CONSTRAINT family_movements_amount_check CHECK ((amount > 0)),
    CONSTRAINT family_movements_check CHECK (((target_id IS NULL) OR (target_id <> source_id))),
    CONSTRAINT family_movements_kind_check CHECK ((kind = ANY (ARRAY['transfer'::text, 'gift'::text, 'aa'::text, 'loan'::text, 'repayment'::text, 'contribution'::text]))),
    CONSTRAINT family_movements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text])))
);

--
-- Name: finance_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_conversations (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: finance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_reports (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    artifacts jsonb NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: finance_turns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_turns (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    question text NOT NULL,
    answer text DEFAULT ''::text NOT NULL,
    artifacts jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: help_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_articles (
    id text NOT NULL,
    locale text NOT NULL,
    article jsonb NOT NULL,
    content text NOT NULL,
    version integer DEFAULT 1 NOT NULL
);

--
-- Name: help_vectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_vectors (
    article_id text NOT NULL,
    locale text NOT NULL,
    content_version integer NOT NULL,
    model_version integer NOT NULL,
    dimensions integer NOT NULL,
    embedding double precision[] NOT NULL
);

--
-- Name: installment_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installment_payments (
    id uuid NOT NULL,
    plan_id uuid NOT NULL,
    principal bigint NOT NULL,
    fee bigint NOT NULL,
    date date NOT NULL,
    principal_event uuid,
    fee_event uuid,
    voided boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT installment_payments_check CHECK (((principal + fee) > 0)),
    CONSTRAINT installment_payments_fee_check CHECK ((fee >= 0)),
    CONSTRAINT installment_payments_principal_check CHECK ((principal >= 0))
);

--
-- Name: installment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installment_plans (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    event_id uuid NOT NULL,
    name text NOT NULL,
    principal bigint NOT NULL,
    schedule jsonb NOT NULL,
    schedule_base bigint DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT installment_plans_principal_check CHECK ((principal > 0))
);

--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    username text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    book_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    CONSTRAINT members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
);

--
-- Name: memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memories (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    family_id uuid,
    kind text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    explicit boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memories_kind_check CHECK ((kind = ANY (ARRAY['product'::text, 'preference'::text, 'subscription'::text, 'activity'::text, 'conversation'::text, 'todo'::text, 'negative'::text]))),
    CONSTRAINT memories_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'disabled'::text, 'forgotten'::text])))
);

--
-- Name: memory_embedding_active; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_embedding_active (
    user_id uuid NOT NULL,
    version integer NOT NULL
);

--
-- Name: memory_embedding_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_embedding_versions (
    version integer NOT NULL,
    base_url text NOT NULL,
    model text NOT NULL,
    encrypted_key text NOT NULL,
    dimensions integer NOT NULL
);

--
-- Name: memory_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_events (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    memory_id uuid,
    operation text NOT NULL,
    previous jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: memory_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memory_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: memory_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memory_events_id_seq OWNED BY public.memory_events.id;

--
-- Name: memory_exclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_exclusions (
    user_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    item_id text DEFAULT ''::text NOT NULL
);

--
-- Name: memory_model_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_model_calls (
    id bigint NOT NULL,
    role text NOT NULL,
    model text NOT NULL,
    elapsed_ms integer NOT NULL,
    success boolean NOT NULL,
    tokens integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: memory_model_calls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memory_model_calls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: memory_model_calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memory_model_calls_id_seq OWNED BY public.memory_model_calls.id;

--
-- Name: memory_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_models (
    role text NOT NULL,
    base_url text NOT NULL,
    model text NOT NULL,
    encrypted_key text NOT NULL,
    dimensions integer DEFAULT 1024 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT memory_models_dimensions_check CHECK (((dimensions >= 1) AND (dimensions <= 4096))),
    CONSTRAINT memory_models_role_check CHECK ((role = ANY (ARRAY['embedding'::text, 'extraction'::text, 'judgment'::text])))
);

--
-- Name: memory_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_outbox (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: memory_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memory_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: memory_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memory_outbox_id_seq OWNED BY public.memory_outbox.id;

--
-- Name: memory_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_settings (
    user_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);

--
-- Name: memory_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_sources (
    memory_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    item_id text DEFAULT ''::text NOT NULL,
    source_version integer DEFAULT 0 NOT NULL,
    source_text text DEFAULT ''::text NOT NULL,
    CONSTRAINT memory_sources_source_type_check CHECK ((source_type = ANY (ARRAY['transaction'::text, 'turn'::text])))
);

--
-- Name: memory_vectors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_vectors (
    memory_id uuid NOT NULL,
    model_version integer NOT NULL,
    content_version integer NOT NULL,
    dimensions integer NOT NULL,
    embedding double precision[] NOT NULL
);

--
-- Name: profile_contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_contexts (
    user_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    place_id uuid,
    context jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- Name: profile_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_events (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    operation text NOT NULL,
    rule_id uuid,
    previous jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: profile_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profile_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: profile_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profile_events_id_seq OWNED BY public.profile_events.id;

--
-- Name: profile_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_places (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    latitude double precision,
    longitude double precision,
    radius integer DEFAULT 1500 NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_places_radius_check CHECK (((radius >= 1500) AND (radius <= 50000)))
);

--
-- Name: profile_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_rules (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    condition jsonb NOT NULL,
    field text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    state text NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_rules_state_check CHECK ((state = ANY (ARRAY['confirmed'::text, 'rejected'::text, 'disabled'::text])))
);

--
-- Name: profile_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_settings (
    user_id uuid NOT NULL,
    location_enabled boolean DEFAULT false NOT NULL,
    retain_location boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: receipt_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_files (
    id uuid NOT NULL,
    book_id uuid,
    user_id uuid NOT NULL,
    name text NOT NULL,
    mime text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    temporary boolean DEFAULT false NOT NULL,
    movement_id uuid,
    movement_purpose text
);

--
-- Name: schedule_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_occurrences (
    schedule_id uuid NOT NULL,
    due_date date NOT NULL,
    transaction_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id uuid,
    expires_at timestamp with time zone NOT NULL
);

--
-- Name: transaction_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_receipts (
    transaction_id uuid NOT NULL,
    file_id uuid NOT NULL,
    purpose text DEFAULT 'receipt'::text NOT NULL
);

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    account_id uuid NOT NULL,
    target_id uuid,
    kind text NOT NULL,
    amount bigint NOT NULL,
    date date NOT NULL,
    payee text DEFAULT ''::text NOT NULL,
    category text DEFAULT '其他'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    external_id text,
    created_by uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    platform text DEFAULT ''::text NOT NULL,
    order_id text DEFAULT ''::text NOT NULL,
    product text DEFAULT ''::text NOT NULL,
    occurred_at text DEFAULT ''::text NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    refund_of uuid,
    event_id uuid,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    verification_reason text DEFAULT ''::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    scene jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone,
    memory_suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
    preference_suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT transactions_amount_check CHECK ((amount > 0)),
    CONSTRAINT transactions_check CHECK ((((kind = 'transfer'::text) AND (target_id IS NOT NULL) AND (target_id <> account_id)) OR ((kind <> 'transfer'::text) AND (target_id IS NULL)))),
    CONSTRAINT transactions_kind_check CHECK ((kind = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text, 'refund'::text])))
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    username text NOT NULL,
    name text NOT NULL,
    password text NOT NULL,
    admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    avatar text DEFAULT '🧸'::text NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    theme text DEFAULT 'bear'::text NOT NULL
);

--
-- Name: ai_job_events seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_job_events ALTER COLUMN seq SET DEFAULT nextval('public.ai_job_events_seq_seq'::regclass);

--
-- Name: cost_project_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_changes ALTER COLUMN id SET DEFAULT nextval('public.cost_project_changes_id_seq'::regclass);

--
-- Name: discussion_messages seq; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages ALTER COLUMN seq SET DEFAULT nextval('public.discussion_messages_seq_seq'::regclass);

--
-- Name: expense_claim_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_events ALTER COLUMN id SET DEFAULT nextval('public.expense_claim_events_id_seq'::regclass);

--
-- Name: memory_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_events ALTER COLUMN id SET DEFAULT nextval('public.memory_events_id_seq'::regclass);

--
-- Name: memory_model_calls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_model_calls ALTER COLUMN id SET DEFAULT nextval('public.memory_model_calls_id_seq'::regclass);

--
-- Name: memory_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_outbox ALTER COLUMN id SET DEFAULT nextval('public.memory_outbox_id_seq'::regclass);

--
-- Name: profile_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_events ALTER COLUMN id SET DEFAULT nextval('public.profile_events_id_seq'::regclass);

--
-- Name: account_adjustments account_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_adjustments
    ADD CONSTRAINT account_adjustments_pkey PRIMARY KEY (id);

--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);

--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);

--
-- Name: activity_entries activity_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_entries
    ADD CONSTRAINT activity_entries_pkey PRIMARY KEY (transaction_id, owner_id);

--
-- Name: ai_job_events ai_job_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_job_events
    ADD CONSTRAINT ai_job_events_pkey PRIMARY KEY (seq);

--
-- Name: ai_job_steps ai_job_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_job_steps
    ADD CONSTRAINT ai_job_steps_pkey PRIMARY KEY (job_id, step);

--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_pkey PRIMARY KEY (id);

--
-- Name: ai_queue_settings ai_queue_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_queue_settings
    ADD CONSTRAINT ai_queue_settings_pkey PRIMARY KEY (id);

--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);

--
-- Name: assistant_ai_settings assistant_ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assistant_ai_settings
    ADD CONSTRAINT assistant_ai_settings_pkey PRIMARY KEY (id);

--
-- Name: bill_schedules bill_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_schedules
    ADD CONSTRAINT bill_schedules_pkey PRIMARY KEY (id);

--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);

--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (book_id, month, category);

--
-- Name: category_feedback category_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_feedback
    ADD CONSTRAINT category_feedback_pkey PRIMARY KEY (transaction_id);

--
-- Name: category_preferences category_preferences_by_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_preferences
    ADD CONSTRAINT category_preferences_by_user_pkey PRIMARY KEY (user_id, name);

--
-- Name: cost_member_income_claims cost_member_income_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_income_claims
    ADD CONSTRAINT cost_member_income_claims_pkey PRIMARY KEY (project_id, user_id, event_id);

--
-- Name: cost_member_offsets cost_member_offsets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_offsets
    ADD CONSTRAINT cost_member_offsets_pkey PRIMARY KEY (project_id, user_id);

--
-- Name: cost_project_changes cost_project_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_changes
    ADD CONSTRAINT cost_project_changes_pkey PRIMARY KEY (id);

--
-- Name: cost_project_members cost_project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_members
    ADD CONSTRAINT cost_project_members_pkey PRIMARY KEY (project_id, user_id);

--
-- Name: cost_projects cost_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_projects
    ADD CONSTRAINT cost_projects_pkey PRIMARY KEY (id);

--
-- Name: cost_schedule_members cost_schedule_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_members
    ADD CONSTRAINT cost_schedule_members_pkey PRIMARY KEY (schedule_id, user_id);

--
-- Name: cost_schedule_occurrences cost_schedule_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_occurrences
    ADD CONSTRAINT cost_schedule_occurrences_pkey PRIMARY KEY (schedule_id, due_date);

--
-- Name: cost_schedule_settlements cost_schedule_settlements_movement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_settlements
    ADD CONSTRAINT cost_schedule_settlements_movement_id_key UNIQUE (movement_id);

--
-- Name: cost_schedule_settlements cost_schedule_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_settlements
    ADD CONSTRAINT cost_schedule_settlements_pkey PRIMARY KEY (schedule_id, due_date, movement_id);

--
-- Name: cost_schedules cost_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedules
    ADD CONSTRAINT cost_schedules_pkey PRIMARY KEY (id);

--
-- Name: cost_settlements cost_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_settlements
    ADD CONSTRAINT cost_settlements_pkey PRIMARY KEY (project_id, movement_id);

--
-- Name: cost_source_claims cost_source_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_source_claims
    ADD CONSTRAINT cost_source_claims_pkey PRIMARY KEY (project_id, event_id);

--
-- Name: deployment_settings deployment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_settings
    ADD CONSTRAINT deployment_settings_pkey PRIMARY KEY (id);

--
-- Name: discussion_messages discussion_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_pkey PRIMARY KEY (id);

--
-- Name: discussion_messages discussion_messages_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_seq_key UNIQUE (seq);

--
-- Name: discussion_reads discussion_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reads
    ADD CONSTRAINT discussion_reads_pkey PRIMARY KEY (thread_id, user_id);

--
-- Name: discussion_threads discussion_threads_kind_target_id_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_threads
    ADD CONSTRAINT discussion_threads_kind_target_id_scope_key UNIQUE (kind, target_id, scope);

--
-- Name: discussion_threads discussion_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_threads
    ADD CONSTRAINT discussion_threads_pkey PRIMARY KEY (id);

--
-- Name: entry_drafts entry_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_drafts
    ADD CONSTRAINT entry_drafts_pkey PRIMARY KEY (book_id, user_id, section);

--
-- Name: entry_templates entry_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_templates
    ADD CONSTRAINT entry_templates_pkey PRIMARY KEY (id);

--
-- Name: expense_allocations expense_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_allocations
    ADD CONSTRAINT expense_allocations_pkey PRIMARY KEY (transaction_id);

--
-- Name: expense_claim_events expense_claim_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_events
    ADD CONSTRAINT expense_claim_events_pkey PRIMARY KEY (id);

--
-- Name: expense_claim_links expense_claim_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_links
    ADD CONSTRAINT expense_claim_links_pkey PRIMARY KEY (claim_id, target_id);

--
-- Name: expense_claims expense_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_pkey PRIMARY KEY (id);

--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);

--
-- Name: family_book_preferences family_book_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_book_preferences
    ADD CONSTRAINT family_book_preferences_pkey PRIMARY KEY (user_id);

--
-- Name: family_expense_shares family_expense_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_expense_shares
    ADD CONSTRAINT family_expense_shares_pkey PRIMARY KEY (transaction_id);

--
-- Name: family_invitations family_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_invitations
    ADD CONSTRAINT family_invitations_pkey PRIMARY KEY (family_id, user_id);

--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_pkey PRIMARY KEY (family_id, user_id);

--
-- Name: family_movement_books family_movement_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_books
    ADD CONSTRAINT family_movement_books_pkey PRIMARY KEY (movement_id, user_id);

--
-- Name: family_movement_details family_movement_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_details
    ADD CONSTRAINT family_movement_details_pkey PRIMARY KEY (movement_id, user_id);

--
-- Name: family_movements family_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_pkey PRIMARY KEY (id);

--
-- Name: finance_conversations finance_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_conversations
    ADD CONSTRAINT finance_conversations_pkey PRIMARY KEY (id);

--
-- Name: finance_reports finance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_reports
    ADD CONSTRAINT finance_reports_pkey PRIMARY KEY (id);

--
-- Name: finance_turns finance_turns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_turns
    ADD CONSTRAINT finance_turns_pkey PRIMARY KEY (id);

--
-- Name: help_articles help_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id, locale);

--
-- Name: help_vectors help_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_vectors
    ADD CONSTRAINT help_vectors_pkey PRIMARY KEY (article_id, locale, model_version);

--
-- Name: installment_payments installment_payments_fee_event_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_payments
    ADD CONSTRAINT installment_payments_fee_event_key UNIQUE (fee_event);

--
-- Name: installment_payments installment_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_payments
    ADD CONSTRAINT installment_payments_pkey PRIMARY KEY (id);

--
-- Name: installment_payments installment_payments_principal_event_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_payments
    ADD CONSTRAINT installment_payments_principal_event_key UNIQUE (principal_event);

--
-- Name: installment_plans installment_plans_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plans
    ADD CONSTRAINT installment_plans_event_id_key UNIQUE (event_id);

--
-- Name: installment_plans installment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plans
    ADD CONSTRAINT installment_plans_pkey PRIMARY KEY (id);

--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (username);

--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (book_id, user_id);

--
-- Name: memories memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_pkey PRIMARY KEY (id);

--
-- Name: memory_embedding_active memory_embedding_active_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_embedding_active
    ADD CONSTRAINT memory_embedding_active_pkey PRIMARY KEY (user_id);

--
-- Name: memory_embedding_versions memory_embedding_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_embedding_versions
    ADD CONSTRAINT memory_embedding_versions_pkey PRIMARY KEY (version);

--
-- Name: memory_events memory_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_events
    ADD CONSTRAINT memory_events_pkey PRIMARY KEY (id);

--
-- Name: memory_exclusions memory_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_exclusions
    ADD CONSTRAINT memory_exclusions_pkey PRIMARY KEY (user_id, source_type, source_id, item_id);

--
-- Name: memory_model_calls memory_model_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_model_calls
    ADD CONSTRAINT memory_model_calls_pkey PRIMARY KEY (id);

--
-- Name: memory_models memory_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_models
    ADD CONSTRAINT memory_models_pkey PRIMARY KEY (role);

--
-- Name: memory_outbox memory_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_outbox
    ADD CONSTRAINT memory_outbox_pkey PRIMARY KEY (id);

--
-- Name: memory_outbox memory_outbox_user_id_source_type_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_outbox
    ADD CONSTRAINT memory_outbox_user_id_source_type_source_id_key UNIQUE (user_id, source_type, source_id);

--
-- Name: memory_settings memory_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_settings
    ADD CONSTRAINT memory_settings_pkey PRIMARY KEY (user_id);

--
-- Name: memory_sources memory_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_sources
    ADD CONSTRAINT memory_sources_pkey PRIMARY KEY (memory_id, source_type, source_id, item_id);

--
-- Name: memory_vectors memory_vectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_vectors
    ADD CONSTRAINT memory_vectors_pkey PRIMARY KEY (memory_id, model_version);

--
-- Name: profile_contexts profile_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_contexts
    ADD CONSTRAINT profile_contexts_pkey PRIMARY KEY (user_id, transaction_id);

--
-- Name: profile_events profile_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_events
    ADD CONSTRAINT profile_events_pkey PRIMARY KEY (id);

--
-- Name: profile_places profile_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_places
    ADD CONSTRAINT profile_places_pkey PRIMARY KEY (id);

--
-- Name: profile_rules profile_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_rules
    ADD CONSTRAINT profile_rules_pkey PRIMARY KEY (id);

--
-- Name: profile_settings profile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_pkey PRIMARY KEY (user_id);

--
-- Name: receipt_files receipt_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_files
    ADD CONSTRAINT receipt_files_pkey PRIMARY KEY (id);

--
-- Name: schedule_occurrences schedule_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_occurrences
    ADD CONSTRAINT schedule_occurrences_pkey PRIMARY KEY (schedule_id, due_date);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: transaction_receipts transaction_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_receipts
    ADD CONSTRAINT transaction_receipts_pkey PRIMARY KEY (transaction_id, file_id);

--
-- Name: transactions transactions_book_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_book_id_external_id_key UNIQUE (book_id, external_id);

--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- Name: accounts_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_family_idx ON public.accounts USING btree (family_id);

--
-- Name: accounts_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_owner_idx ON public.accounts USING btree (owner_id);

--
-- Name: activities_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_family ON public.activities USING btree (family_id, archived, created_at DESC);

--
-- Name: activities_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_owner ON public.activities USING btree (owner_id, created_at DESC);

--
-- Name: activity_entries_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_entries_activity ON public.activity_entries USING btree (activity_id);

--
-- Name: ai_job_events_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_job_events_job ON public.ai_job_events USING btree (job_id, seq);

--
-- Name: ai_jobs_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_jobs_pending ON public.ai_jobs USING btree (status, created_at);

--
-- Name: ai_jobs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_jobs_user ON public.ai_jobs USING btree (user_id, created_at);

--
-- Name: books_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX books_family_idx ON public.books USING btree (family_id);

--
-- Name: category_feedback_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_feedback_user_idx ON public.category_feedback USING btree (user_id, confirmed_at DESC);

--
-- Name: cost_source_claims_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_source_claims_event ON public.cost_source_claims USING btree (event_id);

--
-- Name: discussion_messages_thread_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discussion_messages_thread_seq ON public.discussion_messages USING btree (thread_id, seq DESC);

--
-- Name: expense_claim_events_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_claim_events_unread ON public.expense_claim_events USING btree (user_id, id DESC) WHERE (NOT seen);

--
-- Name: expense_claims_active_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expense_claims_active_event ON public.expense_claims USING btree (event_id) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));

--
-- Name: family_movement_books_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_movement_books_book ON public.family_movement_books USING btree (book_id, user_id);

--
-- Name: family_movement_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX family_movement_reference ON public.family_movements USING btree (family_id, platform, external_id) WHERE ((external_id IS NOT NULL) AND (external_id <> ''::text) AND (status <> 'cancelled'::text));

--
-- Name: family_movements_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_movements_family ON public.family_movements USING btree (family_id, created_at DESC);

--
-- Name: family_movements_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_movements_source ON public.family_movements USING btree (source_id) WHERE (status = 'confirmed'::text);

--
-- Name: family_movements_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX family_movements_target ON public.family_movements USING btree (target_id) WHERE (status = 'confirmed'::text);

--
-- Name: installment_payments_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX installment_payments_plan ON public.installment_payments USING btree (plan_id);

--
-- Name: memories_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memories_owner ON public.memories USING btree (owner_id, status);

--
-- Name: profile_places_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_places_owner ON public.profile_places USING btree (user_id);

--
-- Name: profile_rules_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_rules_owner ON public.profile_rules USING btree (user_id);

--
-- Name: transactions_book_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_book_date ON public.transactions USING btree (book_id, date DESC);

--
-- Name: transactions_book_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX transactions_book_event ON public.transactions USING btree (book_id, event_id) WHERE (event_id IS NOT NULL);

--
-- Name: family_members expense_claim_departure; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expense_claim_departure AFTER DELETE ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.withdraw_departed_expense_claims();

--
-- Name: transactions expense_claim_facts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expense_claim_facts AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_expense_claim_facts();

--
-- Name: transactions installment_transaction_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER installment_transaction_guard BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.protect_installment_transactions();

--
-- Name: transactions memory_transaction_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memory_transaction_changed AFTER INSERT OR UPDATE OF category, product, payee, line_items, deleted, memory_suggestions, title, scene, version ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.memory_transaction_changed();

--
-- Name: finance_turns memory_turn_completed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memory_turn_completed AFTER UPDATE OF status ON public.finance_turns FOR EACH ROW EXECUTE FUNCTION public.memory_turn_completed();

--
-- Name: transactions transaction_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER transaction_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.stamp_transaction_update();

--
-- Name: account_adjustments account_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_adjustments
    ADD CONSTRAINT account_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: accounts accounts_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);

--
-- Name: accounts accounts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

--
-- Name: activities activities_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE SET NULL;

--
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: activity_entries activity_entries_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_entries
    ADD CONSTRAINT activity_entries_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;

--
-- Name: activity_entries activity_entries_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_entries
    ADD CONSTRAINT activity_entries_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: activity_entries activity_entries_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_entries
    ADD CONSTRAINT activity_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

--
-- Name: account_adjustments adjustments_asset_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_adjustments
    ADD CONSTRAINT adjustments_asset_account FOREIGN KEY (account_id) REFERENCES public.accounts(id);

--
-- Name: ai_job_events ai_job_events_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_job_events
    ADD CONSTRAINT ai_job_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id) ON DELETE CASCADE;

--
-- Name: ai_job_steps ai_job_steps_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_job_steps
    ADD CONSTRAINT ai_job_steps_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.ai_jobs(id) ON DELETE CASCADE;

--
-- Name: ai_jobs ai_jobs_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: ai_jobs ai_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: bill_schedules bill_schedules_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_schedules
    ADD CONSTRAINT bill_schedules_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: bill_schedules bill_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_schedules
    ADD CONSTRAINT bill_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: books books_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE SET NULL;

--
-- Name: books books_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

--
-- Name: budgets budgets_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);

--
-- Name: category_feedback category_feedback_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_feedback
    ADD CONSTRAINT category_feedback_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: category_feedback category_feedback_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_feedback
    ADD CONSTRAINT category_feedback_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

--
-- Name: category_feedback category_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_feedback
    ADD CONSTRAINT category_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: category_preferences category_preferences_by_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_preferences
    ADD CONSTRAINT category_preferences_by_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: cost_member_income_claims cost_member_income_claims_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_income_claims
    ADD CONSTRAINT cost_member_income_claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id);

--
-- Name: cost_member_income_claims cost_member_income_claims_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_income_claims
    ADD CONSTRAINT cost_member_income_claims_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

--
-- Name: cost_member_income_claims cost_member_income_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_income_claims
    ADD CONSTRAINT cost_member_income_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: cost_member_offsets cost_member_offsets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_offsets
    ADD CONSTRAINT cost_member_offsets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id);

--
-- Name: cost_member_offsets cost_member_offsets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_member_offsets
    ADD CONSTRAINT cost_member_offsets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: cost_project_changes cost_project_changes_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_changes
    ADD CONSTRAINT cost_project_changes_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);

--
-- Name: cost_project_changes cost_project_changes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_changes
    ADD CONSTRAINT cost_project_changes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id);

--
-- Name: cost_project_members cost_project_members_display_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_members
    ADD CONSTRAINT cost_project_members_display_book_id_fkey FOREIGN KEY (display_book_id) REFERENCES public.books(id);

--
-- Name: cost_project_members cost_project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_members
    ADD CONSTRAINT cost_project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id) ON DELETE CASCADE;

--
-- Name: cost_project_members cost_project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_project_members
    ADD CONSTRAINT cost_project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: cost_projects cost_projects_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_projects
    ADD CONSTRAINT cost_projects_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);

--
-- Name: cost_projects cost_projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_projects
    ADD CONSTRAINT cost_projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

--
-- Name: cost_schedule_members cost_schedule_members_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_members
    ADD CONSTRAINT cost_schedule_members_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE SET NULL;

--
-- Name: cost_schedule_members cost_schedule_members_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_members
    ADD CONSTRAINT cost_schedule_members_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.cost_schedules(id);

--
-- Name: cost_schedule_members cost_schedule_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_members
    ADD CONSTRAINT cost_schedule_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: cost_schedule_occurrences cost_schedule_occurrences_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_occurrences
    ADD CONSTRAINT cost_schedule_occurrences_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id);

--
-- Name: cost_schedule_occurrences cost_schedule_occurrences_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_occurrences
    ADD CONSTRAINT cost_schedule_occurrences_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.cost_schedules(id);

--
-- Name: cost_schedule_settlements cost_schedule_settlements_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_settlements
    ADD CONSTRAINT cost_schedule_settlements_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.family_movements(id);

--
-- Name: cost_schedule_settlements cost_schedule_settlements_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_settlements
    ADD CONSTRAINT cost_schedule_settlements_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);

--
-- Name: cost_schedule_settlements cost_schedule_settlements_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedule_settlements
    ADD CONSTRAINT cost_schedule_settlements_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.cost_schedules(id);

--
-- Name: cost_schedules cost_schedules_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedules
    ADD CONSTRAINT cost_schedules_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);

--
-- Name: cost_schedules cost_schedules_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_schedules
    ADD CONSTRAINT cost_schedules_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

--
-- Name: cost_settlements cost_settlements_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_settlements
    ADD CONSTRAINT cost_settlements_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.family_movements(id);

--
-- Name: cost_settlements cost_settlements_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_settlements
    ADD CONSTRAINT cost_settlements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id);

--
-- Name: cost_source_claims cost_source_claims_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_source_claims
    ADD CONSTRAINT cost_source_claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.cost_projects(id) ON DELETE CASCADE;

--
-- Name: cost_source_claims cost_source_claims_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_source_claims
    ADD CONSTRAINT cost_source_claims_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

--
-- Name: discussion_messages discussion_messages_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.discussion_messages(id);

--
-- Name: discussion_messages discussion_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.discussion_threads(id) ON DELETE CASCADE;

--
-- Name: discussion_messages discussion_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_messages
    ADD CONSTRAINT discussion_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: discussion_reads discussion_reads_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reads
    ADD CONSTRAINT discussion_reads_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.discussion_threads(id) ON DELETE CASCADE;

--
-- Name: discussion_reads discussion_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discussion_reads
    ADD CONSTRAINT discussion_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: entry_drafts entry_drafts_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_drafts
    ADD CONSTRAINT entry_drafts_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: entry_drafts entry_drafts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_drafts
    ADD CONSTRAINT entry_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: entry_templates entry_templates_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_templates
    ADD CONSTRAINT entry_templates_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: entry_templates entry_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entry_templates
    ADD CONSTRAINT entry_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: expense_allocations expense_allocations_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_allocations
    ADD CONSTRAINT expense_allocations_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

--
-- Name: expense_claim_events expense_claim_events_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_events
    ADD CONSTRAINT expense_claim_events_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id);

--
-- Name: expense_claim_events expense_claim_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_events
    ADD CONSTRAINT expense_claim_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: expense_claim_links expense_claim_links_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_links
    ADD CONSTRAINT expense_claim_links_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id);

--
-- Name: expense_claim_links expense_claim_links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_links
    ADD CONSTRAINT expense_claim_links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.transactions(id);

--
-- Name: expense_claim_links expense_claim_links_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claim_links
    ADD CONSTRAINT expense_claim_links_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.transactions(id);

--
-- Name: expense_claims expense_claims_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);

--
-- Name: expense_claims expense_claims_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);

--
-- Name: expense_claims expense_claims_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.transactions(id);

--
-- Name: expense_claims expense_claims_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_claims
    ADD CONSTRAINT expense_claims_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.transactions(id);

--
-- Name: families families_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

--
-- Name: family_book_preferences family_book_preferences_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_book_preferences
    ADD CONSTRAINT family_book_preferences_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: family_book_preferences family_book_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_book_preferences
    ADD CONSTRAINT family_book_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: family_expense_shares family_expense_shares_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_expense_shares
    ADD CONSTRAINT family_expense_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: family_expense_shares family_expense_shares_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_expense_shares
    ADD CONSTRAINT family_expense_shares_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);

--
-- Name: family_expense_shares family_expense_shares_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_expense_shares
    ADD CONSTRAINT family_expense_shares_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

--
-- Name: family_invitations family_invitations_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_invitations
    ADD CONSTRAINT family_invitations_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

--
-- Name: family_invitations family_invitations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_invitations
    ADD CONSTRAINT family_invitations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: family_members family_members_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

--
-- Name: family_members family_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: family_movement_books family_movement_books_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_books
    ADD CONSTRAINT family_movement_books_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: family_movement_books family_movement_books_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_books
    ADD CONSTRAINT family_movement_books_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.family_movements(id) ON DELETE CASCADE;

--
-- Name: family_movement_books family_movement_books_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_books
    ADD CONSTRAINT family_movement_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: family_movement_details family_movement_details_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_details
    ADD CONSTRAINT family_movement_details_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.family_movements(id) ON DELETE CASCADE;

--
-- Name: family_movement_details family_movement_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movement_details
    ADD CONSTRAINT family_movement_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: family_movements family_movements_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id);

--
-- Name: family_movements family_movements_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.transactions(id);

--
-- Name: family_movements family_movements_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);

--
-- Name: family_movements family_movements_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.family_movements(id);

--
-- Name: family_movements family_movements_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);

--
-- Name: family_movements family_movements_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);

--
-- Name: family_movements family_movements_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.accounts(id);

--
-- Name: family_movements family_movements_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_movements
    ADD CONSTRAINT family_movements_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.accounts(id);

--
-- Name: finance_conversations finance_conversations_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_conversations
    ADD CONSTRAINT finance_conversations_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: finance_conversations finance_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_conversations
    ADD CONSTRAINT finance_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: finance_reports finance_reports_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_reports
    ADD CONSTRAINT finance_reports_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: finance_reports finance_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_reports
    ADD CONSTRAINT finance_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: finance_turns finance_turns_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_turns
    ADD CONSTRAINT finance_turns_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.finance_conversations(id) ON DELETE CASCADE;

--
-- Name: help_vectors help_vectors_article_id_locale_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_vectors
    ADD CONSTRAINT help_vectors_article_id_locale_fkey FOREIGN KEY (article_id, locale) REFERENCES public.help_articles(id, locale) ON DELETE CASCADE;

--
-- Name: installment_payments installment_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_payments
    ADD CONSTRAINT installment_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: installment_payments installment_payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_payments
    ADD CONSTRAINT installment_payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.installment_plans(id);

--
-- Name: installment_plans installment_plans_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plans
    ADD CONSTRAINT installment_plans_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);

--
-- Name: installment_plans installment_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_plans
    ADD CONSTRAINT installment_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: members members_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memories memories_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;

--
-- Name: memories memories_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_embedding_active memory_embedding_active_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_embedding_active
    ADD CONSTRAINT memory_embedding_active_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_events memory_events_memory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_events
    ADD CONSTRAINT memory_events_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES public.memories(id) ON DELETE CASCADE;

--
-- Name: memory_events memory_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_events
    ADD CONSTRAINT memory_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_exclusions memory_exclusions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_exclusions
    ADD CONSTRAINT memory_exclusions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_outbox memory_outbox_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_outbox
    ADD CONSTRAINT memory_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_settings memory_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_settings
    ADD CONSTRAINT memory_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: memory_sources memory_sources_memory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_sources
    ADD CONSTRAINT memory_sources_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES public.memories(id) ON DELETE CASCADE;

--
-- Name: memory_vectors memory_vectors_memory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_vectors
    ADD CONSTRAINT memory_vectors_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES public.memories(id) ON DELETE CASCADE;

--
-- Name: profile_contexts profile_contexts_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_contexts
    ADD CONSTRAINT profile_contexts_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.profile_places(id) ON DELETE SET NULL;

--
-- Name: profile_contexts profile_contexts_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_contexts
    ADD CONSTRAINT profile_contexts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

--
-- Name: profile_contexts profile_contexts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_contexts
    ADD CONSTRAINT profile_contexts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: profile_events profile_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_events
    ADD CONSTRAINT profile_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: profile_places profile_places_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_places
    ADD CONSTRAINT profile_places_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: profile_rules profile_rules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_rules
    ADD CONSTRAINT profile_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: profile_settings profile_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: receipt_files receipt_files_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_files
    ADD CONSTRAINT receipt_files_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

--
-- Name: receipt_files receipt_files_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_files
    ADD CONSTRAINT receipt_files_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.family_movements(id) ON DELETE CASCADE;

--
-- Name: receipt_files receipt_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_files
    ADD CONSTRAINT receipt_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: schedule_occurrences schedule_occurrences_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_occurrences
    ADD CONSTRAINT schedule_occurrences_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.bill_schedules(id) ON DELETE CASCADE;

--
-- Name: schedule_occurrences schedule_occurrences_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_occurrences
    ADD CONSTRAINT schedule_occurrences_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: transaction_receipts transaction_receipts_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_receipts
    ADD CONSTRAINT transaction_receipts_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.receipt_files(id) ON DELETE CASCADE;

--
-- Name: transaction_receipts transaction_receipts_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_receipts
    ADD CONSTRAINT transaction_receipts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

--
-- Name: transactions transactions_asset_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_asset_account FOREIGN KEY (account_id) REFERENCES public.accounts(id);

--
-- Name: transactions transactions_asset_target; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_asset_target FOREIGN KEY (target_id) REFERENCES public.accounts(id);

--
-- Name: transactions transactions_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);

--
-- Name: transactions transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: transactions transactions_refund_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_refund_of_fkey FOREIGN KEY (refund_of) REFERENCES public.transactions(id);

--
--
