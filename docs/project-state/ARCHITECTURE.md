# ARCHITECTURE — Paperasse

**Version** : Lot 0 validé 2026-04-19 · **Mode** : RISQUE

## 1. Flux applicatif cible (Lot 2+)

```
[Serenity tables: orders, purchase_invoices, wallet_transactions,
 revolut_orders, stripe_payments, supplier_orders]
       │  AFTER INSERT/UPDATE triggers (D006)
       ▼
[compta.source_events]  ← idempotency_key UNIQUE STORED (D004)
       │
       │  compta-classifier (worker Edge Function, batch 50)
       ▼
[compta.classification_rules] + [compta.tva_rules]
       │  règles déterministes → proposed_lines
       │  fallback IA Claude Opus 4.7 si confiance < threshold
       ▼
[compta.accounting_proposals]  (status=review_required|ready_to_post)
       │
       │  UI Paperasse (Lot 3-4) : revue humaine OU
       │  worker auto-post (D003) si : règle déterministe + confidence=high + amount_ttc < cap tenant
       ▼
[compta.journal_entries + journal_entry_lines]  ← partie double stricte
       │  triggers :
       │   - fn_enforce_balanced_on_post (DEFERRABLE)
       │   - fn_enforce_immutability_entry
       │   - fn_enforce_immutability_line
       │   - fn_prevent_entry_in_locked_period
       │   - fn_propagate_period_lock (D001)
       ▼
[Grand livre, balance, journaux, FEC, liasse 2033, CA3]  (Lot 6-8)
```

## 2. Schéma `compta` — 15 tables

### Référentiels globaux (pas tenant-scoped)
| Table | PK | Contenu |
|---|---|---|
| `pcg_accounts` | `number` text | 838 comptes PCG 2026 (433 minimal + 405 facultatif + 7 racines) |
| `liasse_cells_2033` | `cell_id` text | 52 cases FL-HN, form `2033-B`, `pcg_roots`=NULL v1 |
| `tva_rules` | uuid | Règles TVA versionnées `effective_from/to` (10 seed v1) |

### Tenant-scoped
| Table | Scope | Note |
|---|---|---|
| `tenants` | racine | `settings` jsonb : confidence_thresholds, auto_post cap, age min legal_entity |
| `legal_entities` | tenant_id | SAS/SASU/SARL/... + SIREN/SIRET/régime + `serenity_user_id` nullable pour lookup D006 |
| `memberships` | tenant + scope | Rôles: `platform_admin`, `tenant_owner`, `accountant`, `viewer`. Scope: tenant / legal_entity / module |
| `fiscal_years` | tenant + legal_entity | `duration_days` GENERATED STORED |
| `accounting_periods` | tenant + legal_entity + fiscal_year | Granularité mensuelle. Status `open`/`locked`/`reopened`. **D001: locked PERSISTÉ** |
| `tax_periods` | tenant + legal_entity | Mensuel/trimestriel/annuel selon régime. `ca3_data` jsonb snapshot |
| `journals` | tenant + legal_entity | Types: sales/purchases/bank/misc/payroll/opening/closing |
| `source_events` | tenant + legal_entity | `idempotency_key` generated UNIQUE (D004). Origine serenity trigger, webhook, upload, manuel |
| `source_documents` | tenant + legal_entity | Storage path convention `{tenant_id}/{legal_entity_id}/...`. `content_hash` UNIQUE pour uploads |
| `accounting_proposals` | tenant + legal_entity | `proposed_lines` jsonb + `rule_applications` jsonb embarqué (D002) |
| `journal_entries` | tenant + legal_entity | Status `posted`/`locked`/`reversed` (D014: jamais draft, naissent posted). **UNIQUE (legal_entity_id, piece_reference)** |
| `journal_entry_lines` | tenant + legal_entity (dénormalisé) | `numeric(18,2)` débit XOR crédit |
| `sequences` | tenant + legal_entity | `fn_next_sequence` atomique via `ON CONFLICT UPDATE RETURNING` |
| `classification_rules` | NULL=global ou tenant-scoped v3 | 12 règles seed v1 |
| `audit_logs` | tenant + legal_entity | Append-only. Priority low/normal/high/critical |

## 3. Invariants DB (triggers M7)

1. **Équilibre D=C > 0** : `fn_enforce_balanced_on_post` CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED — vérifié au COMMIT pour permettre INSERT entry+lignes dans même transaction
2. **Immutabilité entries** : `fn_enforce_immutability_entry` BEFORE UPDATE/DELETE — transitions autorisées : `posted→{locked,reversed}`, `locked→posted` (platform_admin), `reversed` terminal
3. **Immutabilité lignes** : `fn_enforce_immutability_line` BEFORE UPDATE/DELETE sur lignes d'entries posted/locked/reversed
4. **Prevent entry in locked period** : `fn_prevent_entry_in_locked_period` BEFORE INSERT
5. **Propagation locked D001** : `fn_propagate_period_lock` AFTER UPDATE OF status sur `accounting_periods` → UPDATE entries correspondantes

**Test Lot 0** : 8/8 invariants adverses passés. Traces d'erreurs captées en session.

## 4. Décisions tranchées (DECISIONS.md pour détails)

- **D001** : `locked` PERSISTÉ sur `journal_entries` (pas dérivé) + `locked_at` + `locked_by`
- **D002** : `rule_applications` jsonb **EMBARQUÉ** dans `accounting_proposals` + `journal_entries` (pas table dédiée)
- **D003** : Post automatique **ASYNCHRONE** via Edge Function `compta-post-worker` cron 30s, batch 50 avec `FOR UPDATE SKIP LOCKED`
- **D004** : Idempotence universelle via colonne `idempotency_key = external_source || ':' || external_id || ':' || tenant_id::text` UNIQUE STORED
- **D005** : Schéma `compta` dans **projet Supabase unique** `wtvnepynwrvvpugmdacd`
- **D006** : Triggers SQL AFTER INSERT/UPDATE sur tables Serenity appellent `compta.fn_ingest_*_event` (à créer Lot 2)
- **D007** : Repo **restructuration complète** `SAMAXAN-Comptabilite-Maquette` (pas nouveau repo)
- **D013** : `public.compta_companies` orpheline préservée Lot 0, drop Lot 1 post-migration
- **D014** : `journal_entries.status CHECK IN ('posted','locked','reversed')` — drafts vivent dans `accounting_proposals`, entries naissent posted + lignes en même transaction

## 5. Contrats d'interface Lot 2

### Trigger Serenity → source_event (fonction SQL à créer Lot 2)

```sql
CREATE FUNCTION compta.fn_ingest_order_event() RETURNS trigger AS $$
DECLARE
  v_mapping record;
BEGIN
  SELECT * INTO v_mapping FROM compta.fn_resolve_tenant_for_user(NEW.user_id);
  IF v_mapping IS NULL THEN RETURN NEW; END IF;  -- Skip silencieux si user non mappé
  INSERT INTO compta.source_events (
    tenant_id, legal_entity_id, event_type, external_id, external_source,
    occurred_at, raw_payload, serenity_origin_table, serenity_origin_id
  ) VALUES (
    v_mapping.tenant_id, v_mapping.legal_entity_id,
    'serenity_order', NEW.id::text, 'serenity_orders',
    NEW.created_at, to_jsonb(NEW),
    'orders', NEW.id
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public;
```

### Classification worker (Edge Function Lot 2)

Pseudocode :
```
LOOP every 30s:
  WITH events AS (
    SELECT * FROM compta.source_events
    WHERE processing_status = 'pending'
    ORDER BY occurred_at ASC LIMIT 50
    FOR UPDATE SKIP LOCKED
  )
  FOR each event:
    rule := find_best_classification_rule(event)
    IF rule:
      tva_rule := resolve_tva_rule(rule.tva_rule_code, event.context, event.occurred_at)
      proposed_lines := apply_rule(rule, event, tva_rule)
      INSERT accounting_proposals + rule_applications
      IF rule.auto_post AND confidence_high AND amount < cap:
        INSERT journal_entry + lines in same transaction → trigger DEFERRABLE valide
    ELSE:
      ia_fallback_claude(event) → proposal review_required
    UPDATE source_events.processing_status = 'classified' | 'failed'
```

## 6. RLS

- `compta.fn_user_has_access(user_id, tenant_id, legal_entity_id, required_role)` : hiérarchie `platform_admin > tenant_owner > accountant > viewer`, short-circuit platform_admin
- Policies authenticated : SELECT via `fn_user_has_access(..., 'viewer')`, INSERT/UPDATE via `fn_user_has_access(..., 'accountant')` ou `'tenant_owner'` pour certaines tables (tenants, memberships, legal_entities UPDATE/INSERT)
- Service_role : bypass total sur toutes tables (worker, Edge Functions)
- Bucket Storage `compta-documents` : 4 policies (SELECT/INSERT/DELETE authenticated via `fn_user_has_access` + ALL service_role)

## 7. Rollback Lot 0

En cas de régression critique côté compta, rollback possible :
```sql
-- Ordre critique : FK strictes empêchent DROP schema brutal
DROP SCHEMA compta CASCADE;
-- Les données Serenity public.* ne sont JAMAIS touchées par Lot 0
-- Le bucket storage compta-documents est à drop manuellement
DELETE FROM storage.buckets WHERE id = 'compta-documents';
```

Aucun impact sur `public.*` (schémas isolés).

## 8. Impact sur l'existant

| Composant | Impact Lot 0 | Impact Lot 1+ prévu |
|---|---|---|
| Tables `public.*` Serenity | **AUCUN** | Triggers AFTER INSERT/UPDATE Lot 2 (non-bloquants) |
| Edge Functions existantes | **AUCUN** | Nouvelle Edge Function `compta-post-worker` Lot 2 |
| Policies RLS `public.*` | **AUCUN** | — |
| Budget DB Supabase | +15 tables, +58 index, +838 rows PCG | Négligeable |
