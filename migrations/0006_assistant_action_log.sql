CREATE TABLE assistant_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  risk text NOT NULL CHECK (risk IN ('read', 'write', 'confirm')),
  params jsonb NOT NULL,
  result jsonb,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'undone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undo jsonb
);
CREATE INDEX assistant_action_log_user_created ON assistant_action_log(user_id, created_at DESC, id DESC);
