-- Paperasse Lot 2.1 - Table bank_integrations + index idempotence source_events
CREATE TABLE IF NOT EXISTS compta.bank_integrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id       uuid REFERENCES compta.legal_entities(id) ON DELETE SET NULL,
  provider              text NOT NULL,
  status                text NOT NULL DEFAULT 'pending',
  access_token_enc      text,
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  accounts              jsonb NOT NULL DEFAULT '[]'::jsonb,
  scopes                text[] DEFAULT ARRAY[]::text[],
  last_sync_at          timestamptz,
  last_sync_error       text,
  last_sync_tx_count    integer DEFAULT 0,
  connected_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at          timestamptz,
  disconnected_at       timestamptz,
  disconnected_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_integrations_provider_check
    CHECK (provider = ANY(ARRAY['revolut_business'::text])),
  CONSTRAINT bank_integrations_status_check
    CHECK (status = ANY(ARRAY['pending'::text, 'connected'::text, 'expired'::text, 'revoked'::text, 'error'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS bank_integrations_tenant_provider_active_idx
  ON compta.bank_integrations (tenant_id, provider)
  WHERE status = 'connected';

CREATE INDEX IF NOT EXISTS bank_integrations_tenant_idx
  ON compta.bank_integrations (tenant_id, created_at DESC);

ALTER TABLE compta.bank_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_integrations_service_all ON compta.bank_integrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY bank_integrations_select ON compta.bank_integrations FOR SELECT USING (
  compta.fn_user_has_access(auth.uid(), tenant_id, NULL::uuid, 'tenant_owner')
);

-- Verif index unique source_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='compta' AND tablename='source_events'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%external_id%'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS source_events_tenant_source_external_unique
      ON compta.source_events (tenant_id, external_source, external_id);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.compta_bank_integrations_v
WITH (security_invoker = true) AS
SELECT id, tenant_id, legal_entity_id, provider, status, accounts, scopes,
  last_sync_at, last_sync_error, last_sync_tx_count, connected_at, disconnected_at, created_at, updated_at
FROM compta.bank_integrations;

GRANT SELECT ON public.compta_bank_integrations_v TO authenticated;
REVOKE ALL ON public.compta_bank_integrations_v FROM anon, public;

NOTIFY pgrst, 'reload schema';
