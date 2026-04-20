
-- ============================================================================
-- Paperasse Lot 0 - Migration 5/11
-- source_events + source_documents (avec idempotence universelle - D004)
-- ============================================================================

-- SOURCE EVENTS ---------------------------------------------------------------
CREATE TABLE compta.source_events (
  id                      uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id               uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id         uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  event_type              text NOT NULL
                          CHECK (event_type IN (
                            'serenity_order','stripe_payment','revolut_merchant_order',
                            'revolut_business_tx','revolut_webhook','wallet_transaction',
                            'supplier_order','purchase_invoice_upload','sales_invoice_created',
                            'marketplace_commission','refund','manual_entry','other'
                          )),
  external_id             text NOT NULL,
  external_source         text NOT NULL
                          CHECK (external_source IN (
                            'stripe','revolut_merchant','revolut_business','serenity_orders',
                            'serenity_wallet','serenity_supplier','serenity_invoices',
                            'cdiscount','octopia','manual_upload','manual_entry'
                          )),
  occurred_at             timestamptz NOT NULL,
  raw_payload             jsonb NOT NULL,
  -- Idempotence universelle (décision D004) : clé générée déterministe
  idempotency_key         text GENERATED ALWAYS AS
                          (external_source || ':' || external_id || ':' || tenant_id::text) STORED,
  -- Traçabilité d'origine côté Serenity (pour les triggers du Lot 2)
  serenity_origin_table   text,
  serenity_origin_id      uuid,
  -- Statut de l'event dans le pipeline
  processing_status       text NOT NULL DEFAULT 'pending'
                          CHECK (processing_status IN ('pending','classified','failed','skipped')),
  processing_error        text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.source_events IS 'Paperasse - Événement brut non comptable. Matérialisé AVANT toute classification. Idempotence universelle via idempotency_key generated (D004). Origine = trigger Serenity, webhook externe, upload, ou saisie manuelle.';
COMMENT ON COLUMN compta.source_events.idempotency_key IS 'Colonne générée STORED, UNIQUE. Exemple: ''stripe:pi_xxx:550e8400-...''. Tout INSERT avec ON CONFLICT (idempotency_key) DO NOTHING assure l''idempotence.';

-- CLÉS UNIQUES D'IDEMPOTENCE
CREATE UNIQUE INDEX idx_source_events_idempotency ON compta.source_events (idempotency_key);
-- Lookup rapide par origine Serenity (pour triggers et reconciliation)
CREATE INDEX idx_source_events_serenity_origin
  ON compta.source_events (serenity_origin_table, serenity_origin_id)
  WHERE serenity_origin_id IS NOT NULL;
CREATE INDEX idx_source_events_tenant_occurred
  ON compta.source_events (tenant_id, external_source, occurred_at DESC);
CREATE INDEX idx_source_events_processing
  ON compta.source_events (processing_status, created_at)
  WHERE processing_status IN ('pending','failed');

-- SOURCE DOCUMENTS ------------------------------------------------------------
CREATE TABLE compta.source_documents (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  document_type       text NOT NULL
                      CHECK (document_type IN (
                        'purchase_invoice','sales_invoice','credit_note',
                        'bank_statement','receipt','contract','other'
                      )),
  issue_date          date NOT NULL,
  origin              text NOT NULL
                      CHECK (origin IN ('upload','external_api','internal_generation')),
  storage_path        text,
  content_hash        text,
  source_reference    text,
  file_name           text,
  file_size_bytes     bigint,
  mime_type           text,
  -- Liaison optionnelle avec un source_event (ex: upload facture → event 'purchase_invoice_upload')
  source_event_id     uuid REFERENCES compta.source_events(id) ON DELETE SET NULL,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Idempotence par hash contenu (pour uploads)
  CHECK (origin != 'upload' OR content_hash IS NOT NULL),
  CHECK (origin != 'upload' OR storage_path IS NOT NULL)
);

COMMENT ON TABLE compta.source_documents IS 'Paperasse - Pièce justificative matérialisée (facture, relevé, doc uploadé). Stockage dans bucket compta-documents. Idempotence upload via UNIQUE (tenant_id, content_hash).';

CREATE UNIQUE INDEX idx_source_documents_hash_tenant
  ON compta.source_documents (tenant_id, content_hash)
  WHERE content_hash IS NOT NULL;
CREATE INDEX idx_source_documents_legal_entity
  ON compta.source_documents (legal_entity_id, document_type, issue_date DESC);
CREATE INDEX idx_source_documents_source_event
  ON compta.source_documents (source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE TRIGGER tg_source_documents_touch_updated_at
  BEFORE UPDATE ON compta.source_documents
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();
