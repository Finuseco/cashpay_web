-- Adminer / PostgreSQL 12+ : exécuter séparément des nominations de comptes.
-- Détecte le véritable type ENUM de users.role ; aucun rôle existant n'est supprimé.
DO $migration$
DECLARE role_type oid; type_kind "char"; base_type oid; enum_name text; enum_schema text;
BEGIN
 SELECT a.atttypid INTO role_type FROM pg_attribute a
 WHERE a.attrelid='users'::regclass AND a.attname='role' AND NOT a.attisdropped;
 IF role_type IS NULL THEN RAISE EXCEPTION 'Colonne users.role introuvable'; END IF;
 LOOP
  SELECT t.typtype,t.typbasetype INTO type_kind,base_type FROM pg_type t WHERE t.oid=role_type;
  EXIT WHEN type_kind<>'d';
  role_type:=base_type;
 END LOOP;
 IF type_kind<>'e' THEN RAISE EXCEPTION 'users.role utilise un type non ENUM. Aucune conversion automatique effectuée.'; END IF;
 SELECT t.typname,n.nspname INTO enum_name,enum_schema FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.oid=role_type;
 EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',enum_schema,enum_name,'InterAgent');
 EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',enum_schema,enum_name,'InterAgentSupervisor');
END
$migration$;
-- Valider/terminer cette requête avant d'affecter l'une des nouvelles valeurs à un compte.
