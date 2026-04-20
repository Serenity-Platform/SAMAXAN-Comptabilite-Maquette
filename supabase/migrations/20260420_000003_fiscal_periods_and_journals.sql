
-- ============================================================================
-- Paperasse Lot 0 - Migration 3/11
-- fiscal_years, accounting_periods, tax_periods, journals
-- ============================================================================

-- FISCAL YEARS ----------------------------------------------------------------
CREATE TABLE compta.fiscal_years (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  duration_days       int GENERATED ALWAYS AS ((end_date - start_date + 1)) STORED,
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','closing','closed')),
  closed_at           timestamptz,
  closed_by           uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE (legal_entity_id, start_date)
);

COMMENT ON TABLE compta.fiscal_years IS 'Paperasse - Exercice comptable d''une legal_entity. Durée calculée. Status open → closing → closed. Ré-ouverture nécessite platform_admin.';

CREATE INDEX idx_fiscal_years_legal_entity ON compta.fiscal_years (legal_entity_id, start_date DESC);
CREATE INDEX idx_fiscal_years_tenant_status ON compta.fiscal_years (tenant_id, status);

CREATE TRIGGER tg_fiscal_years_touch_updated_at
  BEFORE UPDATE ON compta.fiscal_years
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- ACCOUNTING PERIODS ----------------------------------------------------------
CREATE TABLE compta.accounting_periods (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  fiscal_year_id      uuid NOT NULL REFERENCES compta.fiscal_years(id) ON DELETE CASCADE,
  year                smallint NOT NULL,
  month               smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','locked','reopened')),
  locked_at           timestamptz,
  locked_by           uuid,
  reopened_at         timestamptz,
  reopened_by         uuid,
  reopen_reason       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE (legal_entity_id, year, month)
);

COMMENT ON TABLE compta.accounting_periods IS 'Paperasse - Période comptable mensuelle, granularité de verrouillage et des états. locked propagé aux journal_entries (statut persisté, décision D001). Réouverture requiert platform_admin, tracée dans audit_logs.';

CREATE INDEX idx_accounting_periods_legal_entity ON compta.accounting_periods (legal_entity_id, year DESC, month DESC);
CREATE INDEX idx_accounting_periods_fiscal_year ON compta.accounting_periods (fiscal_year_id, status);

CREATE TRIGGER tg_accounting_periods_touch_updated_at
  BEFORE UPDATE ON compta.accounting_periods
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- TAX PERIODS -----------------------------------------------------------------
CREATE TABLE compta.tax_periods (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  period_type         text NOT NULL CHECK (period_type IN ('monthly','quarterly','annual')),
  year                smallint NOT NULL,
  period_number       smallint NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','declared','paid','locked')),
  ca3_data            jsonb,
  declared_at         timestamptz,
  declared_by         uuid,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE (legal_entity_id, period_type, year, period_number)
);

COMMENT ON TABLE compta.tax_periods IS 'Paperasse - Période de déclaration fiscale (mensuelle, trimestrielle, annuelle). Distincte de accounting_period car granularité variable selon régime TVA. Stocke snapshot CA3 dans ca3_data jsonb.';

CREATE INDEX idx_tax_periods_legal_entity ON compta.tax_periods (legal_entity_id, year DESC, period_number DESC);

CREATE TRIGGER tg_tax_periods_touch_updated_at
  BEFORE UPDATE ON compta.tax_periods
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- JOURNALS --------------------------------------------------------------------
CREATE TABLE compta.journals (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  code                text NOT NULL,
  label               text NOT NULL,
  journal_type        text NOT NULL
                      CHECK (journal_type IN ('sales','purchases','bank','misc','payroll','opening','closing')),
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_entity_id, code)
);

COMMENT ON TABLE compta.journals IS 'Paperasse - Journal comptable (VT ventes, AC achats, BQ banque, OD opérations diverses, etc.). Un seed par legal_entity créé au Lot 1 via onboarding.';

CREATE INDEX idx_journals_legal_entity ON compta.journals (legal_entity_id, journal_type);

CREATE TRIGGER tg_journals_touch_updated_at
  BEFORE UPDATE ON compta.journals
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();
