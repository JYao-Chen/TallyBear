-- Rows the legacy schema scripts seeded but a schema-only baseline cannot carry.
-- Existing databases already have them; ON CONFLICT keeps this a no-op there.
INSERT INTO ai_queue_settings(id, concurrency) VALUES (1, 2) ON CONFLICT (id) DO NOTHING;
