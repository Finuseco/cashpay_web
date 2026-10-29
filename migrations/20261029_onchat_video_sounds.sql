-- Additive: attribution and explicit permission for reusable original sounds.
BEGIN;
CREATE TABLE IF NOT EXISTS onchat_video_sounds (
    media_id INTEGER PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(160) NOT NULL,
    allow_reuse BOOLEAN NOT NULL DEFAULT FALSE,
    source_media_id INTEGER REFERENCES onchat_video_sounds(media_id) ON DELETE SET NULL,
    rights_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (source_media_id IS NULL OR source_media_id <> media_id)
);
CREATE INDEX IF NOT EXISTS onchat_sound_source_idx ON onchat_video_sounds(source_media_id);
COMMIT;
