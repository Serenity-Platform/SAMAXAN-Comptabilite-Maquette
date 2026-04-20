
-- ============================================================================
-- Paperasse Lot 0 - Migration 1/11
-- Création du schéma compta isolé
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS compta;

COMMENT ON SCHEMA compta IS
  'Paperasse - Module comptabilité française. Isolé de public pour ne pas polluer le schéma Serenity saturé (128 tables, 282 fonctions). Toutes les tables portent tenant_id + legal_entity_id avec RLS scopée via compta.fn_user_has_access.';

-- Les extensions requises sont déjà installées dans extensions (pg_cron en pg_catalog, pg_net/pgcrypto/uuid-ossp dans extensions)
-- Rien à installer ici, les migrations peuvent les utiliser directement via extensions.xxx()

-- Grants de base (service_role a tout, authenticated n'a rien par défaut, RLS gère les accès)
GRANT USAGE ON SCHEMA compta TO service_role, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA compta TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA compta GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA compta GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA compta GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA compta GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA compta GRANT EXECUTE ON FUNCTIONS TO service_role, authenticated;
