-- Adminer : signaler les crédits du portefeuille, sans effectuer de débit dans un trigger.
BEGIN;
CREATE TABLE IF NOT EXISTS loan_repayment_queue (
 user_id INTEGER PRIMARY KEY REFERENCES users(id),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Conserver les droits des rôles qui écrivent déjà les portefeuilles.
DO $grants$
DECLARE writer TEXT;
BEGIN
 FOR writer IN SELECT tableowner FROM pg_tables WHERE schemaname=current_schema() AND tablename='wallets'
 UNION SELECT grantee FROM information_schema.role_table_grants WHERE table_schema=current_schema() AND table_name='wallets' AND privilege_type IN ('INSERT','UPDATE')
 UNION SELECT grantee FROM information_schema.column_privileges WHERE table_schema=current_schema() AND table_name='wallets' AND column_name='balances' AND privilege_type='UPDATE'
 LOOP
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON loan_repayment_queue TO %s',CASE WHEN writer='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(writer) END);
 END LOOP;
END
$grants$;
CREATE OR REPLACE FUNCTION cashpay_request_loan_repayment() RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE previous JSONB;
BEGIN
 previous := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE COALESCE(OLD.balances::jsonb,'{}'::jsonb) END;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(COALESCE(NEW.balances::jsonb,'{}'::jsonb)) e
  WHERE CASE WHEN e.value ~ '^[0-9]+([.][0-9]+)?$' THEN e.value::numeric ELSE 0 END
  > CASE WHEN previous->>e.key ~ '^[+-]?[0-9]+([.][0-9]+)?$' THEN (previous->>e.key)::numeric ELSE 0 END) THEN
  INSERT INTO loan_repayment_queue(user_id,requested_at) VALUES(NEW.user_id,clock_timestamp())
  ON CONFLICT(user_id) DO UPDATE SET requested_at=EXCLUDED.requested_at;
  PERFORM pg_notify('loan_repayment_requested',NEW.user_id::text);
 END IF;
 RETURN NEW;
END
$body$;
DROP TRIGGER IF EXISTS cashpay_loan_credit_requested ON wallets;
CREATE TRIGGER cashpay_loan_credit_requested AFTER INSERT OR UPDATE OF balances ON wallets
 FOR EACH ROW EXECUTE FUNCTION cashpay_request_loan_repayment();
COMMIT;
