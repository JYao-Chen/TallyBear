ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS thinking_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE assistant_ai_settings ADD COLUMN IF NOT EXISTS thinking_enabled boolean NOT NULL DEFAULT false;
