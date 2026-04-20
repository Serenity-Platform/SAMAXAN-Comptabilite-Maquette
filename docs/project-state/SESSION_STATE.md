# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 15:10 UTC
**Lots courants** : Lot 1.1 **DONE** + Lot 1.2 **DONE** + Lot 1.3 **PARTIAL** (code + deploy prouvés, test utilisateur final en attente)
**Prochain** : après validation Sam → Lot 1.4 (migration données Samaxan réelles)

---

## Site live

**URL** : https://samaxan-compta-maquette.netlify.app
**Dernier deploy** : commit `f6dffd4f`, state=ready, deploy_time=14s

---

## Lot 1.3 — État DONE côté backend, PARTIAL côté test utilisateur

### Prouvé backend

- Migration `compta_20260421_000002_onboarding_submit_rpc` appliquée live ✅
- `compta.fn_onboarding_submit(text, jsonb, date, date)` présente en DB ✅
- 3/3 tests SQL PASS (sans auth → insufficient_privilege, avec auth nominal → création 4 journaux + 12 periods + membership, duplicate → unique_violation) ✅
- Edge Function `compta-onboarding-submit` version 1 ACTIVE, verify_jwt=true ✅
- Env var Netlify `VITE_SUPABASE_ANON_KEY` configurée ✅
- Build CI/CD cycle #6 auto : state=ready, commit `f6dffd4f`, 14s ✅
- Bundle JS servi contient : URL Supabase + endpoint sirene + endpoint submit + JWT anon signature ✅

### À valider côté utilisateur (Sam)

Parcours de test attendu :

1. Aller sur https://samaxan-compta-maquette.netlify.app
2. Page d'accueil Lot 1.3 avec CTA "Démarrer l'onboarding" + lien "Se connecter"
3. Cliquer "Se connecter" → page Login, taper `samgraphiste@gmail.com` → "Recevoir le lien"
4. Ouvrir le mail, cliquer le magic link
5. Redirection automatique → `#dashboard`
6. Dashboard affiche "Aucune société" + bouton "Démarrer l'onboarding"
7. Cliquer l'onboarding → 6 steps (SIREN 851264606, récap, etc.)
8. Step 6 "Créer ma société" → écran SubmittedSuccess avec tenant_id, legal_entity_id, fiscal_year_id
9. Auto-redirection au dashboard au bout de 2s
10. Dashboard live : nom SAMAXAN, SAS, SIREN, NAF, 4 journaux, 12 périodes, exercice 2026

Si un pépin survient, soit :
- Erreur à l'auth → check env var VITE_SUPABASE_ANON_KEY côté Netlify
- Erreur submit → logs Edge Function `compta-onboarding-submit` dans dashboard Supabase
- Erreur lookup Dashboard → policies RLS compta (on vérifiera fn_user_has_access)

### À FAIRE après validation Sam

1. Test RLS multi-tenant : un 2e user (Jérémy `j.avital@app-serenity.fr`) ne doit voir aucun tenant de Sam
2. Ajouter D017 "1 tenant par user v1" dans DECISIONS.md
3. Passer Lot 1.3 à DONE
4. Cleanup DB : supprimer le tenant de test si Sam veut recommencer proprement

---

## Rappel Lot 1.1 — DONE ✅

- `compta.fn_map_nature_juridique` + 3 autres helpers + `fn_create_tenant_with_legal_entity`
- Edge Function `compta-sirene-lookup` déployée + testée HTTP 200 Samaxan

## Rappel Lot 1.2 — DONE ✅

- UI React 6 steps onboarding avec lookup Sirene live, gates validation, patch dates post-test Sam

## Rappel Lot 0 — DONE ✅

- 22 migrations compta, seeds 838/52/10/12, RLS, Storage, monorepo, CI/CD

---

## Commits main récents

| Commit | Description |
|---|---|
| `9294cc8b` | docs: Lot 0 clôture |
| `62bd3f6b` | feat(lot1.1): helpers SQL + Sirene Edge Function |
| `07c4ad71` | feat(lot1.2): UI onboarding 6 steps |
| `1e1b8f07` | docs: Lot 1.1+1.2 DONE |
| `abd261c4` | fix(lot1.2): validation dates Step 2 |
| `f6dffd4f` | feat(lot1.3): auth + création DB + dashboard |

---

## Stack effective

- Frontend : React 18 + Vite 5 + TypeScript 5, @supabase/supabase-js 2.45
- Backend : Supabase projet `wtvnepynwrvvpugmdacd`, schéma `compta`
- 2 Edge Functions Deno : `compta-sirene-lookup` (verify_jwt=false), `compta-onboarding-submit` (verify_jwt=true)
- Déploiement : Netlify `0112f5df-60eb-4a03-b1d9-08b4b4168c22`, auto via GitHub webhook
- Auth : magic link Supabase, `shouldCreateUser=false`, persistSession=true, storageKey=`paperasse-auth`
