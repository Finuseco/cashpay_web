-- Additive meeting media/session and durable chat support. Execute deliberately in Adminer.
BEGIN;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS media_session_id TEXT,
 ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS onchat_meeting_messages (
 id BIGSERIAL PRIMARY KEY, meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), content TEXT NOT NULL CHECK(LENGTH(content) BETWEEN 1 AND 2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS onchat_meeting_messages_history ON onchat_meeting_messages(meeting_id,id DESC);
COMMIT;
