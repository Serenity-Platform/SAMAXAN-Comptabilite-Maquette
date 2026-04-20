# ROADMAP — Paperasse

**Validée** : Sam — 2026-04-19 (mode RISQUE)  
**Granularité** : 1 lot = 1 fonctionnalité bout-en-bout testable  

Chaque lot suit les **7 conditions de clôture** : (1) périmètre respecté · (2) build OK · (3) tests minimaux OK · (4) comportement réel démontré · (5) effets de bord listés · (6) état projet mis à jour · (7) aucune dépendance silencieuse non traitée. Validation dure user obligatoire entre chaque lot.

## Lot 0 — Fondation DB + Storage + RLS (EN COURS, 98%)

**Objectif** : Socle technique inaltérable, testable, prouvé en prod.

**Fichiers touchés** : `supabase/migrations/20260420_000001..22_*.sql` (22) + `docs/project-state/*.md` (7) + restructuration repo maquette.

**Critères d'acceptation** :
- 22 migrations appliquées et versionnées dans `supabase_migrations.schema_migrations` ✅
- Seeds complets (838 PCG + 52 liasse + 10 TVA + 12 classification) ✅
- RLS sur 100 % tables compta ✅
- 8 invariants DB testés live ✅
- Bucket `compta-documents` + 4 RLS policies ✅
- Repo GitHub restructuré **EN COURS**
- Deploy Netlify `state=ready` **À VÉRIFIER**

**Preuves attendues** : `SELECT COUNT(*)` live, traces d'erreurs attendues pour tests adverses, SHA commit GitHub, URL Netlify deploy.

**Risques** : repo Netlify deploy cassé depuis 19/04 à cause de `.netlify/netlify.toml`. Correction : nouveau `netlify.toml` racine monorepo.

**Fallback** : rollback `DROP SCHEMA compta CASCADE` — 0 impact sur Serenity `public.*`.

---

## Lot 1 — Onboarding + Tenant/Legal Entity setup

**Objectif** : créer Tenant Samaxan + Legal Entity Samaxan depuis flux guidé (UI), seed journaux/fiscal_year/periods, basculer la data `public.compta_companies` orpheline.

**Fichiers touchés** :
- `supabase/migrations/20260421_*_onboarding_helpers.sql` (fonctions `fn_create_tenant_with_legal_entity`, seed journaux par défaut VT/AC/BQ/OD, création fiscal_year courant + 12 accounting_periods)
- `supabase/migrations/20260421_*_migrate_compta_companies_to_legal_entities.sql` (migration ponctuelle data + DROP `public.compta_companies`)
- `apps/api/supabase/functions/compta-onboarding-submit/index.ts` (Edge Function validation + création atomique)
- `apps/web/src/pages/Onboarding/*.tsx` (flux 6 steps)

**Dépendances** : Lot 0.

**Critères d'acceptation** :
- Tenant Samaxan + Legal Entity Samaxan créés via UI (pas SQL manuel)
- Data `compta_companies` migrée (forme SAS corrigée vs instructions SASU, NAF corrigé 6201Z → 47.91B via Sirene)
- `public.compta_companies` droppée proprement
- Sam = `tenant_owner` Samaxan
- Jérémy = `viewer` Samaxan (scope tenant)
- 4 journaux seed : VT (sales), AC (purchases), BQ (bank), OD (misc)
- Exercice 2026 (01/01 → 12/31) + 12 accounting_periods status=`open`
- Appel Sirene API au SIREN saisi retourne données identiques à celles saisies par Sam en 2026-04-19

**Preuves** : screenshots UI flux complet, commit SHA, `SELECT COUNT` live post-migration, backup `compta_companies.json` dans `docs/reference-dataset/`.

**Risques** : mapping `serenity_user_id` ambigu (quel user_id Serenity pour Samaxan ?). Résolution Lot 1 via sélecteur dans step 5 onboarding.

---

## Lot 2 — Ingestion Serenity → source_events + Classification

**Objectif** : triggers SQL sur 6 tables Serenity + worker classification déterministe + auto-post conditionnel.

**Fichiers touchés** :
- `supabase/migrations/20260425_*_serenity_ingestion_triggers.sql` (6 triggers AFTER INSERT/UPDATE + fonction `fn_ingest_*_event` par table + `fn_resolve_tenant_for_user` complétée v1)
- `supabase/migrations/20260425_*_classification_worker_helpers.sql` (`fn_find_best_classification_rule`, `fn_resolve_tva_rule`, `fn_apply_rule_expressions`)
- `apps/api/supabase/functions/compta-post-worker/index.ts` (cron 30s)
- `apps/api/supabase/functions/compta-classifier/index.ts` (cron 30s batch 50 SKIP LOCKED)

**Dépendances** : Lot 1 (il faut un legal_entity + `serenity_user_id` mappé pour que la fonction retourne un row).

**Critères d'acceptation** :
- Chaque INSERT dans `orders`, `purchase_invoices`, `wallet_transactions`, `revolut_orders`, `stripe_payments`, `supplier_orders` crée 1 `source_event` (idempotent via `ON CONFLICT`)
- Worker classifier traite 50 events/batch, respecte priority rules
- Propositions `review_required` créées pour 12 cas test représentatifs (3 par marketplace + wallet + refund + upload)
- Auto-post déclenche INSERT atomique entry+lignes pour cas déterministes confidence_high sous le cap
- 0 race condition détectée sur 1000 inserts concurrents

**Preuves** : tests d'intégration, traces logs worker, SELECT counts.

**Risques forts** :
- Performance worker sous charge → monitoring dès le lancement
- Confusion facilitateur marketplace → règles `review_required` par défaut maintenues jusqu'à arbitrage Lot 6

---

## Lot 3 — UI Shell + Pages clés

**Objectif** : navigation, dashboard, propositions, écritures, société — lecture complète.

**Fichiers touchés** : `apps/web/src/{layouts,pages,components}/*.tsx` + routing.

**Critères d'acceptation** : parcours complet viewer + tenant_owner navigables sans erreur, cohérent avec Serenity design system, responsive mobile.

---

## Lot 4 — Facturation sortante

**Objectif** : émission facture client + avoir, numérotation `F-2026-NNNN`/`AV-2026-NNNN` via `fn_next_sequence`, génération PDF, push source_event + proposition comptable auto.

---

## Lot 5 — IA fallback classification + TVA assist

**Objectif** : Claude Opus 4.7 propose classification quand règles déterministes manquent. Confidence calculée. Tracée dans `rule_applications` avec `rule_code='ia_fallback'` + prompt + réponse. Fine-tuning décisions coach humain.

---

## Lot 6 — TVA CA3 + rapprochement bancaire

**Objectif** : édition CA3 mensuelle ou trimestrielle selon régime. Pré-rempli via `tax_periods.ca3_data` snapshot. Rapprochement bancaire Revolut import CSV.

---

## Lot 7 — Liasse 2033 export

**Objectif** : mapping complet `liasse_cells_2033.pcg_roots` (affinage v1), calcul automatique des 52 cases depuis grand livre, export PDF + JSON EDI-TDFC.

---

## Lot 8 — FEC export

**Objectif** : export FEC conforme arrêté 29/07/2013, 18 colonnes, encodage ASCII, séparateur `|`. Stockage versioné + accès admin fiscale en cas de contrôle.

---

## Ordre de déploiement

Lot 0 (socle prouvé) → Lot 1 (setup réel Samaxan, unblock ingestion) → Lot 2 (flux réels) → Lot 3 (UI visible) → Lot 4 (facturation sortante) → Lot 5 (IA) → Lot 6 (TVA/banque) → Lot 7 (liasse) → Lot 8 (FEC).

Durée estimée ordre de grandeur : Lot 0 fait, Lot 1 ~2-3 sessions, Lot 2 ~4-5 sessions, Lot 3 ~5+ sessions (UI), suite à évaluer.
