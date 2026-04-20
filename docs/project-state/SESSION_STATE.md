# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 09:15 UTC  
**Lot courant** : Lot 0 — **fondation DB prouvée + restructuration repo en cours**

## État Lot 0

| Item | Statut | Preuve |
|---|---|---|
| Schéma `compta` créé | ✅ DONE | migration M1 live |
| 15 tables tenant/global + sequences | ✅ DONE | migrations M2-M6 live |
| Invariants triggers (partie double, immutabilité, locked D001) | ✅ DONE | migration M7 live |
| Seed PCG 2026 (838 comptes) | ✅ DONE | `SELECT COUNT` = 838 live |
| Seed liasse 2033 (52 cases) | ✅ DONE | `SELECT COUNT` = 52 live |
| Seed TVA rules v1 (10 règles) | ✅ DONE | `SELECT COUNT` = 10 live |
| Seed classification_rules v1 (12 règles) | ✅ DONE | `SELECT COUNT` = 12 live |
| RLS helpers (`fn_user_has_access`, `fn_resolve_tenant_for_user`) | ✅ DONE | migration M19 live |
| RLS policies toutes tables compta | ✅ DONE | migrations M20-M21 live |
| Bucket `compta-documents` + 4 policies | ✅ DONE | migration M22 live |
| Tests invariants 8/8 PASS | ✅ DONE | traces d'erreurs attendues captées session 2026-04-20 |
| 5 docs d'état produits et validés | ✅ DONE | `docs/project-state/` |
| DECISIONS.md (9 décisions D001-D007, D013, D014) | ✅ DONE | ce dossier |
| 22 fichiers SQL sous `supabase/migrations/` | 🔄 EN COURS | push GitHub en cours |
| Repo restructuré (monorepo + archivage maquette) | 🔄 EN COURS | commit en préparation |
| Déploiement Netlify `state=ready` | ⏳ À VÉRIFIER | post-push |
| 7 conditions de clôture Lot 0 | ⏳ À VALIDER | après push + Netlify OK |

## Derniers commits Supabase

22 migrations `compta_20260420_000001..22` appliquées 2026-04-20 entre 00:21:54 et 08:47:05 UTC. Toutes succès.

## Données initiales Samaxan (à conserver)

Extraites de `public.compta_companies` (row orpheline préservée D013), stockée dans `docs/reference-dataset/samaxan-ref/legal_entity_samaxan.json` :

- `legal_form` : SAS (vs instructions Project "SASU" — Sirene fait foi, code 5710)
- `siren` : 851264606 · `siret` : 85126460600027
- `naf` : Sirene `47.91B` (la saisie utilisateur disait `6201Z`, correction Lot 1)
- `regime_tva` : franchise (art. 293 B CGI)
- `regime_is` : réel simplifié (liasse 2033)
- `fiscal_year_start_month` : 1 · `fiscal_year_start_day` : 1 (cycle 01/01 → 12/31)
- `capital_amount` : 1000 EUR
- `invoicing_config.prefix` : "F-2026" · `avoir_prefix` : "AV-2026"
- `president` : Samy HERZI

## Prochain pas concret (Lot 1)

1. Créer Edge Function `compta-onboarding-submit` + UI flux 6 steps
2. Créer helpers SQL `fn_create_tenant_with_legal_entity`, seeding journaux VT/AC/BQ/OD, fiscal_year 2026 + 12 accounting_periods
3. Migrer `public.compta_companies[Samaxan]` → `compta.legal_entities` via data migration contrôlée
4. Créer memberships : Sam = tenant_owner, Jérémy = viewer (scope tenant)
5. DROP `public.compta_companies` après vérification
6. Correction NAF `6201Z` → `47.91B` via Sirene API réelle
7. Tests end-to-end onboarding : SIREN saisi → Sirene → preview → création atomique → lecture live

## Écarts observés entre instructions et réalité

| Instruction Project | Observé live | Action |
|---|---|---|
| "Samaxan SASU" | Sirene SAS (5710) | Corriger instructions Project + data Lot 1 |
| "NAF 6201Z" (saisie) | Sirene `47.91B` | Corriger Lot 1 via Sirene |
| "compta_companies n'existe pas" | 1 row Samaxan orpheline | D013 — préservée Lot 0, drop Lot 1 |

## Contact

- Propriétaire produit : Sam
- Superviseur technique : Claude (mode RISQUE Lot 0, mode NORMAL à partir Lot 3)
- Repo : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette`
- Supabase : `wtvnepynwrvvpugmdacd`
- Site Netlify : `0112f5df-60eb-4a03-b1d9-08b4b4168c22`
