# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 10:32 UTC  
**Lot courant** : Lot 0 — **DONE + CI/CD lié** · prochain : Lot 1 Onboarding

## État Lot 0 — Clôturé ✅ avec CI/CD

| Item | Statut | Preuve |
|---|---|---|
| 22 migrations DB appliquées live | ✅ DONE | `supabase_migrations.schema_migrations` |
| Seeds complets (838 PCG, 52 liasse, 10 TVA, 12 classification) | ✅ DONE | `SELECT COUNT` live |
| RLS + `fn_user_has_access` + policies | ✅ DONE | migrations M19-M21 |
| Bucket Storage `compta-documents` | ✅ DONE | 4 policies actives |
| 8/8 tests invariants PASS | ✅ DONE | traces capturées |
| 7 docs d'état sur main | ✅ DONE | `docs/project-state/` |
| DECISIONS.md D001-D014 | ✅ DONE | 9 ADR tracés |
| Monorepo + maquette archivée sous `reference/mockup-v0/` | ✅ DONE | 63 blobs sur main |
| Deploy initial Netlify | ✅ DONE | visuel validé par Sam 2026-04-20 12:24 |
| **Lien GitHub ↔ Netlify actif** | ✅ DONE | deploy auto `69e60036d0ca43000881e761` sur push commit `d8ee4465` |
| **CI/CD end-to-end prouvé** | ✅ DONE | push main → webhook → build auto → ready 14s |

## État de la chaîne CI/CD (prouvée fonctionnelle)

```
GitHub commit sur main
  ↓ webhook installation_id=94325536 (GitHub App Netlify sur org Serenity-Platform)
Netlify build
  ↓ netlify.toml base="." → npm ci (via package-lock.json racine) → npm run build --workspace=apps/web
  ↓ tsc --noEmit → vite build → apps/web/dist
Deploy production ready
  ↓
https://samaxan-compta-maquette.netlify.app
```

Config live :
- `build_settings.provider: github`
- `build_settings.repo_url: https://github.com/Serenity-Platform/SAMAXAN-Comptabilite-Maquette`
- `build_settings.repo_branch: main`
- `build_settings.installation_id: 94325536`
- `build_settings.cmd: npm ci && npm run build`  *(override par netlify.toml)*
- `build_settings.base: apps/web` → override par `netlify.toml` base="."
- `build_settings.dir: apps/web/dist`
- `build_image: noble`

## Commits Lot 0

| Commit | Description |
|---|---|
| `a5fcd5d5` | Lot 0 — Fondation DB + restructuration monorepo |
| `044cc1c2` | Merge PR #1 (merge commit) |
| `18d2ff23` | docs: maj SESSION_STATE.md |
| `d8ee4465` | fix(netlify): monorepo build config + package-lock.json |

## Données initiales Samaxan (à préserver Lot 1)

Extraites de `public.compta_companies` (row orpheline préservée D013), stockée dans `docs/reference-dataset/samaxan-ref/legal_entity_samaxan.json` :

- `legal_form` : SAS (Sirene code 5710 — validé utilisateur 2026-04-20)
- `siren` : 851264606 · `siret` : 85126460600027
- `naf` : Sirene `47.91B` (arbitrage Lot 1 : Sirene fait foi vs saisie manuelle `6201Z`)
- `regime_tva` : franchise (art. 293 B CGI)
- `regime_is` : réel simplifié (liasse 2033)
- `fiscal_year_start` : 01/01 · `fiscal_year_end` : 31/12
- `capital_amount` : 1000 EUR
- `invoicing_config.prefix` : "F-2026" · `avoir_prefix` : "AV-2026"
- `president` : Samy HERZI
- `serenity_user_id` : `643f7b04-549e-415b-a9d1-1e2c610c16bb`

## Prochain pas — Lot 1 Onboarding Samaxan

Prêt à démarrer. Livrable : flux UI 6 steps de création tenant + legal_entity + journaux + périodes, avec migration de la data `compta_companies` orpheline.

**Fichiers à produire Lot 1** :
1. `supabase/migrations/20260421_000001_onboarding_helpers.sql` — `fn_create_tenant_with_legal_entity` (SECURITY DEFINER, INSERT atomique)
2. `apps/api/supabase/functions/compta-sirene-lookup/index.ts` — Edge Function lookup Sirene API
3. `apps/api/supabase/functions/compta-onboarding-submit/index.ts` — Edge Function submit formulaire
4. `apps/web/src/pages/Onboarding/*.tsx` — flux 6 steps (Identity, Fiscal, Invoicing, Team, Serenity, Confirm)
5. `apps/web/src/components/*.tsx` — composants design system Serenity-cohérent (Input, Select, Card, Button…)
6. `apps/web/src/api/*.ts` — client Supabase typé via `@paperasse/shared`
7. `supabase/migrations/20260421_000099_migrate_compta_companies_then_drop.sql` — dernière étape après validation UI Sam

**Mode** : RISQUE maintenu pour Lot 1 (impact : création d'entité comptable réelle, modèle de permissions à tester end-to-end).

**Validation dure requise avant lancement Lot 1** : feu vert Sam explicite.

## Validation 7 conditions de clôture Lot 0

1. **Périmètre respecté** ✅
2. **Build OK** ✅ — auto-build Netlify `ready` en 14s
3. **Tests minimaux OK** ✅ — 8/8 invariants DB
4. **Comportement réel démontré** ✅ — visuel validé + CI/CD prouvé
5. **Effets de bord listés** ✅ — ARCHITECTURE.md §8
6. **État projet à jour** ✅ — ce fichier
7. **Aucune dépendance silencieuse** ✅ — stubs explicites Lot 2+

## Écarts résolus vs initiaux

| Instruction Project | Observé | Résolution |
|---|---|---|
| "Samaxan SASU" | Sirene SAS (code 5710) | ✅ Validé par Sam 2026-04-20 : SAS confirmé |
| "NAF 6201Z" (saisie) vs Sirene `47.91B` | Divergence | Résolution Lot 1 via Sirene API réel (arbitrage Sirene fait foi) |
| `compta_companies` orpheline | 1 row Samaxan | D013 — migration Lot 1 + DROP |
| Site Netlify non-lié au repo | `provider=None` initial | ✅ Lié, CI/CD actif |

## Contact

- Propriétaire produit : Sam
- Superviseur technique : Claude (mode RISQUE Lot 0+1)
- Repo : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette` (main)
- Supabase : `wtvnepynwrvvpugmdacd`
- Netlify : `0112f5df-60eb-4a03-b1d9-08b4b4168c22` (samaxan-compta-maquette)
