-- Additive schema for explicitly appointed agents. Does not alter users.role or move funds.
BEGIN;
CREATE TABLE IF NOT EXISTS inter_agent_memberships (
 user_id INTEGER PRIMARY KEY REFERENCES users(id),
 supervisor_user_id INTEGER REFERENCES users(id),
 agency_name TEXT NOT NULL, country TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('agent','supervisor')),
 providers TEXT[] NOT NULL DEFAULT ARRAY['western_union','moneygram','ria']::text[],
 fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3 CHECK (fee_percent >= 0 AND fee_percent <= 10),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 appointed_by INTEGER NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inter_claim_cases (
 claim_id INTEGER PRIMARY KEY REFERENCES international_transfer_claims(id),
 agent_user_id INTEGER NOT NULL REFERENCES users(id), supervisor_user_id INTEGER REFERENCES users(id),
 status TEXT NOT NULL CHECK (status IN ('reserved','paid','rejected','disputed')),
 currency VARCHAR(10) NOT NULL, gross_amount NUMERIC(20,2) NOT NULL CHECK (gross_amount > 0),
 net_amount NUMERIC(20,2) NOT NULL CHECK (net_amount > 0), fee_amount NUMERIC(20,2) NOT NULL CHECK (fee_amount >= 0),
 fee_percent NUMERIC(5,2) NOT NULL, exchange_rate NUMERIC(24,12) NOT NULL CHECK (exchange_rate > 0),
 hold_transaction_id INTEGER NOT NULL UNIQUE REFERENCES transactions(id),
 CHECK(gross_amount=net_amount+fee_amount),
 receipt_reference TEXT, rejection_reason TEXT, funds_collected BOOLEAN NOT NULL DEFAULT FALSE,
 disclosed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS inter_claim_audit (
 id BIGSERIAL PRIMARY KEY, claim_id INTEGER REFERENCES international_transfer_claims(id),
 actor_user_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 detail JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inter_claim_agent_status_idx ON inter_claim_cases(agent_user_id,status);
CREATE INDEX IF NOT EXISTS inter_claim_audit_claim_idx ON inter_claim_audit(claim_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inter_pin_attempts_idx ON inter_claim_audit(actor_user_id,created_at) WHERE action='PIN_REJECTED';
COMMIT;
