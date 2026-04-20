
-- ============================================================================
-- Paperasse Lot 0 - Migration 2/11
-- Tables tenants + legal_entities + memberships (RLS bootstrap)
-- ============================================================================

-- TENANTS ---------------------------------------------------------------------
CREATE TABLE compta.tenants (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name              text NOT NULL,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','archived')),
  settings          jsonb NOT NULL DEFAULT '{
                      "confidence_thresholds": {"low": 0.5, "high": 0.85},
                      "auto_post_amount_cap": 10000,
                      "auto_post_legal_entity_age_days_min": 90
                    }'::jsonb,
  created_by        uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.tenants IS 'Paperasse - Espace applicatif racine, unité d''isolation logique et d''abonnement (v3). V1: 1 tenant = 1 legal_entity (Samaxan). V2: multi-entity par tenant.';

CREATE INDEX idx_tenants_created_by ON compta.tenants (created_by);
CREATE INDEX idx_tenants_status ON compta.tenants (status) WHERE status = 'active';

-- LEGAL ENTITIES --------------------------------------------------------------
CREATE TABLE compta.legal_entities (
  id                        uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id                 uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  legal_form                text NOT NULL
                            CHECK (legal_form IN ('SAS','SASU','SARL','EURL','SA','SNC','SCI','SELARL','SCP','AUTRE')),
  siren                     text NOT NULL CHECK (siren ~ '^[0-9]{9}$'),
  siret                     text NOT NULL CHECK (siret ~ '^[0-9]{14}$'),
  rcs                       text,
  naf                       text,
  capital_amount            numeric(18,2) DEFAULT 0,
  capital_currency          text NOT NULL DEFAULT 'EUR',
  address                   jsonb NOT NULL,
  president                 jsonb,
  regime_tva                text NOT NULL
                            CHECK (regime_tva IN ('franchise','reel_simplifie','reel_normal','mini_reel')),
  regime_is                 text NOT NULL
                            CHECK (regime_is IN ('reel_simplifie','reel_normal','ir_transparent')),
  fiscal_year_start_day     smallint NOT NULL DEFAULT 1 CHECK (fiscal_year_start_day BETWEEN 1 AND 31),
  fiscal_year_start_month   smallint NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  invoicing_config          jsonb NOT NULL DEFAULT '{"prefix":"F","separator":"-","year_format":"YYYY","avoir_prefix":"AV","next_numbers":{}}'::jsonb,
  payment_config            jsonb NOT NULL DEFAULT '{"default_terms":"net_30","late_penalty_rate":"3x_legal","recovery_fee":40,"escompte":"none"}'::jsonb,
  einvoicing_config         jsonb NOT NULL DEFAULT '{"pa":null,"pa_name":null,"peppol_id":null,"reception_ready":false,"emission_ready":false,"ereporting_ready":false}'::jsonb,
  banks                     jsonb NOT NULL DEFAULT '[]'::jsonb,
  serenity_user_id          uuid,
  status                    text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','inactive','archived')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.legal_entities IS 'Paperasse - Société comptable réelle (SIREN, forme, régime fiscal, fiscal_year). Schéma inspiré de 07-company-example-structure.json. Samaxan en v1 (SAS), SYRION-Labs en v2.';
COMMENT ON COLUMN compta.legal_entities.siren IS '9 chiffres exactement';
COMMENT ON COLUMN compta.legal_entities.siret IS '14 chiffres exactement (siège social)';
COMMENT ON COLUMN compta.legal_entities.serenity_user_id IS 'FK logique vers public.users, NULL si pas de flux Serenity connecté. Utilisé par compta.fn_resolve_tenant_for_user pour mapper user_id Serenity → tenant/legal_entity Paperasse.';

CREATE UNIQUE INDEX idx_legal_entities_siren_tenant ON compta.legal_entities (siren, tenant_id) WHERE status != 'archived';
CREATE INDEX idx_legal_entities_tenant ON compta.legal_entities (tenant_id);
CREATE INDEX idx_legal_entities_serenity_user ON compta.legal_entities (serenity_user_id) WHERE serenity_user_id IS NOT NULL;

-- MEMBERSHIPS -----------------------------------------------------------------
CREATE TABLE compta.memberships (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL
                  CHECK (role IN ('platform_admin','tenant_owner','accountant','viewer')),
  scope_type      text NOT NULL
                  CHECK (scope_type IN ('tenant','legal_entity','module')),
  scope_value     uuid,
  scope_module    text,
  granted_by      uuid,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  CHECK (
    (scope_type = 'tenant' AND scope_value IS NULL AND scope_module IS NULL) OR
    (scope_type = 'legal_entity' AND scope_value IS NOT NULL AND scope_module IS NULL) OR
    (scope_type = 'module' AND scope_module IS NOT NULL)
  )
);

COMMENT ON TABLE compta.memberships IS 'Paperasse - Rôle d''un user auth sur un tenant, scoped par tenant entier, legal_entity précise, ou module (ex: tva_readonly). Modèle granulaire dès v1 pour ne pas forcer de refacto v2/v3.';

CREATE UNIQUE INDEX idx_memberships_unique
  ON compta.memberships (tenant_id, user_id, role, scope_type,
                         COALESCE(scope_value::text, scope_module, ''))
  WHERE revoked_at IS NULL;
CREATE INDEX idx_memberships_user ON compta.memberships (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_memberships_tenant_role ON compta.memberships (tenant_id, role) WHERE revoked_at IS NULL;

-- TRIGGER updated_at automatique (pattern Serenity)
CREATE OR REPLACE FUNCTION compta.fn_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_tenants_touch_updated_at
  BEFORE UPDATE ON compta.tenants
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

CREATE TRIGGER tg_legal_entities_touch_updated_at
  BEFORE UPDATE ON compta.legal_entities
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();
