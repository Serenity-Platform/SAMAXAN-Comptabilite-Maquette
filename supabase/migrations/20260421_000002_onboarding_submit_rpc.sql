-- ============================================================================
-- Paperasse Lot 1.3 - RPC onboarding submit sécurisée auth
-- ============================================================================
-- fn_onboarding_submit : wrapper sécurisé de fn_create_tenant_with_legal_entity
--   - Utilise auth.uid() (pas de user_id externe)
--   - Vérifie que l'utilisateur n'a pas déjà un tenant_owner (garde-fou v1)
--   - Validation du payload
--   - Retourne tenant_id + legal_entity_id + stats création

CREATE OR REPLACE FUNCTION compta.fn_onboarding_submit(
  p_tenant_name          text,
  p_legal_entity_payload jsonb,
  p_fiscal_year_start    date DEFAULT NULL,
  p_fiscal_year_end      date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
DECLARE
  v_user_id      uuid;
  v_existing     uuid;
  v_result       jsonb;
BEGIN
  -- 1) Vérifier auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2) Garde-fou v1 : 1 tenant par user (en v2 on autorisera multi-tenant par user)
  SELECT m.tenant_id INTO v_existing
  FROM compta.memberships m
  WHERE m.user_id = v_user_id
    AND m.role = 'tenant_owner'
    AND m.scope_type = 'tenant'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Cet utilisateur possède déjà un tenant (tenant_id=%). La création multiple sera disponible en v2.', v_existing
      USING ERRCODE = 'unique_violation';
  END IF;

  -- 3) Déléguer à fn_create_tenant_with_legal_entity
  v_result := compta.fn_create_tenant_with_legal_entity(
    p_user_id              := v_user_id,
    p_tenant_name          := p_tenant_name,
    p_legal_entity_payload := p_legal_entity_payload,
    p_fiscal_year_start    := p_fiscal_year_start,
    p_fiscal_year_end      := p_fiscal_year_end
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION compta.fn_onboarding_submit IS
  'Paperasse Lot 1.3 - Wrapper sécurisé onboarding. Utilise auth.uid() pour identifier le créateur, vérifie l''unicité tenant par user (v1), puis délègue à fn_create_tenant_with_legal_entity. Appelable par rôle authenticated uniquement.';

GRANT EXECUTE ON FUNCTION compta.fn_onboarding_submit(text, jsonb, date, date)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION compta.fn_onboarding_submit(text, jsonb, date, date)
  FROM anon, public;
