
-- ============================================================================
-- Paperasse Lot 0 - Migration M11 part 2/3
-- Activation RLS + policies sur toutes les tables tenant-scoped
-- Pattern: service_role a tout accès (worker, Edge Functions), authenticated
-- passe par fn_user_has_access(auth.uid(), tenant_id, legal_entity_id, role)
-- ============================================================================

-- Tables globales (pas tenant-scoped) : pcg_accounts, liasse_cells_2033, tva_rules
-- Lecture ouverte à tous les authenticated (référentiel), écriture service_role only
ALTER TABLE compta.pcg_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcg_read_all ON compta.pcg_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY pcg_service_all ON compta.pcg_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.liasse_cells_2033 ENABLE ROW LEVEL SECURITY;
CREATE POLICY liasse_read_all ON compta.liasse_cells_2033 FOR SELECT TO authenticated USING (true);
CREATE POLICY liasse_service_all ON compta.liasse_cells_2033 FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.tva_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tva_read_all ON compta.tva_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY tva_service_all ON compta.tva_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- classification_rules : règles globales lisibles par tous, règles tenant-scoped gardées
ALTER TABLE compta.classification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY classification_read ON compta.classification_rules FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'viewer'));
CREATE POLICY classification_service_all ON compta.classification_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tenants : lecture limitée aux memberships, écriture service_role
ALTER TABLE compta.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_select ON compta.tenants FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), id, NULL, 'viewer'));
CREATE POLICY tenants_update ON compta.tenants FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), id, NULL, 'tenant_owner'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), id, NULL, 'tenant_owner'));
CREATE POLICY tenants_service_all ON compta.tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- legal_entities : scope tenant + legal_entity
ALTER TABLE compta.legal_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_entities_select ON compta.legal_entities FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, id, 'viewer'));
CREATE POLICY legal_entities_insert ON compta.legal_entities FOR INSERT TO authenticated
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'tenant_owner'));
CREATE POLICY legal_entities_update ON compta.legal_entities FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, id, 'tenant_owner'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, id, 'tenant_owner'));
CREATE POLICY legal_entities_service_all ON compta.legal_entities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- memberships : lecture propres + tenant_owner voit toutes les memberships du tenant
ALTER TABLE compta.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_select_own ON compta.memberships FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'tenant_owner'));
CREATE POLICY memberships_insert ON compta.memberships FOR INSERT TO authenticated
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'tenant_owner'));
CREATE POLICY memberships_update ON compta.memberships FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'tenant_owner'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, NULL, 'tenant_owner'));
CREATE POLICY memberships_service_all ON compta.memberships FOR ALL TO service_role USING (true) WITH CHECK (true);

-- fiscal_years, accounting_periods, tax_periods, journals : tenant + legal_entity scoped
ALTER TABLE compta.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY fy_select ON compta.fiscal_years FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY fy_write ON compta.fiscal_years FOR ALL TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY fy_service_all ON compta.fiscal_years FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_select ON compta.accounting_periods FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY ap_write ON compta.accounting_periods FOR ALL TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY ap_service_all ON compta.accounting_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.tax_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_select ON compta.tax_periods FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY tp_write ON compta.tax_periods FOR ALL TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY tp_service_all ON compta.tax_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY j_select ON compta.journals FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY j_write ON compta.journals FOR ALL TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY j_service_all ON compta.journals FOR ALL TO service_role USING (true) WITH CHECK (true);
