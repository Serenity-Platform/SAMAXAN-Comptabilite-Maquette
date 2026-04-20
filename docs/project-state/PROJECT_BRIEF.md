# PROJECT_BRIEF — Paperasse

**Projet** : Module comptabilité française intégré au SaaS Serenity  
**Validation user** : Sam — 2026-04-19 (mode RISQUE)  
**Status projet** : Lot 0 terminé (fondation), Lot 1 à valider

## 1. Objectif métier

Fournir aux SAS/SASU clientes de Serenity un module de tenue comptable française continue, conforme PCG 2026 et liasse 2033, capable :
- d'**ingérer** sans perte tous les flux opérationnels Serenity (orders, wallet, Stripe, Revolut, factures fournisseur, marketplaces)
- de **proposer** des écritures comptables déterministes (règles) + IA fallback sur cas flous
- de **produire** les livres obligatoires (Grand livre, balance, journaux, FEC), la liasse 2033, la CA3
- de **verrouiller** périodes et exercices de manière auditable et inaltérable

## 2. Utilisateurs cibles

| Rôle | v1 Samaxan | v2+ SYRION | v3 clients SaaS |
|---|---|---|---|
| `platform_admin` | Sam (Anthropic seul dépasse) | Sam | Sam, Jérémy |
| `tenant_owner` | Sam | Sam (2 tenants) | Client final (1 par SaaS subscription) |
| `accountant` | — | — | Expert-comptable invité |
| `viewer` | Jérémy (read-only) | Jérémy | Admin interne client |

## 3. Périmètre v1 (inclus)

- **1 tenant** : Samaxan
- **1 legal_entity** : Samaxan SAS (franchise TVA, réel simplifié IS)
- **Ingestion** Lot 2 : triggers SQL `AFTER INSERT/UPDATE` sur `orders`, `purchase_invoices`, `wallet_transactions`, `stripe_payments`, `revolut_orders`, `supplier_orders` → `compta.source_events`
- **Classification** Lot 2 : moteur de règles déterministes v1 (12 règles seed) + IA fallback Claude Opus 4.7
- **Saisie manuelle** Lot 3 : upload facture fournisseur (PDF/image) + création `source_event` + proposition de classification
- **Facturation sortante** Lot 4 : numérotation déterministe `F-2026-NNNN` / `AV-2026-NNNN` via `fn_next_sequence`
- **Écritures comptables** : partie double stricte, immutabilité, verrouillage périodes (D001 persisté)
- **TVA** Lot 6 : 10 règles v1 (B2C/B2B FR, UE autoliq, hors UE export, franchise 293B, achats FR/UE/non-UE)
- **Liasse 2033** Lot 7 : 52 cases v1 avec mapping `pcg_roots` à finaliser
- **FEC** Lot 8 : export conforme arrêté 29/07/2013

## 4. Périmètre v1 (exclu)

- Multi-entity par tenant → v2
- Abonnement SaaS clients tiers → v3
- Facturation électronique Peppol / PPF → v2+ (champs `einvoicing_config` prévus)
- Apports en industrie SYRION → v2
- Pack addon clients Serenity → v3

## 5. Contraintes

**Techniques** :
- Postgres 17 Supabase + Edge Functions (Deno)
- Schéma `compta` isolé (pas de pollution `public`)
- Montants : `numeric(18,2)` strict, jamais float
- Idempotence universelle via `idempotency_key` generated stored (D004)
- Post asynchrone via worker cron 30s, batch 50 avec `FOR UPDATE SKIP LOCKED` (D003)

**UX** :
- Propositions d'écritures **review_required** par défaut, auto_post uniquement si règle déterministe + confiance haute + plafond (D001 tenant_settings)
- Réouverture période = action platform_admin uniquement, tracée audit_logs

**Sécurité** :
- RLS sur 100 % des tables tenant-scoped via `compta.fn_user_has_access`
- Service_role bypass pour workers Edge Functions
- Bucket `compta-documents` privé, path `{tenant_id}/{legal_entity_id}/...`

**Légales** :
- PCG 2026 · Liasse 2033 régime simplifié · CA3 mensuelle ou trimestrielle
- Conservation 10 ans · FEC à première demande admin fiscale
- Chronologie, immutabilité, intangibilité (art. 420-2 PCG)

## 6. Dépendances externes

- Sirene API (validation SIREN onboarding Lot 1) — sans clé, endpoint public
- Anthropic API (IA fallback classification Lot 5) — clé existante dans vault
- PDF génération (factures Lot 4) — pdfkit Deno ou équivalent à trancher Lot 4

## 7. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Confusion facilitateur marketplace (Cdiscount/Octopia) | Haute | Moyen | Règles `review_required` par défaut, pas d'auto_post |
| Mapping liasse 2033 complexe | Moyenne | Haut | Lot 7 dédié, v1 avec `pcg_roots=NULL` puis affinage |
| Volume orders Serenity élevé → saturation worker | Moyenne | Haut | Batch 50 + SKIP LOCKED + monitoring Lot 2 |
| Régularisations TVA franchise → assujetti | Faible | Haut | TVA rules versionnées `effective_from/to` |
| Samaxan data saisie ≠ Sirene (NAF) | Constatée | Faible | Correction onboarding Lot 1 |

## 8. Définition du "done" Lot 0

Socle DB opérationnel prouvé :
1. 22 migrations appliquées live Supabase prod
2. Seeds complets (838 PCG, 52 liasse, 10 TVA, 12 classification)
3. RLS sur toutes tables + `fn_user_has_access` fonctionnelle
4. 8 invariants DB testés PASS (partie double, immutabilité, locked propagation, fn_next_sequence atomique)
5. Bucket Storage `compta-documents` opérationnel avec RLS
6. Docs d'état à jour et versionnés sous `docs/project-state/`
7. Repo GitHub restructuré (monorepo stub + archivage maquette + migrations)
8. Deploy Netlify `state=ready` après push
