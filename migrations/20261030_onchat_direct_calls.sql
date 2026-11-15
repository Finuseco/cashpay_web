BEGIN;
ALTER TABLE call_logs
 ADD COLUMN IF NOT EXISTS meeting_code TEXT,
 ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS is_conference BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS allow_link_join BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS onchat_call_meeting_code_idx ON call_logs(meeting_code) WHERE meeting_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS onchat_call_invitees (
 call_id TEXT NOT NULL REFERENCES call_logs(id), user_id INTEGER NOT NULL REFERENCES users(id),
 invited_by INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(call_id,user_id)
);
COMMIT;
