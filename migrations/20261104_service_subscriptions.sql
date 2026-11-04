-- Adminer : schéma utilisé par createSubscription et processTvSubscription.
-- Aucun abonnement, paiement ou solde fictif n'est créé ; aucun remboursement n'est exécuté.
BEGIN;
CREATE TABLE IF NOT EXISTS subscriptions (
 id BIGSERIAL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 service_name TEXT NOT NULL,
 amount NUMERIC(28,8) NOT NULL CHECK (amount>0),
 operator_name TEXT NOT NULL,
 smartcard_number TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','cancelled','expired','failed')),
 transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
 request_key TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Si une table du même nom existait avec un autre contrat, interrompre plutôt que fabriquer ses données.
DO $check$
DECLARE missing text;
BEGIN
 SELECT string_agg(required.name,', ') INTO missing FROM unnest(ARRAY['id','user_id','service_name','amount','operator_name','smartcard_number','status','transaction_id','created_at']) AS required(name)
 WHERE NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='subscriptions'::regclass AND a.attname=required.name AND NOT a.attisdropped);
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'subscriptions existe avec des colonnes manquantes : %',missing; END IF;
END
$check$;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_request_idx ON subscriptions(user_id,request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_user_created_idx ON subscriptions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_pending_idx ON subscriptions(created_at DESC) WHERE status='pending';
COMMIT;
