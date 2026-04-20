-- ============================================================================
-- Paperasse Lot 1.4 - RPC pour édition legal_entity (Paramètres > Société)
-- ============================================================================
-- compta.fn_update_legal_entity : patch partiel d'une legal_entity
--   - auth.uid() requis + check rôle tenant_owner via fn_user_has_access
--   - Whitelist stricte des champs modifiables (16 champs)
--   - UPDATE via COALESCE par champ (patch partiel)
--   - Audit log obligatoire avec old_value/new_value par champ
--
-- Wrapper public.fn_update_legal_entity pour exposition PostgREST.
-- Les deux sont dans la même migration pour cohérence de versioning.

CREATE OR REPLACE FUNCTION compta.fn_update_legal_entity(
  p_legal_entity_id uuid,
  p_patch           jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
DECLARE
  v_user_id        uuid;
  v_tenant_id      uuid;
  v_old_row        compta.legal_entities%ROWTYPE;
  v_new_row        compta.legal_entities%ROWTYPE;
  v_old_json       jsonb := '{}'::jsonb;
  v_new_json       jsonb := '{}'::jsonb;
  v_allowed_fields text[] := ARRAY[
    'name', 'legal_form', 'rcs', 'naf',
    'capital_amount', 'capital_currency',
    'address', 'president',
    'regime_tva', 'regime_is',
    'fiscal_year_start_day', 'fiscal_year_start_month',
    'invoicing_config', 'payment_config', 'einvoicing_config', 'banks'
  ];
  v_key            text;
  v_updated_keys   jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old_row FROM compta.legal_entities WHERE id = p_legal_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'legal_entity introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  v_tenant_id := v_old_row.tenant_id;

  IF NOT compta.fn_user_has_access(v_user_id, v_tenant_id, p_legal_entity_id, 'tenant_owner') THEN
    RAISE EXCEPTION 'Rôle tenant_owner requis' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY(v_allowed_fields)) THEN
      RAISE EXCEPTION 'Champ non modifiable: %', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  UPDATE compta.legal_entities
  SET
    name                    = COALESCE(p_patch->>'name', name),
    legal_form              = COALESCE(p_patch->>'legal_form', legal_form),
    rcs                     = COALESCE(p_patch->>'rcs', rcs),
    naf                     = COALESCE(p_patch->>'naf', naf),
    capital_amount          = COALESCE((p_patch->>'capital_amount')::numeric, capital_amount),
    capital_currency        = COALESCE(p_patch->>'capital_currency', capital_currency),
    address                 = COALESCE(p_patch->'address', address),
    president               = COALESCE(p_patch->'president', president),
    regime_tva              = COALESCE(p_patch->>'regime_tva', regime_tva),
    regime_is               = COALESCE(p_patch->>'regime_is', regime_is),
    fiscal_year_start_day   = COALESCE((p_patch->>'fiscal_year_start_day')::smallint, fiscal_year_start_day),
    fiscal_year_start_month = COALESCE((p_patch->>'fiscal_year_start_month')::smallint, fiscal_year_start_month),
    invoicing_config        = COALESCE(p_patch->'invoicing_config', invoicing_config),
    payment_config          = COALESCE(p_patch->'payment_config', payment_config),
    einvoicing_config       = COALESCE(p_patch->'einvoicing_config', einvoicing_config),
    banks                   = COALESCE(p_patch->'banks', banks),
    updated_at              = NOW()
  WHERE id = p_legal_entity_id
  RETURNING * INTO v_new_row;

  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    v_old_json := v_old_json || jsonb_build_object(v_key, to_jsonb(v_old_row) -> v_key);
    v_new_json := v_new_json || jsonb_build_object(v_key, to_jsonb(v_new_row) -> v_key);
  END LOOP;

  INSERT INTO compta.audit_logs (
    tenant_id, legal_entity_id, entity_type, entity_id,
    event_type, old_value, new_value, actor_id, actor_type, priority
  )
  VALUES (
    v_tenant_id, p_legal_entity_id, 'legal_entity', p_legal_entity_id,
    'update', v_old_json, v_new_json, v_user_id, 'user', 'normal'
  );

  SELECT jsonb_agg(k) INTO v_updated_keys FROM jsonb_object_keys(v_new_json) AS k;

  RETURN jsonb_build_object(
    'legal_entity_id', v_new_row.id,
    'updated_fields', v_updated_keys,
    'updated_at', v_new_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION compta.fn_update_legal_entity(uuid, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION compta.fn_update_legal_entity(uuid, jsonb) FROM anon, public;

-- ============================================================================
-- Wrapper public.fn_update_legal_entity pour PostgREST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_update_legal_entity(
  p_legal_entity_id uuid,
  p_patch           jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = compta, public
AS $$
  SELECT compta.fn_update_legal_entity(p_legal_entity_id, p_patch);
$$;

GRANT EXECUTE ON FUNCTION public.fn_update_legal_entity(uuid, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_update_legal_entity(uuid, jsonb) FROM anon, public;
