-- ============================================================================
-- Paperasse Lot 1.3 - Vues public.* pour exposition PostgREST
-- ============================================================================
-- PostgREST du projet wtvnepynwrvvpugmdacd n'expose que le schema `public`
-- (partage avec Serenity). On cree des vues minces dans public pour que l'UI
-- Paperasse puisse lire les donnees compta via supabase-js sans hack.
--
-- SECURITY INVOKER : les vues s'executent avec les droits du caller, donc
-- les RLS policies de compta.* s'appliquent naturellement via fn_user_has_access.

CREATE OR REPLACE VIEW public.compta_tenants_v
WITH (security_invoker = true) AS
SELECT id, name, created_by, created_at, updated_at
FROM compta.tenants;

CREATE OR REPLACE VIEW public.compta_legal_entities_v
WITH (security_invoker = true) AS
SELECT
  id, tenant_id, name, legal_form, siren, siret, rcs, naf,
  capital_amount, capital_currency, address, president,
  regime_tva, regime_is,
  fiscal_year_start_day, fiscal_year_start_month,
  invoicing_config, payment_config, einvoicing_config, banks,
  serenity_user_id, created_at, updated_at
FROM compta.legal_entities;

CREATE OR REPLACE VIEW public.compta_fiscal_years_v
WITH (security_invoker = true) AS
SELECT id, tenant_id, legal_entity_id, start_date, end_date, status, created_at, updated_at
FROM compta.fiscal_years;

CREATE OR REPLACE VIEW public.compta_journals_v
WITH (security_invoker = true) AS
SELECT id, tenant_id, legal_entity_id, code, label, journal_type, created_at, updated_at
FROM compta.journals;

CREATE OR REPLACE VIEW public.compta_accounting_periods_v
WITH (security_invoker = true) AS
SELECT id, tenant_id, legal_entity_id, fiscal_year_id, year, month,
       start_date, end_date, status, locked_at, locked_by, created_at, updated_at
FROM compta.accounting_periods;

CREATE OR REPLACE VIEW public.compta_memberships_v
WITH (security_invoker = true) AS
SELECT id, tenant_id, user_id, role, scope_type, scope_value, scope_module,
       granted_by, granted_at, revoked_at
FROM compta.memberships;

GRANT SELECT ON public.compta_tenants_v             TO authenticated;
GRANT SELECT ON public.compta_legal_entities_v      TO authenticated;
GRANT SELECT ON public.compta_fiscal_years_v        TO authenticated;
GRANT SELECT ON public.compta_journals_v            TO authenticated;
GRANT SELECT ON public.compta_accounting_periods_v  TO authenticated;
GRANT SELECT ON public.compta_memberships_v         TO authenticated;

REVOKE ALL ON public.compta_tenants_v             FROM anon, public;
REVOKE ALL ON public.compta_legal_entities_v      FROM anon, public;
REVOKE ALL ON public.compta_fiscal_years_v        FROM anon, public;
REVOKE ALL ON public.compta_journals_v            FROM anon, public;
REVOKE ALL ON public.compta_accounting_periods_v  FROM anon, public;
REVOKE ALL ON public.compta_memberships_v         FROM anon, public;

COMMENT ON VIEW public.compta_memberships_v IS
  'Paperasse Lot 1.3 - Exposition PostgREST des memberships compta. SECURITY INVOKER, RLS de compta.memberships applique naturellement.';
