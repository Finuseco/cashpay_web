-- Additive migration, to review and apply to a staging database first.
-- No production execution is performed by this task.
BEGIN;
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC(18,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10) DEFAULT 'USD';
CREATE TABLE IF NOT EXISTS meeting_participants (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(), left_at TIMESTAMPTZ,
  is_host BOOLEAN DEFAULT FALSE, UNIQUE(meeting_id, user_id)
);
ALTER TABLE meeting_participants
  ADD COLUMN IF NOT EXISTS fee_paid NUMERIC(18,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10),
  ADD COLUMN IF NOT EXISTS raise_hand BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_speak BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'viewer';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id);
-- Explicit native relationship; existing Zoom fields/data are not repurposed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS onchat_meeting_id INTEGER REFERENCES meetings(id);
CREATE UNIQUE INDEX IF NOT EXISTS events_onchat_meeting_idx ON events(onchat_meeting_id) WHERE onchat_meeting_id IS NOT NULL;
-- Free invitations have no financial transaction.
ALTER TABLE tickets ALTER COLUMN purchase_transaction_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_code_unique_idx ON tickets(ticket_code);
COMMIT;
