-- Existing custom definitions are reusable; newly saved copies keep personal preferences.
ALTER TABLE category_preferences ADD COLUMN IF NOT EXISTS family_shared boolean NOT NULL DEFAULT true;
