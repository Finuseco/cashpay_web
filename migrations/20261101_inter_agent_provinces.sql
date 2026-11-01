BEGIN;
ALTER TABLE inter_agent_memberships ADD COLUMN IF NOT EXISTS province TEXT;
UPDATE inter_agent_memberships m SET province=NULLIF(TRIM(u.province),'') FROM users u WHERE u.id=m.user_id AND m.kind='agent' AND m.province IS NULL;
-- Unassigned agents cannot view provincial claims until a national manager assigns a province.
COMMIT;
