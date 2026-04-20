# REALITY_AUDIT — Paperasse Lot 0

**Date audit** : 2026-04-19 → 2026-04-20  
**Auditeur** : Claude (mode RISQUE)  
**Validation user** : Sam — 2026-04-19  

Cartographie factuelle de l'existant ayant servi de base aux décisions d'architecture Lot 0.

## 1. Supabase

- **Projet unique** : `wtvnepynwrvvpugmdacd` (Serenity V2 Dashboard)
- **Région** : us-east-1 · **Postgres** : 17
- **Schémas** : `public` (Serenity, 128 tables, ~282 fonctions, saturé) · `storage`, `auth`, `extensions`, `pg_catalog`, `cron`
- **Extensions** : `pg_cron` (pg_catalog), `pg_net`/`pgcrypto`/`uuid-ossp`/`pg_graphql`/`pg_stat_statements`/`unaccent` (extensions)
- **Schéma compta** : **créé** par Lot 0 (migration `compta_20260420_000001`)
- **Storage buckets avant Lot 0** : 5 (logos, invoices, packages marketplace, etc.)
- **Storage après Lot 0** : `compta-documents` privé 20 Mo, 7 mime types autorisés

**Héritage bloquant préservé** : `public.compta_companies` contient 1 row Samaxan saisie par Sam le 19/04 11:33 (jsonb `fiscal`, `identity`, `invoicing` complet). Décision D013 : **préservée** pendant Lot 0, **drop reporté au Lot 1** post-migration onboarding vers `compta.legal_entities`.

**Tables Serenity d'intérêt pour Lot 2** (triggers d'ingestion) : `orders`, `purchase_invoices`, `wallet_transactions`, `revolut_orders`, `stripe_payments`, `supplier_orders`.

## 2. GitHub

- **Repo maquette** : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette`
- **HEAD avant Lot 0** : `8b3c0bfd05c2c151c2866ee5db6c6edc5db21a91` · **Tree** : `6248b11310f148351770a96c67a3f4bf8cadc06d` · 35 entrées, 20 blobs non-vides (~177 Ko)
- **Repo Serenity prod** : `Serenity-Platform/Serenity-Dashboard-New` (HEAD stable `00ab2eda` 19/04 23:46)

## 3. Netlify

- **Site maquette** : `0112f5df-60eb-4a03-b1d9-08b4b4168c22` (samaxan-compta-maquette) — en `state=error` depuis 19/04 à cause de `.netlify/netlify.toml` avec `publish="/tmp/maquette-compta-samaxan"` (chemin `/tmp` mort sur runner Netlify)
- **Site Serenity prod** : `1328c712-f574-4f10-b54d-b9818e076995` (app-serenity.com) — stable

## 4. Données de référence Samaxan (saisie utilisateur)

Depuis `public.compta_companies` :
- **Forme** : SAS (valide Sirene code 5710) — contradiction note Project Instructions disant "SASU"
- **SIREN** : 851264606 · **SIRET** : 85126460600027
- **Président** : Samy HERZI
- **NAF saisi** : `6201Z` vs **Sirene** `47.91B` — **Sirene fait foi**, correction Lot 1
- **Régime TVA** : franchise en base (art. 293 B CGI)
- **Régime IS** : réel simplifié (liasse 2033)
- **Exercice** : 01/01 → 12/31 · **Capital** : 1000 €
- **Préfixes facture** : `F-2026-` / **avoir** : `AV-2026-`

## 5. Secrets Supabase vault (lecture)

- `ANTHROPIC_API_KEY` (108 chars, MAJ 19/04) — utilisable pour fallback IA Lot 5
- `RESEND_API_KEY` · `REVOLUT_SECRET_KEY` · `REVOLUT_WEBHOOK_SECRET` — Serenity existants
- Flag produit : `wallet_enabled`

## 6. Edge Functions

~200 Edge Functions Serenity déployées. Aucune nommée `compta-*` avant Lot 0. Edge Function stub `compta-post-worker` à créer au Lot 2.

## 7. Migrations historiques Serenity

618 migrations antérieures au 20/04/2026, couvrant : catalog, pricing, orders, commissions Cdiscount/Octopia, agents monitoring, wallet, support tickets. Pattern de nommage Supabase CLI `YYYYMMDDHHMMSS_snake_case`.

**22 migrations Lot 0** ajoutées le 20/04/2026 sous préfixe `compta_20260420_000001..22`.

## Classification prouvé / supposé / manquant

| Info | Statut | Source |
|---|---|---|
| Schéma `compta` créé 15 tables | **Prouvé** | `list_tables` live 20/04 |
| 838 PCG + 52 liasse + 10 TVA + 12 classification seed | **Prouvé** | `SELECT COUNT` live |
| RLS activée sur toutes tables compta | **Prouvé** | `pg_policy` live |
| Bucket `compta-documents` 20 Mo | **Prouvé** | `storage.buckets` live |
| 8 tests invariants PASS | **Prouvé** | Traces d'erreurs captures en session |
| Sam est tenant_owner initial Samaxan | **Supposé** | À confirmer Lot 1 |
| Jérémy accède à quelle legal_entity ? | **Manquant** | À définir Lot 1 |
| Mapping cases 2033 → pcg_roots | **Manquant** | Lot 7 (liasse) |
| Edge Functions cron schedule | **Manquant** | Lot 2 |
