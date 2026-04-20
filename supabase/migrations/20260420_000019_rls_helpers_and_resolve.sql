
-- ============================================================================
-- Paperasse Lot 0 - Migration M11 part 1/3
-- Fonctions helper RLS : fn_user_has_access + fn_resolve_tenant_for_user (stub v1)
-- ============================================================================

CREATE OR REPLACE FUNCTION compta.fn_user_has_access(
  p_user_id uuid,
  p_tenant_id uuid,
  p_legal_entity_id uuid DEFAULT NULL,
  p_required_role text DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = compta, public
AS $$
  -- Short-circuit platform_admin (accès total sur tous tenants)
  SELECT EXISTS (
    SELECT 1 FROM compta.memberships m0
    WHERE m0.user_id = p_user_id
      AND m0.role = 'platform_admin'
      AND m0.revoked_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM compta.memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = p_tenant_id
      AND m.revoked_at IS NULL
      AND (
        -- Scope tenant : accès à toute legal_entity
        m.scope_type = 'tenant'
        -- Ou scope legal_entity spécifique
        OR (p_legal_entity_id IS NULL)
        OR (m.scope_type = 'legal_entity' AND m.scope_value = p_legal_entity_id)
      )
      AND (
        p_required_role IS NULL
        OR m.role = p_required_role
        -- Hiérarchie des rôles : tenant_owner peut tout, accountant peut lire+écrire, viewer peut lire
        OR (p_required_role = 'viewer' AND m.role IN ('tenant_owner','accountant','viewer'))
        OR (p_required_role = 'accountant' AND m.role IN ('tenant_owner','accountant'))
      )
  );
$$;

COMMENT ON FUNCTION compta.fn_user_has_access IS 'Paperasse - Helper RLS centralisé. STABLE SECURITY DEFINER pour lecture memberships. Hiérarchie rôles: platform_admin > tenant_owner > accountant > viewer.';

GRANT EXECUTE ON FUNCTION compta.fn_user_has_access TO authenticated, service_role;

-- Résolution user_id → (tenant_id, legal_entity_id) pour triggers Lot 2
-- Stub v1 : retourne la première membership active tenant_owner/accountant
CREATE OR REPLACE FUNCTION compta.fn_resolve_tenant_for_user(p_user_id uuid)
RETURNS TABLE (tenant_id uuid, legal_entity_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = compta, public
AS $$
  -- v1 stub : 1 user → 1 tenant tenant_owner → 1 legal_entity
  -- v3 : remplacé par mapping explicite (public.users → compta.legal_entities.serenity_user_id)
  SELECT le.tenant_id, le.id AS legal_entity_id
  FROM compta.legal_entities le
  WHERE le.serenity_user_id = p_user_id
    AND le.status = 'active'
  ORDER BY le.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION compta.fn_resolve_tenant_for_user IS 'Paperasse - Résolution user_id Serenity → (tenant_id, legal_entity_id) Paperasse. V1 : lookup sur compta.legal_entities.serenity_user_id. Retourne 0 row si user non mappé (trigger Lot 2 skip silencieux).';

GRANT EXECUTE ON FUNCTION compta.fn_resolve_tenant_for_user TO authenticated, service_role;
