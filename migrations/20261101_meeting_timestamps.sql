BEGIN;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
-- Historical dates are intentionally not guessed from creation time.
COMMIT;
