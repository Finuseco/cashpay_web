-- Atomic compatibility update. Any incompatible legacy data rolls back this entire migration.
BEGIN;
-- Existing application tables users, groups, group_members, messages and media are required.
-- Run manually in Adminer. No balances, historical messages or followers are deleted.
CREATE TABLE IF NOT EXISTS user_followers (
 follower_user_id INTEGER NOT NULL REFERENCES users(id),
 followed_user_id INTEGER NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(follower_user_id<>followed_user_id)
);
ALTER TABLE user_followers ADD COLUMN IF NOT EXISTS follower_user_id INTEGER REFERENCES users(id),
 ADD COLUMN IF NOT EXISTS followed_user_id INTEGER REFERENCES users(id),
 ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE user_followers ALTER COLUMN created_at SET DEFAULT NOW();
-- Missing legacy identities and duplicate relationships require explicit reconciliation.
ALTER TABLE user_followers ALTER COLUMN follower_user_id SET NOT NULL, ALTER COLUMN followed_user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS onchat_user_followers_identity ON user_followers(follower_user_id,followed_user_id);
CREATE INDEX IF NOT EXISTS onchat_user_followers_target ON user_followers(followed_user_id);
CREATE TABLE IF NOT EXISTS media_comments (
 id BIGSERIAL PRIMARY KEY, media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), content TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE media_comments ADD COLUMN IF NOT EXISTS media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
 ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id), ADD COLUMN IF NOT EXISTS content TEXT,
 ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE media_comments ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE media_comments ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE media_comments ALTER COLUMN id SET NOT NULL, ALTER COLUMN media_id SET NOT NULL, ALTER COLUMN user_id SET NOT NULL, ALTER COLUMN content SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS onchat_media_comments_identity ON media_comments(id);
CREATE INDEX IF NOT EXISTS onchat_media_comments_order ON media_comments(media_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS onchat_group_reads (
 group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(group_id,user_id)
);
CREATE OR REPLACE FUNCTION onchat_mark_read(p_conversation TEXT,p_reader INTEGER) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_group BIGINT;
BEGIN
 IF p_conversation LIKE 'g_%' AND p_conversation ~ '^g_[0-9]+$' THEN
  v_group:=SUBSTRING(p_conversation FROM 3)::BIGINT;
  IF NOT EXISTS(SELECT 1 FROM group_members WHERE group_id=v_group AND user_id=p_reader AND status='active') THEN
   RAISE EXCEPTION 'Conversation inaccessible' USING ERRCODE='42501';
  END IF;
  INSERT INTO onchat_group_reads(group_id,user_id,last_read_at) VALUES(v_group,p_reader,NOW())
   ON CONFLICT(group_id,user_id) DO UPDATE SET last_read_at=GREATEST(onchat_group_reads.last_read_at,EXCLUDED.last_read_at);
 ELSE
  IF NOT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id::text=p_conversation AND user_id=p_reader) THEN
   RAISE EXCEPTION 'Conversation inaccessible' USING ERRCODE='42501';
  END IF;
  UPDATE messages SET is_read=TRUE,status='read' WHERE conversation_id::text=p_conversation AND sender_id<>p_reader;
 END IF;
 PERFORM pg_notify('onchat_receipts',json_build_object('conversationId',p_conversation,'userId',p_reader)::text);
END;
$$;

CREATE OR REPLACE FUNCTION onchat_social_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE publisher INTEGER;
BEGIN
 IF TG_TABLE_NAME='media' THEN
  IF NEW.media_type<>'video' OR NEW.owner_type<>'user' OR NEW.visibility<>'public' OR (NEW.expires_at IS NOT NULL AND NEW.expires_at<=NOW()) THEN RETURN NEW; END IF;
  publisher:=NEW.owner_id;
  INSERT INTO notifications(user_id,title,description,type,link,is_read)
   SELECT f.follower_user_id,'Nouvelle vidéo OnChat',COALESCE(u.full_name,'Votre créateur suivi'),'general','/onchat/videos/'||NEW.id,FALSE
   FROM user_followers f JOIN users u ON u.id=publisher
   WHERE f.followed_user_id=publisher AND f.follower_user_id<>publisher;
  PERFORM pg_notify('onchat_social',json_build_object('event','video.published','publisherId',publisher,'mediaId',NEW.id)::text);
 ELSE
  SELECT owner_id INTO publisher FROM media WHERE id=NEW.media_id AND owner_type='user' AND visibility='public';
  IF publisher IS NOT NULL THEN
   PERFORM pg_notify('onchat_social',json_build_object('event','video.comment.created','publisherId',publisher,'mediaId',NEW.media_id)::text);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS onchat_video_published ON media;
CREATE TRIGGER onchat_video_published AFTER INSERT ON media FOR EACH ROW EXECUTE FUNCTION onchat_social_change();
DROP TRIGGER IF EXISTS onchat_comment_created ON media_comments;
CREATE TRIGGER onchat_comment_created AFTER INSERT ON media_comments FOR EACH ROW EXECUTE FUNCTION onchat_social_change();

CREATE TABLE IF NOT EXISTS media_likes (
 id BIGSERIAL PRIMARY KEY, media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE media_likes ADD COLUMN IF NOT EXISTS media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
 ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id), ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE media_likes ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE media_likes ALTER COLUMN media_id SET NOT NULL, ALTER COLUMN user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS onchat_media_likes_identity ON media_likes(media_id,user_id);
COMMIT;
