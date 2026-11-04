-- Catalogue existant utilisé par l'USSD et le web. Aucun prix ni fournisseur n'est inventé.
BEGIN;
DO $check$
BEGIN
 IF to_regclass('tv_subscription_fees') IS NULL THEN
  RAISE EXCEPTION 'Catalogue tv_subscription_fees absent : vérifier le schéma fournisseur existant avant cette migration.';
 END IF;
END
$check$;
ALTER TABLE tv_subscription_fees ADD COLUMN IF NOT EXISTS base_price NUMERIC(28,8), ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3);
-- NULL conserve le repli du code vers metadata.price / price_usd et metadata.currency / USD.
COMMIT;
