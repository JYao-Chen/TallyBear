CREATE TABLE IF NOT EXISTS cost_schedules (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), family_id uuid REFERENCES families(id),
 rule jsonb NOT NULL, next_date date NOT NULL, paused boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cost_schedule_members (
 schedule_id uuid NOT NULL REFERENCES cost_schedules(id), user_id uuid NOT NULL REFERENCES users(id),
 accepted boolean NOT NULL DEFAULT false, book_id uuid REFERENCES books(id) ON DELETE SET NULL,
 PRIMARY KEY(schedule_id,user_id)
);
CREATE TABLE IF NOT EXISTS cost_schedule_occurrences (
 schedule_id uuid NOT NULL REFERENCES cost_schedules(id), due_date date NOT NULL,
 project_id uuid REFERENCES cost_projects(id), skipped boolean NOT NULL DEFAULT false,
 PRIMARY KEY(schedule_id,due_date)
);
CREATE TABLE IF NOT EXISTS cost_schedule_settlements (
 schedule_id uuid NOT NULL REFERENCES cost_schedules(id), due_date date NOT NULL,
 movement_id uuid NOT NULL UNIQUE REFERENCES family_movements(id),
 recipient_id uuid NOT NULL REFERENCES users(id), amount bigint NOT NULL CHECK(amount>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(schedule_id,due_date,movement_id)
);
