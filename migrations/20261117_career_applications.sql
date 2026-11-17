-- Candidatures reçues par le site main (careers-api) : mémoire de tous les candidats + journal des e-mails.
-- Additif et rejouable. Application : psql "$DATABASE_URL" -f migrations/20261117_career_applications.sql
BEGIN;
CREATE TABLE IF NOT EXISTS career_applications (
    id               BIGSERIAL PRIMARY KEY,
    ref              VARCHAR(32)  NOT NULL UNIQUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    country          VARCHAR(2)   NOT NULL,
    province         VARCHAR(80)  NOT NULL,
    position         VARCHAR(40)  NOT NULL,
    position_label   VARCHAR(80),
    last_name        VARCHAR(80)  NOT NULL,
    first_name       VARCHAR(80)  NOT NULL,
    gender           CHAR(1)      NOT NULL CHECK (gender IN ('M','F')),
    age              SMALLINT     NOT NULL CHECK (age BETWEEN 16 AND 80),
    profession       VARCHAR(100) NOT NULL,
    phone            VARCHAR(30)  NOT NULL,
    email            VARCHAR(120) NOT NULL,
    city             VARCHAR(80),
    message          TEXT,
    lang             CHAR(2)      NOT NULL DEFAULT 'fr',
    files            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    storage_dir      TEXT,
    ip               VARCHAR(64),
    status           VARCHAR(20)  NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','reviewing','shortlisted','interview','accepted','rejected')),
    status_updated_at TIMESTAMPTZ,
    result_notified_at TIMESTAMPTZ,
    notes            TEXT
);
CREATE INDEX IF NOT EXISTS career_app_email_idx    ON career_applications (LOWER(email));
CREATE INDEX IF NOT EXISTS career_app_status_idx   ON career_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS career_app_position_idx ON career_applications (position, country, province);

-- Journal de chaque e-mail (réception interne, accusé au candidat, résultat) : permet de voir ce qui part et ce qui échoue.
CREATE TABLE IF NOT EXISTS career_email_log (
    id             BIGSERIAL PRIMARY KEY,
    application_id BIGINT REFERENCES career_applications(id) ON DELETE CASCADE,
    kind           VARCHAR(20) NOT NULL CHECK (kind IN ('internal','acknowledgement','result')),
    to_email       VARCHAR(255) NOT NULL,
    ok             BOOLEAN NOT NULL,
    error          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS career_mail_app_idx ON career_email_log (application_id, created_at DESC);
COMMIT;
