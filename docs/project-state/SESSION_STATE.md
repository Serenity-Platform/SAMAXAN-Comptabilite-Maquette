# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 14:05 UTC  
**Lots courants** : Lot 1.1 **DONE** + Lot 1.2 **DONE** (UI onboarding visible et testable)  
**Prochain** : Lot 1.3 — Auth JWT + Edge Function submit onboarding → création DB réelle

---

## Site live à tester

**URL** : https://samaxan-compta-maquette.netlify.app

**Parcours testable** :
1. Page d'accueil avec stats Lot 0 (838 / 52 / 10 / 12) et CTA "Démarrer l'onboarding Samaxan"
2. Cliquer le CTA → flux 6 étapes
3. Step 1 : taper SIREN `851264606` → cliquer "Rechercher" → champs préremplis depuis Sirene (SAS, 47.91B, adresse, Samy HERZI)
4. Steps 2-5 : régime fiscal, facturation, équipe (optionnel), Serenity (optionnel)
5. Step 6 : récapitulatif complet
6. Cliquer "Créer ma société" → payload JSON final affiché (prêt pour RPC DB en Lot 1.3)

---

## État Lot 0 — Clôturé ✅

| Item | Statut | Preuve |
|---|---|---|
| 22 migrations DB + seeds | ✅ DONE | live sur `wtvnepynwrvvpugmdacd` |
| RLS + bucket Storage + invariants | ✅ DONE | 8/8 tests PASS |
| Monorepo + CI/CD GitHub↔Netlify | ✅ DONE | 4 cycles auto réussis |
| Deploy initial validé visuel | ✅ DONE | Sam 2026-04-20 12:24 |

---

## État Lot 1.1 — DONE ✅

**Livrables en DB (live)** :
- `compta.fn_map_nature_juridique(text)` — mapping INSEE → legal_form
- `compta.fn_seed_default_journals` — crée VT/AC/BQ/OD
- `compta.fn_seed_accounting_periods` — crée N periods mensuelles
- `compta.fn_create_tenant_with_legal_entity` — INSERT atomique tout-en-un

**Livrables côté Edge Function (déployée)** :
- `compta-sirene-lookup` — version 1 ACTIVE, verify_jwt=false
- ID : `2441ff75-40fd-4498-a059-3643459609e9`
- URL : `https://wtvnepynwrvvpugmdacd.supabase.co/functions/v1/compta-sirene-lookup`
- Test HTTP 200 PASS pour SIREN `851264606` → payload Samaxan complet normalisé

**Décisions tracées** : D015 (NAF Sirene fait autorité), D016 (mapping nature_juridique v1)

**Tests SQL** : 5/5 PASS (nominal + 3 adverses + mapping), rollback atomique confirmé

---

## État Lot 1.2 — DONE ✅

**Livrables UI** (12 fichiers, 47 KB sur `main` commit `07c4ad71`) :

**Architecture**
- `apps/web/src/App.tsx` — router minimal hash-based home ↔ onboarding
- `apps/web/src/lib/theme.ts` — design tokens alignés Serenity (violet #431E96, text-sm base)
- `apps/web/src/lib/config.ts` — URL Supabase + endpoint Sirene
- `apps/web/src/lib/types.ts` — types canoniques (SireneResult, OnboardingState, LegalForm, RegimeTVA…)
- `apps/web/src/lib/sireneApi.ts` — client fetch Edge Function typé

**Composants UI (5)**
- `Input`, `Select`, `Button` (primary/secondary/ghost/danger), `Card`, `Stepper`

**Pages**
- `pages/Home.tsx` — landing avec stats + CTA onboarding
- `pages/Onboarding.tsx` — flux 6 steps complet (871 lignes)

**6 steps**
1. **Identité** : SIREN + lookup Sirene live → preview éditable (name, legal_form, siret, naf, adresse, dirigeant). Gestion warnings non-bloquants (entreprise cessée, nature juridique non mappée, pas de dirigeant détectable)
2. **Fiscal** : régime TVA (franchise / réel simplifié / réel normal), régime IS (micro / réel simplifié / réel normal / non assujetti), exercice comptable dates
3. **Facturation** : préfixes facture + avoir, numéro de départ, aperçu temps réel
4. **Équipe** : emails invités (optionnel)
5. **Serenity** : liaison user_id Serenity (optionnel)
6. **Confirm** : récapitulatif groupé par section + CTA "Créer ma société"

**Soumission** : affiche le payload JSON final prêt pour `compta.fn_create_tenant_with_legal_entity` (création DB branchée en Lot 1.3)

**Build** : `tsc --noEmit` 0 erreur, `vite build` 42 modules → 168 KB (53 KB gzip), 1.8s

**Deploy** : Netlify auto `state=ready` en 13s, commit `07c4ad71`, deploy `69e63139f87c6b0008359b37`

**Scénario utilisateur validé fonctionnellement** :
- Route `#onboarding` réelle et accessible
- Navigation prev/next avec gates de validation par step
- Appel Sirene live fonctionnel (via Edge Function déployée Lot 1.1)
- Rendu responsive (flex + grid, pas de hardcoded width)
- Pas d'interaction vide : tous les boutons agissent
- Feedback explicite : loading, errors, warnings Sirene affichés

---

## Commits main

| Commit | Description |
|---|---|
| `a5fcd5d5` | Lot 0 — Fondation DB + monorepo |
| `044cc1c2` | Merge PR #1 |
| `18d2ff23` | docs: SESSION_STATE.md |
| `d8ee4465` | fix(netlify): monorepo + package-lock |
| `9294cc8b` | docs: Lot 0 clôture CI/CD |
| `62bd3f6b` | feat(lot1.1): helpers SQL + Sirene Edge Function |
| `07c4ad71` | feat(lot1.2): UI onboarding 6 steps avec Sirene live |

---

## Validation 7 conditions de clôture

### Lot 1.1
1. ✅ Périmètre respecté
2. ✅ Build OK (migration appliquée, Edge Function déployée)
3. ✅ Tests minimaux OK (5/5 SQL + 1 TS + HTTP end-to-end)
4. ✅ Comportement réel démontré (HTTP 200 Samaxan)
5. ✅ Effets de bord listés (aucun)
6. ✅ État projet à jour (ce fichier + DECISIONS.md D015+D016)
7. ✅ Aucune dépendance silencieuse

### Lot 1.2
1. ✅ Périmètre respecté (UI only, pas de hit DB)
2. ✅ Build OK (tsc 0 erreur, vite 42 modules)
3. ✅ Tests minimaux OK (build local PASS, deploy Netlify ready)
4. ✅ Comportement réel démontré (site live, parcours complet jusqu'à preview JSON)
5. ✅ Effets de bord listés (aucun sur Lot 0, page initiale préservée via Home)
6. ✅ État projet à jour (ce fichier)
7. ✅ Aucune dépendance silencieuse

---

## Lot 1.3 — Prochain

**Objectif** : brancher la soumission du formulaire sur `compta.fn_create_tenant_with_legal_entity`.

**Contenu prévu** :
1. Edge Function `compta-onboarding-submit` (verify_jwt=true)
2. Auth Supabase : login magic link ou password pour Sam
3. Dans l'UI : step 6 appelle la nouvelle Edge Function → vrai tenant créé en DB
4. Redirection post-création vers un dashboard minimal confirmant la création
5. Test RLS multi-tenant (un user B ne voit pas le tenant de A)

**DoD Lot 1.3** :
- Sam se connecte, fait l'onboarding Samaxan complet en prod
- Samaxan existe en DB avec tous ses journaux, périodes, fiscal_year, membership
- Un autre user ne voit pas ce tenant (test RLS)

---

## Contact & infra

- Propriétaire produit : Sam
- Repo : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette` (main)
- Supabase : `wtvnepynwrvvpugmdacd`
- Netlify : `0112f5df-60eb-4a03-b1d9-08b4b4168c22`
- Site : https://samaxan-compta-maquette.netlify.app
- Edge Function Sirene : https://wtvnepynwrvvpugmdacd.supabase.co/functions/v1/compta-sirene-lookup
