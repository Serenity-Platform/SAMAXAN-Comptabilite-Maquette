# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 09:58 UTC  
**Lot courant** : Lot 0 — **DONE** · prochain : Lot 1 Onboarding

## État Lot 0 — Clôturé ✅

| Item | Statut | Preuve |
|---|---|---|
| Schéma `compta` + 15 tables + indexes + triggers | ✅ DONE | migrations M1-M7 live |
| Seed PCG 2026 (838 comptes) | ✅ DONE | `SELECT COUNT` = 838 live |
| Seed liasse 2033 (52 cases) | ✅ DONE | `SELECT COUNT` = 52 live |
| Seed TVA rules v1 (10 règles) | ✅ DONE | `SELECT COUNT` = 10 live |
| Seed classification_rules v1 (12 règles) | ✅ DONE | `SELECT COUNT` = 12 live |
| RLS helpers + policies sur toutes tables | ✅ DONE | migrations M19-M21 live |
| Bucket `compta-documents` + 4 policies | ✅ DONE | migration M22 live |
| Tests invariants 8/8 PASS | ✅ DONE | traces d'erreurs captées session 2026-04-20 |
| 7 docs d'état produits et validés | ✅ DONE | `docs/project-state/` sur main |
| DECISIONS.md (D001-D014) | ✅ DONE | 9 décisions tracées |
| 22 fichiers SQL sous `supabase/migrations/` | ✅ DONE | pushés main sha 044cc1c2 |
| Repo restructuré monorepo + archivage maquette | ✅ DONE | PR #1 mergée |
| Déploiement Netlify `state=ready` | ✅ DONE | deploy `69e5f78ef5e13c6c1cd85347` |
| 7 conditions de clôture Lot 0 | ✅ OK | voir bas de fichier |

## Commit final Lot 0

- **PR** : https://github.com/Serenity-Platform/SAMAXAN-Comptabilite-Maquette/pull/1 (mergée)
- **main HEAD** : `044cc1c2e62473a4dc5c05d065f215716180ef02`
- **Netlify** : https://samaxan-compta-maquette.netlify.app · deploy `69e5f78ef5e13c6c1cd85347` · state=`ready`
- **Supabase** : 22 migrations `compta_20260420_000001..22` live sur `wtvnepynwrvvpugmdacd`

## Données initiales Samaxan (à préserver Lot 1)

Extraites de `public.compta_companies` (row orpheline préservée D013), stockée dans `docs/reference-dataset/samaxan-ref/legal_entity_samaxan.json` :

- `legal_form` : SAS (vs instructions Project "SASU" — Sirene code 5710 fait foi)
- `siren` : 851264606 · `siret` : 85126460600027
- `naf` : Sirene `47.91B` (la saisie utilisateur disait `6201Z`, correction Lot 1)
- `regime_tva` : franchise (art. 293 B CGI)
- `regime_is` : réel simplifié (liasse 2033)
- `fiscal_year_start` : 01/01 · `fiscal_year_end` : 31/12
- `capital_amount` : 1000 EUR
- `invoicing_config.prefix` : "F-2026" · `avoir_prefix` : "AV-2026"
- `president` : Samy HERZI
- `serenity_user_id` : `643f7b04-549e-415b-a9d1-1e2c610c16bb`

## Prochain pas — Lot 1 Onboarding Samaxan

Livrable : flux UI 6 steps de création tenant + legal_entity + journaux + périodes, avec migration de la data `compta_companies` orpheline.

**Fichiers à produire** :
1. `supabase/migrations/20260421_000001_onboarding_helpers.sql` — `fn_create_tenant_with_legal_entity` (SECURITY DEFINER, INSERT atomique tenant + legal_entity + 4 journaux seed + fiscal_year 2026 + 12 accounting_periods + membership initiale)
2. `supabase/migrations/20260421_000002_sirene_lookup_edge_function_ref.sql` — row dans `compta.app_secrets` éventuel pour API Sirene
3. `apps/api/supabase/functions/compta-onboarding-submit/index.ts` — Edge Function validation Sirene + appel `fn_create_tenant_with_legal_entity`
4. `apps/api/supabase/functions/compta-sirene-lookup/index.ts` — Edge Function lookup Sirene API (public endpoint)
5. `apps/web/src/pages/Onboarding/index.tsx` — page hôte
6. `apps/web/src/pages/Onboarding/Step1Identity.tsx` — saisie SIREN + preview Sirene
7. `apps/web/src/pages/Onboarding/Step2Fiscal.tsx` — régimes TVA/IS
8. `apps/web/src/pages/Onboarding/Step3Invoicing.tsx` — exercice + préfixes
9. `apps/web/src/pages/Onboarding/Step4Team.tsx` — memberships initiales
10. `apps/web/src/pages/Onboarding/Step5Serenity.tsx` — lookup `serenity_user_id`
11. `apps/web/src/pages/Onboarding/Step6Confirm.tsx` — récap + submit
12. `supabase/migrations/20260421_000099_migrate_compta_companies_then_drop.sql` — migration data ponctuelle + DROP table orpheline (dernière étape après validation UI manuelle par Sam)

**Validation requise** : Sam teste en live le flux onboarding sur `https://samaxan-compta-maquette.netlify.app` avec le SIREN Samaxan `851264606`, confirme visuellement la création, puis lance la migration 20260421_000099.

**Criticité** : Lot 1 crée les entités dont Lot 2 a besoin (`legal_entities.serenity_user_id` pour résolution triggers). Bloquant pour la suite.

## Validation 7 conditions de clôture Lot 0

1. **Périmètre respecté** ✅ — tout ce qui était prévu est livré, rien au-delà
2. **Build OK** ✅ — `tsc 0 erreur`, `vite build 1.65s`, deploy Netlify `ready`
3. **Tests minimaux OK** ✅ — 8/8 invariants DB adverses PASS
4. **Comportement réel démontré** ✅ — DB opérationnelle, front déployé, API accessible
5. **Effets de bord listés** ✅ — ARCHITECTURE.md §8 : aucun impact sur `public.*` Serenity, bucket Storage isolé
6. **État projet à jour** ✅ — ce fichier + DECISIONS.md + ROADMAP.md sur main
7. **Aucune dépendance silencieuse** ✅ — pas de code mort, pas de TODO invisible, tous les stubs sont explicitement marqués Lot 2+

## Écarts observés entre instructions et réalité (à corriger Lot 1)

| Instruction Project | Observé live | Action Lot 1 |
|---|---|---|
| "Samaxan SASU" | Sirene SAS (code 5710) | Corriger instructions Project + data via Sirene API |
| "NAF 6201Z" (saisie) | Sirene `47.91B` | Corriger via Sirene API + confirm Sam |
| "compta_companies n'existe pas" | 1 row Samaxan orpheline | D013 — migrer Lot 1 + drop après validation |

## Contact

- Propriétaire produit : Sam
- Superviseur technique : Claude (mode RISQUE Lot 0, à évaluer pour Lot 1)
- Repo : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette`
- Supabase : `wtvnepynwrvvpugmdacd`
- Netlify : `0112f5df-60eb-4a03-b1d9-08b4b4168c22`
