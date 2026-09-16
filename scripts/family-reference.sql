ALTER TABLE family_movements ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE family_movements ADD COLUMN IF NOT EXISTS platform text;
CREATE UNIQUE INDEX IF NOT EXISTS family_movement_reference ON family_movements(family_id,platform,external_id) WHERE external_id IS NOT NULL AND external_id<>'' AND status<>'cancelled';
