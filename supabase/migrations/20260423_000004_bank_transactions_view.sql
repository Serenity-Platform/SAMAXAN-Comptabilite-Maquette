-- Paperasse Lot 2.1 - Vue compta_bank_transactions_v
CREATE OR REPLACE VIEW public.compta_bank_transactions_v
WITH (security_invoker = true) AS
SELECT
  se.id, se.tenant_id, se.legal_entity_id, se.external_id, se.external_source,
  se.event_type, se.occurred_at, se.raw_payload, se.processing_status, se.processing_error,
  ap.id AS proposal_id, ap.status AS proposal_status,
  ap.confidence_level, ap.confidence_score, ap.proposed_lines,
  (ap.proposed_lines->0->>'account_code') AS pcg_debit,
  (ap.proposed_lines->1->>'account_code') AS pcg_credit,
  ap.rule_applications
FROM compta.source_events se
LEFT JOIN compta.accounting_proposals ap ON ap.source_event_id = se.id
WHERE se.external_source = 'revolut_business';

GRANT SELECT ON public.compta_bank_transactions_v TO authenticated;
REVOKE ALL ON public.compta_bank_transactions_v FROM anon, public;

NOTIFY pgrst, 'reload schema';
