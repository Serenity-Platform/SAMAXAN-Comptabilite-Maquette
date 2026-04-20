
-- ============================================================================
-- Paperasse Lot 1.1 - Helpers d'onboarding
-- Contient :
--   - fn_map_nature_juridique       : mapping code INSEE -> legal_form Paperasse
--   - fn_seed_default_journals      : crée VT/AC/BQ/OD
--   - fn_seed_accounting_periods    : crée 12 accounting_periods depuis fiscal_year
--   - fn_create_tenant_with_legal_entity : INSERT atomique tout-en-un
-- ============================================================================

-- 1) Mapping INSEE nature_juridique -> legal_form Paperasse -------------------
CREATE OR REPLACE FUNCTION compta.fn_map_nature_juridique(p_code text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_code
    WHEN '5710' THEN 'SAS'
    WHEN '5720' THEN 'SASU'
    WHEN '5498' THEN 'EURL'
    WHEN '5499' THEN 'SARL'
    WHEN '5410' THEN 'SARL'
    WHEN '5422' THEN 'SARL'
    WHEN '5308' THEN 'SA'
    WHEN '5307' THEN 'SA'
    WHEN '5306' THEN 'SA'
    WHEN '5488' THEN 'SASU'
    WHEN '6540' THEN 'SCI'
    WHEN '5202' THEN 'SNC'
    WHEN '6585' THEN 'SELARL'
    WHEN '6588' THEN 'SCP'
    ELSE 'AUTRE'
  END;
$$;

COMMENT ON FUNCTION compta.fn_map_nature_juridique IS
  'Paperasse - Mappe le code nature_juridique INSEE (4 chiffres) vers le legal_form du GLOSSAIRE CANONIQUE. Retourne AUTRE si code inconnu. Usage: SELECT compta.fn_map_nature_juridique(''5710'') = ''SAS''.';

-- 2) Seed journaux par défaut d'une legal_entity ------------------------------
CREATE OR REPLACE FUNCTION compta.fn_seed_default_journals(
  p_tenant_id uuid,
  p_legal_entity_id uuid
) RETURNS SETOF compta.journals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO compta.journals (tenant_id, legal_entity_id, code, label, journal_type)
  VALUES
    (p_tenant_id, p_legal_entity_id, 'VT', 'Journal des ventes',           'sales'),
    (p_tenant_id, p_legal_entity_id, 'AC', 'Journal des achats',           'purchases'),
    (p_tenant_id, p_legal_entity_id, 'BQ', 'Journal de banque',            'bank'),
    (p_tenant_id, p_legal_entity_id, 'OD', 'Journal des opérations diverses','misc')
  ON CONFLICT (legal_entity_id, code) DO NOTHING
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION compta.fn_seed_default_journals IS
  'Paperasse - Seed 4 journaux standards (VT/AC/BQ/OD) pour une nouvelle legal_entity. Idempotent via ON CONFLICT.';

-- 3) Seed accounting_periods pour un fiscal_year complet ----------------------
CREATE OR REPLACE FUNCTION compta.fn_seed_accounting_periods(
  p_tenant_id uuid,
  p_legal_entity_id uuid,
  p_fiscal_year_id uuid
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
DECLARE
  v_start date;
  v_end   date;
  v_cursor date;
  v_month_start date;
  v_month_end   date;
  v_count int := 0;
BEGIN
  SELECT start_date, end_date INTO v_start, v_end
  FROM compta.fiscal_years WHERE id = p_fiscal_year_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fiscal_year % introuvable', p_fiscal_year_id;
  END IF;

  v_cursor := v_start;
  WHILE v_cursor <= v_end LOOP
    v_month_start := date_trunc('month', v_cursor)::date;
    v_month_end   := (date_trunc('month', v_cursor) + interval '1 month - 1 day')::date;
    -- Clipper aux bornes du fiscal_year
    IF v_month_start < v_start THEN v_month_start := v_start; END IF;
    IF v_month_end   > v_end   THEN v_month_end   := v_end;   END IF;

    INSERT INTO compta.accounting_periods (
      tenant_id, legal_entity_id, fiscal_year_id,
      year, month, start_date, end_date, status
    ) VALUES (
      p_tenant_id, p_legal_entity_id, p_fiscal_year_id,
      EXTRACT(YEAR FROM v_month_start)::smallint,
      EXTRACT(MONTH FROM v_month_start)::smallint,
      v_month_start, v_month_end, 'open'
    )
    ON CONFLICT (legal_entity_id, year, month) DO NOTHING;

    v_count := v_count + 1;
    v_cursor := (date_trunc('month', v_cursor) + interval '1 month')::date;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compta.fn_seed_accounting_periods IS
  'Paperasse - Crée les accounting_periods mensuelles pour toute la durée du fiscal_year. Gère exercice non-calendaire (clipping aux bornes). Idempotent via ON CONFLICT.';

-- 4) Création atomique tenant + legal_entity + journaux + exercice + périodes + membership
CREATE OR REPLACE FUNCTION compta.fn_create_tenant_with_legal_entity(
  p_user_id              uuid,
  p_tenant_name          text,
  p_legal_entity_payload jsonb,
  p_fiscal_year_start    date DEFAULT NULL,  -- défaut : 01/01 année courante
  p_fiscal_year_end      date DEFAULT NULL   -- défaut : 31/12 même année
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
DECLARE
  v_tenant_id        uuid;
  v_legal_entity_id  uuid;
  v_fiscal_year_id   uuid;
  v_fiscal_start     date;
  v_fiscal_end       date;
  v_periods_count    int;
  v_journals_count   int;
BEGIN
  -- Pré-checks
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_id % introuvable dans auth.users', p_user_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF coalesce(trim(p_tenant_name),'') = '' THEN
    RAISE EXCEPTION 'p_tenant_name requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_legal_entity_payload IS NULL THEN
    RAISE EXCEPTION 'p_legal_entity_payload requis' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Validation champs obligatoires du payload
  IF (p_legal_entity_payload->>'siren') IS NULL OR
     (p_legal_entity_payload->>'siret') IS NULL OR
     (p_legal_entity_payload->>'legal_form') IS NULL OR
     (p_legal_entity_payload->>'regime_tva') IS NULL OR
     (p_legal_entity_payload->>'regime_is') IS NULL OR
     (p_legal_entity_payload->'address') IS NULL THEN
    RAISE EXCEPTION 'Champs obligatoires manquants dans p_legal_entity_payload: siren, siret, legal_form, regime_tva, regime_is, address'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Fiscal year défauts
  v_fiscal_start := COALESCE(p_fiscal_year_start, date_trunc('year', CURRENT_DATE)::date);
  v_fiscal_end   := COALESCE(p_fiscal_year_end,   (date_trunc('year', v_fiscal_start) + interval '1 year - 1 day')::date);

  IF v_fiscal_end <= v_fiscal_start THEN
    RAISE EXCEPTION 'fiscal_year invalide: start=% end=%', v_fiscal_start, v_fiscal_end
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 1) Tenant
  INSERT INTO compta.tenants (name, created_by)
  VALUES (p_tenant_name, p_user_id)
  RETURNING id INTO v_tenant_id;

  -- 2) Legal entity (on laisse les CHECK constraints du schéma valider)
  INSERT INTO compta.legal_entities (
    tenant_id, name, legal_form, siren, siret, rcs, naf,
    capital_amount, capital_currency, address, president,
    regime_tva, regime_is,
    fiscal_year_start_day, fiscal_year_start_month,
    invoicing_config, payment_config, einvoicing_config, banks,
    serenity_user_id
  ) VALUES (
    v_tenant_id,
    COALESCE(p_legal_entity_payload->>'name', p_tenant_name),
    p_legal_entity_payload->>'legal_form',
    p_legal_entity_payload->>'siren',
    p_legal_entity_payload->>'siret',
    p_legal_entity_payload->>'rcs',
    p_legal_entity_payload->>'naf',
    COALESCE((p_legal_entity_payload->>'capital_amount')::numeric, 0),
    COALESCE(p_legal_entity_payload->>'capital_currency', 'EUR'),
    p_legal_entity_payload->'address',
    p_legal_entity_payload->'president',
    p_legal_entity_payload->>'regime_tva',
    p_legal_entity_payload->>'regime_is',
    EXTRACT(DAY FROM v_fiscal_start)::smallint,
    EXTRACT(MONTH FROM v_fiscal_start)::smallint,
    COALESCE(
      p_legal_entity_payload->'invoicing_config',
      '{"prefix":"F","separator":"-","year_format":"YYYY","avoir_prefix":"AV","next_numbers":{}}'::jsonb
    ),
    COALESCE(
      p_legal_entity_payload->'payment_config',
      '{"default_terms":"net_30","late_penalty_rate":"3x_legal","recovery_fee":40,"escompte":"none"}'::jsonb
    ),
    COALESCE(
      p_legal_entity_payload->'einvoicing_config',
      '{"pa":null,"pa_name":null,"peppol_id":null,"reception_ready":false,"emission_ready":false,"ereporting_ready":false}'::jsonb
    ),
    COALESCE(p_legal_entity_payload->'banks', '[]'::jsonb),
    CASE
      WHEN (p_legal_entity_payload->>'serenity_user_id') IS NOT NULL
      THEN (p_legal_entity_payload->>'serenity_user_id')::uuid
      ELSE NULL
    END
  )
  RETURNING id INTO v_legal_entity_id;

  -- 3) Fiscal year courant
  INSERT INTO compta.fiscal_years (
    tenant_id, legal_entity_id, start_date, end_date, status
  ) VALUES (
    v_tenant_id, v_legal_entity_id, v_fiscal_start, v_fiscal_end, 'open'
  )
  RETURNING id INTO v_fiscal_year_id;

  -- 4) Journaux par défaut
  SELECT COUNT(*) INTO v_journals_count
  FROM compta.fn_seed_default_journals(v_tenant_id, v_legal_entity_id);

  -- 5) Accounting periods mensuelles
  v_periods_count := compta.fn_seed_accounting_periods(v_tenant_id, v_legal_entity_id, v_fiscal_year_id);

  -- 6) Membership tenant_owner pour le créateur
  INSERT INTO compta.memberships (
    tenant_id, user_id, role, scope_type, granted_by
  ) VALUES (
    v_tenant_id, p_user_id, 'tenant_owner', 'tenant', p_user_id
  );

  -- 7) Audit log
  INSERT INTO compta.audit_logs (
    tenant_id, legal_entity_id, entity_type, entity_id,
    event_type, new_value, actor_id, actor_type, priority
  ) VALUES (
    v_tenant_id, v_legal_entity_id, 'tenant', v_tenant_id,
    'tenant_created',
    jsonb_build_object(
      'tenant_name', p_tenant_name,
      'legal_entity_id', v_legal_entity_id,
      'fiscal_year_id', v_fiscal_year_id,
      'journals_count', v_journals_count,
      'periods_count', v_periods_count
    ),
    p_user_id, 'user', 'high'
  );

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'legal_entity_id', v_legal_entity_id,
    'fiscal_year_id', v_fiscal_year_id,
    'journals_count', v_journals_count,
    'periods_count', v_periods_count,
    'fiscal_year_start', v_fiscal_start,
    'fiscal_year_end', v_fiscal_end
  );
END;
$$;

COMMENT ON FUNCTION compta.fn_create_tenant_with_legal_entity IS
  'Paperasse - Création atomique d''un tenant avec sa première legal_entity, ses 4 journaux seed, son fiscal_year courant, ses 12 accounting_periods mensuelles, et la membership tenant_owner du créateur. Rollback complet en cas d''erreur. Trace dans audit_logs.';

-- Grants explicites
GRANT EXECUTE ON FUNCTION compta.fn_map_nature_juridique(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION compta.fn_seed_default_journals(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION compta.fn_seed_accounting_periods(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION compta.fn_create_tenant_with_legal_entity(uuid, text, jsonb, date, date) TO authenticated, service_role;
