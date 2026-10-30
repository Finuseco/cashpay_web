-- Additive compatibility repair for existing production tables.
-- Review in Adminer and execute deliberately; the application never runs this migration.
BEGIN;
ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS host_user_id INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS host_id INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id),
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_amount NUMERIC(18,8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10) DEFAULT 'USD';
UPDATE meetings SET host_user_id = host_id WHERE host_user_id IS NULL AND host_id IS NOT NULL;
UPDATE meetings SET host_id = host_user_id WHERE host_id IS NULL AND host_user_id IS NOT NULL;
-- Preserve both legacy and current insert contracts, including legacy NOT NULL host_id.
CREATE OR REPLACE FUNCTION onchat_sync_meeting_host() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.host_user_id IS NULL THEN NEW.host_user_id := NEW.host_id; END IF;
    IF NEW.host_id IS NULL THEN NEW.host_id := NEW.host_user_id; END IF;
    IF NEW.host_id IS DISTINCT FROM NEW.host_user_id THEN
        RAISE EXCEPTION 'Meeting host identifiers must match';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS onchat_sync_meeting_host_trigger ON meetings;
CREATE TRIGGER onchat_sync_meeting_host_trigger BEFORE INSERT OR UPDATE OF host_id, host_user_id
    ON meetings FOR EACH ROW EXECUTE FUNCTION onchat_sync_meeting_host();
ALTER TABLE meeting_participants
    ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fee_paid NUMERIC(18,8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS raise_hand BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS can_speak BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'viewer';
UPDATE meeting_participants mp SET is_host = TRUE
    FROM meetings m WHERE mp.meeting_id = m.id AND mp.user_id = m.host_user_id AND mp.is_host IS DISTINCT FROM TRUE;
COMMIT;
