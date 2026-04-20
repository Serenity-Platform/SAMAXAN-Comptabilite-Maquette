
-- ============================================================================
-- Paperasse Lot 0 - Migration M11 part 3/3
-- RLS sur source_events, source_documents, accounting_proposals,
-- journal_entries, journal_entry_lines, sequences, audit_logs
-- ============================================================================

ALTER TABLE compta.source_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY se_select ON compta.source_events FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
-- Pas d'INSERT/UPDATE authenticated : source_events sont créés par triggers Serenity ou service_role
CREATE POLICY se_service_all ON compta.source_events FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY sd_select ON compta.source_documents FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY sd_insert ON compta.source_documents FOR INSERT TO authenticated
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY sd_update ON compta.source_documents FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY sd_service_all ON compta.source_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.accounting_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_select ON compta.accounting_proposals FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY ap_update ON compta.accounting_proposals FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY ap_service_all ON compta.accounting_proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY je_select ON compta.journal_entries FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY je_insert ON compta.journal_entries FOR INSERT TO authenticated
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY je_update ON compta.journal_entries FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant')
         AND status NOT IN ('locked','reversed'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY je_service_all ON compta.journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY jel_select ON compta.journal_entry_lines FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
CREATE POLICY jel_insert ON compta.journal_entry_lines FOR INSERT TO authenticated
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY jel_update ON compta.journal_entry_lines FOR UPDATE TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'))
  WITH CHECK (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'accountant'));
CREATE POLICY jel_service_all ON compta.journal_entry_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY seq_select ON compta.sequences FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
-- Écriture via fn_next_sequence (SECURITY DEFINER), pas UPDATE direct
CREATE POLICY seq_service_all ON compta.sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE compta.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY al_select ON compta.audit_logs FOR SELECT TO authenticated
  USING (compta.fn_user_has_access((select auth.uid()), tenant_id, legal_entity_id, 'viewer'));
-- Audit logs append-only côté authenticated (pas d'INSERT direct, passer par fonctions)
CREATE POLICY al_service_all ON compta.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
