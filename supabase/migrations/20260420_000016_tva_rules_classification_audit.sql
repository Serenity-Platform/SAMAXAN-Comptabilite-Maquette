
-- ============================================================================
-- Paperasse Lot 0 - Migration M10
-- tva_rules (versionnées globales) + classification_rules + audit_logs
-- ============================================================================

-- TVA RULES (global versionné) ------------------------------------------------
CREATE TABLE compta.tva_rules (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  rule_code           text NOT NULL,
  rule_version        text NOT NULL DEFAULT '2026.1',
  effective_from      date NOT NULL,
  effective_to        date,
  dimensions          jsonb NOT NULL,
  -- {operation_type, seller_country, buyer_country, buyer_type, seller_vat_status, buyer_vat_status, goods_type, channel}
  result              jsonb NOT NULL,
  -- {vat_rate, collectible, deductible, autoliquidation, exoneration, required_mention, cgi_ref}
  priority            int NOT NULL DEFAULT 100,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_code, effective_from)
);

COMMENT ON TABLE compta.tva_rules IS 'Paperasse - Règles TVA versionnées globales. Résolution par compta.fn_resolve_tva_rule(context, as_of). Priority élevée = règle plus spécifique. Toute proposition trace rule_application dans accounting_proposals.rule_applications jsonb.';

CREATE INDEX idx_tva_rules_code_active ON compta.tva_rules (rule_code) WHERE status = 'active';
CREATE INDEX idx_tva_rules_effective ON compta.tva_rules (effective_from DESC, priority DESC) WHERE status = 'active';
CREATE INDEX idx_tva_rules_dimensions_gin ON compta.tva_rules USING GIN (dimensions jsonb_path_ops);

CREATE TRIGGER tg_tva_rules_touch_updated_at
  BEFORE UPDATE ON compta.tva_rules
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- CLASSIFICATION RULES (global ou tenant-custom v3) --------------------------
CREATE TABLE compta.classification_rules (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid REFERENCES compta.tenants(id) ON DELETE CASCADE,
  rule_code           text NOT NULL,
  rule_version        text NOT NULL DEFAULT '2026.1',
  effective_from      date NOT NULL,
  effective_to        date,
  trigger             jsonb NOT NULL,
  -- {event_type, external_source, marketplace?, amount_min?, amount_max?, description_pattern?, ...}
  output              jsonb NOT NULL,
  -- {proposed_lines:[{account_pcg, debit_expr, credit_expr, label_template}, ...], required_source_document, auto_post}
  priority            int NOT NULL DEFAULT 100,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.classification_rules IS 'Paperasse - Règles déterministes transformant source_event en proposed_lines. tenant_id NULL = règle globale. Expressions {amount_ttc}, {amount_ht}, {amount_tva} évaluées au runtime.';

CREATE UNIQUE INDEX idx_classification_rules_unique
  ON compta.classification_rules (COALESCE(tenant_id::text,'global'), rule_code, effective_from);
CREATE INDEX idx_classification_rules_active_priority
  ON compta.classification_rules (priority DESC)
  WHERE status = 'active';
CREATE INDEX idx_classification_rules_trigger_gin
  ON compta.classification_rules USING GIN (trigger jsonb_path_ops);

CREATE TRIGGER tg_classification_rules_touch_updated_at
  BEFORE UPDATE ON compta.classification_rules
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- AUDIT LOGS ------------------------------------------------------------------
CREATE TABLE compta.audit_logs (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid REFERENCES compta.legal_entities(id) ON DELETE SET NULL,
  entity_type         text NOT NULL,
  -- 'accounting_proposal','journal_entry','accounting_period','membership','tva_rule','source_event','source_document'
  entity_id           uuid NOT NULL,
  event_type          text NOT NULL,
  -- 'status_change','line_edited','period_locked','period_reopened','sequence_gap',
  -- 'rule_applied','ia_fallback','duplicate_webhook','trigger_error','replay_batch','upload_rejected'
  old_value           jsonb,
  new_value           jsonb,
  actor_id            uuid,
  actor_type          text DEFAULT 'user' CHECK (actor_type IN ('user','system','worker','trigger')),
  reason              text,
  metadata            jsonb DEFAULT '{}'::jsonb,
  correlation_id      uuid,
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.audit_logs IS 'Paperasse - Journal d''audit centralisé. Append-only. Indexé par entity + correlation pour drill-down. priority=low pour webhooks dupliqués, critical pour trigger_error/failed reconciliation.';

CREATE INDEX idx_audit_logs_entity ON compta.audit_logs (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_tenant_created ON compta.audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON compta.audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_logs_correlation ON compta.audit_logs (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_audit_logs_critical ON compta.audit_logs (created_at DESC) WHERE priority IN ('high','critical');
