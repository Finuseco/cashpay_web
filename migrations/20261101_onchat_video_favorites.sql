-- Additive, manually reviewed Adminer migration. No publication or wallet is modified.
BEGIN;
CREATE TABLE IF NOT EXISTS onchat_video_favorites (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id,media_id)
);
CREATE INDEX IF NOT EXISTS onchat_video_favorites_media_idx ON onchat_video_favorites(media_id);
COMMIT;
