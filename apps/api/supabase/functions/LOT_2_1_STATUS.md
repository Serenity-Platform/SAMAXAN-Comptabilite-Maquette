# Lot 2.1 - Statut Edge Functions

## Deployees en prod (Supabase wtvnepynwrvvpugmdacd)

### compta-revolut-oauth-start (v2, verify_jwt=true)
Inchangee depuis Lot 2.1 v1 - genere authorize_url avec state HMAC-SHA256.

### compta-revolut-oauth-callback (v4, verify_jwt=false)
- v1 initial
- v2 initial
- v3 FIX iss JWT = domaine sans https:// (au lieu de clientId)
- **v4 FIX .schema('compta') -> RPC public.fn_compta_bank_integration_connect**
  car le schema compta n'est pas expose via PostgREST.

### compta-revolut-sync (v4, verify_jwt=true)
- v1-v3 comme callback
- **v4 FIX basculement complet sur RPCs public.fn_compta_* :**
  - fn_compta_get_connected_integration (lecture tokens chiffres)
  - fn_compta_get_legal_entity_for_tenant
  - fn_compta_refresh_token_update
  - fn_compta_get_revolut_rules
  - fn_compta_revolut_sync_one_tx (atomique source_event + proposal)
  - fn_compta_revolut_sync_finalize

## Migration associee
supabase/migrations/20260423_000005_bank_integration_rpc_connect.sql
