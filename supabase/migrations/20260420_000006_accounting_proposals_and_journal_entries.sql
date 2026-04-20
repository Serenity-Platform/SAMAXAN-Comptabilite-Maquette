
-- ============================================================================
-- Paperasse Lot 0 - Migration 6/11
-- accounting_proposals + journal_entries + journal_entry_lines
-- Cœur du socle comptable. Invariants partie double + immutabilité + locked persisté (D001)
-- rule_applications = jsonb embarqué (D002)
-- ============================================================================

-- ACCOUNTING PROPOSALS --------------------------------------------------------
CREATE TABLE compta.accounting_proposals (
  id                        uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id                 uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id           uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  fiscal_year_id            uuid REFERENCES compta.fiscal_years(id) ON DELETE RESTRICT,
  accounting_period_id      uuid REFERENCES compta.accounting_periods(id) ON DELETE RESTRICT,
  journal_id                uuid REFERENCES compta.journals(id) ON DELETE RESTRICT,
  -- Liens sources
  source_event_id           uuid NOT NULL REFERENCES compta.source_events(id) ON DELETE CASCADE,
  source_document_id        uuid REFERENCES compta.source_documents(id) ON DELETE SET NULL,
  -- Status workflow
  status                    text NOT NULL DEFAULT 'review_required'
                            CHECK (status IN ('draft','review_required','reviewed','rejected','ready_to_post')),
  -- Lignes proposées (format canonique)
  -- [{account_pcg: "411000", debit: 120.00, credit: 0, label: "..."}, ...]
  proposed_lines            jsonb NOT NULL,
  -- Confidence IA (D002 : rule_applications embarqué)
  confidence_score          numeric(3,2) CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  confidence_level          text CHECK (confidence_level IS NULL OR confidence_level IN ('low','medium','high')),
  rule_applications         jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Revue
  reviewer_id               uuid,
  reviewed_at               timestamptz,
  review_notes              text,
  rejection_reason          text,
  -- Post asynchrone (D003)
  ready_to_post_at          timestamptz,
  posted_journal_entry_id   uuid,
  post_attempts             smallint NOT NULL DEFAULT 0,
  post_last_error           text,
  -- Audit
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- Cohérence statut/review
  CHECK (
    (status IN ('reviewed','rejected') AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL) OR
    (status NOT IN ('reviewed','rejected'))
  ),
  CHECK (status != 'rejected' OR rejection_reason IS NOT NULL)
);

COMMENT ON TABLE compta.accounting_proposals IS 'Paperasse - Proposition d''écriture(s) comptable(s) générée(s) par le moteur de règles depuis un source_event (+/- source_document). D002: rule_applications jsonb embarqué. D003: statut ready_to_post traité par worker asynchrone.';
COMMENT ON COLUMN compta.accounting_proposals.proposed_lines IS 'Format JSONB canonique : array d''objets {account_pcg:text, debit:numeric(18,2), credit:numeric(18,2), label:text}. Validation applicative : sum(debit) = sum(credit).';
COMMENT ON COLUMN compta.accounting_proposals.rule_applications IS 'Historique règles appliquées : [{rule_id, rule_code, rule_version, context_snapshot, result, applied_at}]. D002 décision finale.';

CREATE INDEX idx_proposals_tenant_status
  ON compta.accounting_proposals (tenant_id, status, created_at DESC);
CREATE INDEX idx_proposals_legal_entity_status
  ON compta.accounting_proposals (legal_entity_id, status, created_at DESC);
CREATE INDEX idx_proposals_source_event
  ON compta.accounting_proposals (source_event_id);
CREATE INDEX idx_proposals_ready_to_post
  ON compta.accounting_proposals (ready_to_post_at)
  WHERE status = 'ready_to_post';
-- Support requêtes transverses sur règles appliquées (D002)
CREATE INDEX idx_proposals_rule_applications_gin
  ON compta.accounting_proposals USING GIN (rule_applications jsonb_path_ops);

CREATE TRIGGER tg_proposals_touch_updated_at
  BEFORE UPDATE ON compta.accounting_proposals
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- JOURNAL ENTRIES -------------------------------------------------------------
CREATE TABLE compta.journal_entries (
  id                          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id                   uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE RESTRICT,
  legal_entity_id             uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE RESTRICT,
  fiscal_year_id              uuid NOT NULL REFERENCES compta.fiscal_years(id) ON DELETE RESTRICT,
  accounting_period_id        uuid NOT NULL REFERENCES compta.accounting_periods(id) ON DELETE RESTRICT,
  journal_id                  uuid NOT NULL REFERENCES compta.journals(id) ON DELETE RESTRICT,
  accounting_proposal_id      uuid REFERENCES compta.accounting_proposals(id) ON DELETE SET NULL,
  source_event_id             uuid NOT NULL REFERENCES compta.source_events(id) ON DELETE RESTRICT,
  source_document_id          uuid REFERENCES compta.source_documents(id) ON DELETE SET NULL,
  entry_date                  date NOT NULL,
  piece_reference             text NOT NULL,
  description                 text,
  -- Statut (D001 persisté)
  status                      text NOT NULL DEFAULT 'posted'
                              CHECK (status IN ('posted','locked','reversed')),
  locked_at                   timestamptz,
  locked_by                   uuid,
  -- Contrepassation
  reverses_id                 uuid REFERENCES compta.journal_entries(id) ON DELETE SET NULL,
  reversed_by_id              uuid REFERENCES compta.journal_entries(id) ON DELETE SET NULL,
  -- rule_applications copiées/étendues depuis la proposition (D002)
  rule_applications           jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Auteur du post
  posted_by                   uuid NOT NULL,
  posted_at                   timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_entity_id, piece_reference)
);

COMMENT ON TABLE compta.journal_entries IS 'Paperasse - Écriture comptable réelle. Invariants: appartenance obligatoire (tenant + legal_entity + fiscal_year + period + journal + source_event), immutabilité une fois posted. D001: locked persisté. D002: rule_applications jsonb embarqué.';

CREATE INDEX idx_journal_entries_legal_entity_date
  ON compta.journal_entries (legal_entity_id, entry_date DESC);
CREATE INDEX idx_journal_entries_period_status
  ON compta.journal_entries (accounting_period_id, status);
CREATE INDEX idx_journal_entries_journal
  ON compta.journal_entries (journal_id, entry_date DESC);
CREATE INDEX idx_journal_entries_source_event
  ON compta.journal_entries (source_event_id);
CREATE INDEX idx_journal_entries_reverses
  ON compta.journal_entries (reverses_id) WHERE reverses_id IS NOT NULL;

-- JOURNAL ENTRY LINES ---------------------------------------------------------
CREATE TABLE compta.journal_entry_lines (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  journal_entry_id    uuid NOT NULL REFERENCES compta.journal_entries(id) ON DELETE CASCADE,
  -- Dénormalisation tenant/legal_entity pour RLS performante
  tenant_id           uuid NOT NULL,
  legal_entity_id     uuid NOT NULL,
  account_pcg         text NOT NULL REFERENCES compta.pcg_accounts(number) ON DELETE RESTRICT,
  account_label       text,
  debit               numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit              numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  label               text,
  analytical_code     text,
  position            smallint NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Invariant: une ligne est soit débit, soit crédit, pas les deux
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

COMMENT ON TABLE compta.journal_entry_lines IS 'Paperasse - Ligne d''écriture. CHECK strict debit XOR credit (jamais les deux, jamais aucun). Montants numeric(18,2) - jamais float. Dénormalisation tenant_id/legal_entity_id pour RLS performante.';

CREATE INDEX idx_entry_lines_entry ON compta.journal_entry_lines (journal_entry_id);
CREATE INDEX idx_entry_lines_account
  ON compta.journal_entry_lines (account_pcg, tenant_id, legal_entity_id);
CREATE INDEX idx_entry_lines_legal_entity_account
  ON compta.journal_entry_lines (legal_entity_id, account_pcg);
