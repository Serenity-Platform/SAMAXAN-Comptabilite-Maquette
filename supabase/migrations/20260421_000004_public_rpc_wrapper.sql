-- ============================================================================
-- Paperasse Lot 1.3 - Wrapper public.fn_onboarding_submit pour PostgREST
-- ============================================================================
-- PostgREST n'expose que le schema `public`. On cree un wrapper fin dans
-- public qui delegue a compta.fn_onboarding_submit.
-- SECURITY INVOKER pour propager les droits et auth.uid() du caller.

CREATE OR REPLACE FUNCTION public.fn_onboarding_submit(
  p_tenant_name          text,
  p_legal_entity_payload jsonb,
  p_fiscal_year_start    date DEFAULT NULL,
  p_fiscal_year_end      date DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = compta, public
AS $$
  SELECT compta.fn_onboarding_submit(
    p_tenant_name,
    p_legal_entity_payload,
    p_fiscal_year_start,
    p_fiscal_year_end
  );
$$;

COMMENT ON FUNCTION public.fn_onboarding_submit IS
  'Paperasse Lot 1.3 - Wrapper PostgREST vers compta.fn_onboarding_submit. SECURITY INVOKER, propage auth.uid() au callee.';

GRANT EXECUTE ON FUNCTION public.fn_onboarding_submit(text, jsonb, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_onboarding_submit(text, jsonb, date, date) FROM anon, public;
