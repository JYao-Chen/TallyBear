UPDATE sessions SET id = encode(sha256(id::bytea), 'hex');

ALTER TABLE login_attempts ADD COLUMN scope text NOT NULL DEFAULT 'username';
ALTER TABLE login_attempts DROP CONSTRAINT login_attempts_pkey;
ALTER TABLE login_attempts ADD PRIMARY KEY (scope, username);

DELETE FROM ai_job_events e USING ai_jobs j
WHERE e.job_id = j.id AND j.status IN ('complete', 'error', 'cancelled');

CREATE FUNCTION finish_job_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM ai_job_events WHERE job_id = NEW.id;
  PERFORM pg_notify('ai_job_events', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER finish_job_events AFTER UPDATE OF status ON ai_jobs
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('complete', 'error', 'cancelled'))
EXECUTE FUNCTION finish_job_events();
