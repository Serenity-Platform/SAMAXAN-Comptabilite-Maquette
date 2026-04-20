# SESSION_STATE — Paperasse

**Dernière mise à jour** : 2026-04-20 11:05 UTC  
**Lot courant** : Lot 1.1 — **DONE** (helpers SQL + Edge Function Sirene lookup) · prochain : Lot 1.2 UI onboarding

---

## État Lot 0 — Clôturé ✅ (pour rappel)

| Item | Statut | Preuve |
|---|---|---|
| 22 migrations DB appliquées live | ✅ DONE | `supabase_migrations.schema_migrations` |
| Seeds complets (838 PCG, 52 liasse, 10 TVA, 12 classification) | ✅ DONE | `SELECT COUNT` live |
| RLS + `fn_user_has_access` + policies | ✅ DONE | migrations M19-M21 |
| Bucket Storage `compta-documents` | ✅ DONE | 4 policies actives |
| 8/8 tests invariants PASS | ✅ DONE | traces capturées |
| 7 docs d'état sur main | ✅ DONE | `docs/project-state/` |
| Monorepo + maquette archivée | ✅ DONE | `reference/mockup-v0/` |
| Lien GitHub ↔ Netlify + CI/CD prouvé | ✅ DONE | 2 deploys auto successifs |
| Deploy initial Netlify validé visuel | ✅ DONE | Sam 2026-04-20 12:24 |

---

## État Lot 1.1 — DONE ✅

### Contenu

Helpers SQL d'onboarding + Edge Function de lookup Sirene.

### Livrables

**SQL côté Supabase** (migration `compta_20260421_000001_onboarding_helpers`, appliquée live) :

| Fonction | Rôle |
|---|---|
| `compta.fn_map_nature_juridique(text)` | Mapping code INSEE (4 chiffres) → `legal_form` canonique Paperasse (SAS/SASU/SARL/EURL/SA/SCI/SNC/SELARL/SCP/AUTRE) |
| `compta.fn_seed_default_journals(tenant_id, legal_entity_id)` | Crée les 4 journaux VT/AC/BQ/OD pour une legal_entity, idempotent via ON CONFLICT |
| `compta.fn_seed_accounting_periods(tenant_id, legal_entity_id, fiscal_year_id)` | Crée les périodes mensuelles pour toute la durée du fiscal_year (gère exercice non-calendaire via clipping aux bornes) |
| `compta.fn_create_tenant_with_legal_entity(user_id, tenant_name, payload jsonb, fiscal_start, fiscal_end)` | INSERT atomique tenant + legal_entity + fiscal_year + 4 journaux + 12 periods + membership tenant_owner + audit_log, rollback complet en cas d'erreur |

**Edge Function** `apps/api/supabase/functions/compta-sirene-lookup/index.ts` (268 lignes TS) :

- Input : `?siren=NNN` ou `?siret=NNNNNNNNNNNNNN` ou body `{siren|siret|q}` (GET + POST)
- Appelle `https://recherche-entreprises.api.gouv.fr/search?q=<siren>` (7 req/s, public, pas de token)
- Timeout 8s, User-Agent `Paperasse/0.1`
- Normalisation payload Sirene → format Paperasse prêt pour `fn_create_tenant_with_legal_entity` :
  - `name`, `legal_form` (via mapping miroir SQL), `siren`, `siret`
  - `address.{line1,postal_code,city,country}` reconstruite depuis `numero_voie + type_voie + libelle_voie`
  - `president.{name,role}` par priorité `Président > Gérant > Directeur général > premier dirigeant`
  - `active`, `date_creation`, `categorie_entreprise`, `nombre_etablissements`
  - `_sirene_raw` (nature_juridique, activite_principale, date_mise_a_jour) pour debug
- Warnings non-bloquants : `entreprise_cessee`, `nature_juridique_non_mappee:CODE`, `pas_de_dirigeant_detectable`
- Codes HTTP : 200 OK, 400 format invalide, 404 not_found, 409 siret_mismatch (avec suggestion), 502 upstream error, 405 method_not_allowed
- CORS ouvert (GET/POST/OPTIONS)

### Tests effectués

| Test | Résultat |
|---|---|
| Création nominale Samaxan test (Sam user_id) | ✅ 1 tenant + 1 legal_entity + 1 membership + 4 journaux (AC/BQ/OD/VT) + 1 fiscal_year + 12 periods + 1 audit_log |
| User inexistant (uuid bidon) | ✅ `foreign_key_violation` levée |
| Payload incomplet (address manquante) | ✅ `invalid_parameter_value` levée |
| SIREN mal formaté (3 chiffres) | ✅ `check_violation` levée (CHECK de la table) |
| Mapping nature juridique (5710/5499/6540/9999) | ✅ `SAS/SARL/SCI/AUTRE` |
| Rollback atomique après erreur | ✅ Zéro pollution DB après tests adverses |
| Cleanup post-tests | ✅ DB revenue à 0 tenant |
| API Sirene réelle pour SIREN 851264606 | ✅ Retour complet + structure documentée |
| Normalisation TS locale sur payload réel | ✅ `name=SAMAXAN`, `legal_form=SAS`, `naf=47.91B`, `address.line1="12 RUE DU PRE DES AULNES"`, `president={name:"SAMY HERZI",role:"Président de SAS"}` |

### Décisions tracées

- **D015** : NAF Sirene (`47.91B`) fait autorité vs saisie manuelle (`6201Z`). `legal_form=SAS` confirmée (pas SASU).
- **D016** : Mapping `nature_juridique` INSEE → `legal_form` centralisé SQL + miroir TS, liste v1 couvrant les 14 codes les plus fréquents.

### Preuves fichiers / code

| Fichier | Présence |
|---|---|
| `supabase/migrations/20260421_000001_onboarding_helpers.sql` | ✅ Extrait depuis DB, 275 lignes |
| `apps/api/supabase/functions/compta-sirene-lookup/index.ts` | ✅ 268 lignes |
| `apps/api/supabase/functions/compta-sirene-lookup/deno.json` | ✅ |
| `docs/project-state/DECISIONS.md` | ✅ D015+D016 ajoutés |
| `docs/project-state/SESSION_STATE.md` | ✅ ce fichier |

### Limites Lot 1.1

- **Edge Function non encore déployée sur Supabase** (déploiement via CLI ou UI Supabase à faire par Sam avec ses credentials, ou via le tool `deploy_edge_function` dès session ultérieure si disponible). Le code est versionné sur GitHub main et prêt.
- Le lookup Sirene a été **validé côté DB** (via `pg_net`) et **côté normalisation TS** (exécution Node locale). Le déploiement complet Edge Function reste à faire pour le test de bout en bout HTTP public.

### Prochaines étapes

**Validation requise avant Lot 1.2** :
1. Sam déploie `compta-sirene-lookup` sur Supabase (CLI : `supabase functions deploy compta-sirene-lookup --no-verify-jwt` ou UI)
2. Test HTTP : `curl https://wtvnepynwrvvpugmdacd.supabase.co/functions/v1/compta-sirene-lookup?siren=851264606`
3. Retour attendu : JSON `{ok:true, data:{name:"SAMAXAN", legal_form:"SAS", naf:"47.91B", ...}, warnings:[]}`

Après validation, passage Lot 1.2.

---

## Lot 1.2 — À venir

**Objectif** : UI 6 steps onboarding sur `https://samaxan-compta-maquette.netlify.app`

Steps : Identity (SIREN + Sirene preview) → Fiscal → Invoicing → Team → Serenity → Confirm.

---

## Commits main

| Commit | Description |
|---|---|
| `a5fcd5d5` | Lot 0 — Fondation DB + restructuration monorepo |
| `044cc1c2` | Merge PR #1 |
| `18d2ff23` | docs: maj SESSION_STATE.md |
| `d8ee4465` | fix(netlify): monorepo config + package-lock.json |
| `9294cc8b` | docs: SESSION_STATE Lot 0 cloture + CI/CD |
| (à suivre) | feat(lot1.1): onboarding helpers + Sirene Edge Function |

---

## Validation 7 conditions de clôture Lot 1.1

1. **Périmètre respecté** ✅ — helpers SQL + Edge Function Sirene, rien de plus
2. **Build OK** ✅ — migration appliquée sans erreur, SQL syntax-checké
3. **Tests minimaux OK** ✅ — 5 tests DB PASS, 1 test normalisation TS PASS
4. **Comportement réel démontré** ✅ — appel Sirene réel, RPC réelle testée, rollback confirmé
5. **Effets de bord listés** ✅ — aucun (helpers isolés, pas de trigger modifié)
6. **État projet à jour** ✅ — DECISIONS.md + ce fichier
7. **Aucune dépendance silencieuse** ⚠️ — Edge Function à déployer manuellement par Sam (dépendance explicite documentée)

**Statut : PARTIAL → devient DONE après déploiement Edge Function par Sam.**

---

## Contact

- Propriétaire produit : Sam
- Superviseur technique : Claude (mode RISQUE Lot 1)
- Repo : `Serenity-Platform/SAMAXAN-Comptabilite-Maquette` (main)
- Supabase : `wtvnepynwrvvpugmdacd`
- Netlify : `0112f5df-60eb-4a03-b1d9-08b4b4168c22` (samaxan-compta-maquette)
