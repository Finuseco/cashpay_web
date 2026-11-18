-- Main editorial and newsletter features. PostgreSQL; apply once before enabling routes.
-- The wallet/user schema and its SMTP settings are intentionally independent.
BEGIN;

CREATE TABLE IF NOT EXISTS main_articles (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(500) NOT NULL DEFAULT '',
  kind VARCHAR(24) NOT NULL CHECK (kind IN ('article','communique','advertisement')),
  cover_url VARCHAR(2048),
  cover_alt VARCHAR(250) NOT NULL DEFAULT '',
  body_html TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  publish_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  notify_subscribers BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(100) NOT NULL,
  updated_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (octet_length(body_html) <= 102400),
  CHECK (status = 'draft' OR publish_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS main_articles_public_idx ON main_articles (status, publish_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS main_articles_kind_idx ON main_articles (kind, publish_at DESC);

CREATE TABLE IF NOT EXISTS main_newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  language VARCHAR(2) NOT NULL DEFAULT 'fr',
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed')),
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  token_hash CHAR(64),
  token_expires_at TIMESTAMPTZ,
  unsubscribe_hash CHAR(64) UNIQUE,
  unsubscribe_nonce VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email = lower(email))
);
CREATE INDEX IF NOT EXISTS main_newsletter_active_idx ON main_newsletter_subscribers (status, id);
CREATE INDEX IF NOT EXISTS main_newsletter_confirmation_idx ON main_newsletter_subscribers (token_hash) WHERE token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS main_newsletter_campaigns (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL UNIQUE REFERENCES main_articles(id),
  subject VARCHAR(200) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  article_url VARCHAR(2048) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sending','sent','failed','cancelled')),
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  audience_expanded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS main_newsletter_campaign_due_idx ON main_newsletter_campaigns (status, due_at);

CREATE TABLE IF NOT EXISTS main_newsletter_deliveries (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES main_newsletter_campaigns(id),
  subscriber_id BIGINT NOT NULL REFERENCES main_newsletter_subscribers(id),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_token VARCHAR(100),
  lease_expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS main_newsletter_delivery_due_idx ON main_newsletter_deliveries (status, next_attempt_at, lease_expires_at);

-- Fragment merged by the main-site migration; no changes to wallet auth tables.
CREATE TABLE IF NOT EXISTS main_auth_challenges (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  otp_hash text NOT NULL CHECK (length(otp_hash) = 64),
  audience text NOT NULL DEFAULT 'main-admin' CHECK (audience = 'main-admin'),
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp')),
  expires_at timestamptz NOT NULL,
  otp_verified_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0 CHECK (otp_attempts BETWEEN 0 AND 5),
  pin_attempts integer NOT NULL DEFAULT 0 CHECK (pin_attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS main_auth_challenges_user_created_idx ON main_auth_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS main_auth_challenges_expiry_idx ON main_auth_challenges(expires_at);

CREATE TABLE IF NOT EXISTS main_auth_sessions (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  audience text NOT NULL DEFAULT 'main-admin' CHECK (audience = 'main-admin'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS main_auth_sessions_user_idx ON main_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS main_auth_sessions_expiry_idx ON main_auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS main_auth_rate_limits (
  key_hash text PRIMARY KEY CHECK (length(key_hash) = 64),
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
CREATE INDEX IF NOT EXISTS main_auth_rate_limits_window_idx ON main_auth_rate_limits(window_started_at);

-- Minimal Main submission metadata. Application documents and profiles are not stored here.
CREATE TABLE IF NOT EXISTS main_submission_contacts (
    id BIGSERIAL PRIMARY KEY,
    ref VARCHAR(100) NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('careers','project')),
    email VARCHAR(254) NOT NULL CHECK (email = lower(email)),
    status VARCHAR(16) NOT NULL DEFAULT 'received' CHECK (status IN ('received','reviewing','shortlisted','accepted','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS main_submission_contacts_status_idx ON main_submission_contacts (status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS main_submission_contacts_kind_idx ON main_submission_contacts (kind,created_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS main_submission_replies (
    id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL REFERENCES main_submission_contacts(id),
    subject VARCHAR(200) NOT NULL,
    body_html TEXT NOT NULL CHECK (octet_length(body_html) <= 102400),
    body_text TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','cancelled')),
    send_at TIMESTAMPTZ NOT NULL,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
    lease_token VARCHAR(100),
    lease_expires_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    last_error VARCHAR(64),
    created_by VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id,idempotency_key),
    CHECK (status <> 'sending' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS main_submission_replies_due_idx ON main_submission_replies (status,next_attempt_at,lease_expires_at);
CREATE INDEX IF NOT EXISTS main_submission_replies_contact_idx ON main_submission_replies (contact_id,created_at DESC,id DESC);

COMMIT;
