# Paperasse

Module de comptabilité française intégré au SaaS [Serenity](https://app-serenity.com).
Conforme PCG 2026, liasse 2033, CA3, FEC.

**Statut : Lot 0 (fondation DB) — en cours.**

## Architecture

Monorepo npm workspaces :

```
paperasse/
├── apps/web/                     Frontend React + Vite + TS
├── apps/api/supabase/functions/  Edge Functions (Deno TS)
├── packages/shared/              Types + utilitaires partagés
├── supabase/migrations/          22 migrations Lot 0 (compta_*)
├── docs/project-state/           Fichiers d'état du protocole
├── docs/reference-dataset/       Dataset de référence Samaxan
└── reference/mockup-v0/          Maquette HTML UX d'origine (archivée)
```

Stack :
- Frontend : React 18 / Vite / TypeScript / Tailwind
- Backend : Supabase Postgres 17 (schéma `compta` isolé) + Edge Functions Deno
- Déploiement : Netlify (branch deploy + prod)

Projet Supabase : `wtvnepynwrvvpugmdacd` (partagé avec Serenity V2 Dashboard, schéma séparé).

## Lot 0 — Livré (socle DB)

- Schéma `compta` isolé (15 tables tenant-scoped + référentielles)
- 838 comptes PCG 2026 · 52 cases liasse 2033 · 10 règles TVA v1 · 12 règles classification v1
- Invariants DB : partie double stricte, immutabilité des écritures posted, propagation `locked` (D001), idempotence universelle (D004)
- RLS sur 100% des tables via `compta.fn_user_has_access` (hiérarchie platform_admin > tenant_owner > accountant > viewer)
- Bucket Storage `compta-documents` privé 20 Mo
- 8/8 tests d'invariants adverses PASS

Voir :
- `docs/project-state/ARCHITECTURE.md` — schéma DB, décisions, RLS, rollback
- `docs/project-state/DECISIONS.md` — D001-D014 (statuts locked, rule_applications, post asynchrone, idempotence…)
- `docs/project-state/ROADMAP.md` — 9 lots v1
- `docs/project-state/SESSION_STATE.md` — avancement courant
- `docs/project-state/REALITY_AUDIT.md` — audit honnête de l'existant
- `docs/project-state/PROJECT_BRIEF.md` — objectif, périmètre, contraintes
- `docs/project-state/UX_PRODUCT_BLUEPRINT.md` — personae, shell UI, règles UX

## Maquette v0

La maquette HTML statique qui a servi à valider la direction UX est archivée sous
`reference/mockup-v0/`. Elle n'est plus le produit — elle reste référence.

## Prochain jalon

**Lot 1** : onboarding Samaxan (création tenant + legal_entity via UI, seed journaux, migration `public.compta_companies`).

## Conventions

- Français pour UI, commentaires, docs. Anglais pour code, identifiants, schémas.
- Commits descriptifs, pas de `wip` ni `fix typo` sans contexte.
- Aucune écriture comptable créée sans trace règle appliquée (`rule_applications` jsonb).
- Toute modification de lot produit une mise à jour de `docs/project-state/SESSION_STATE.md`.

---

© 2026 SAMAXAN · Paperasse — Module Serenity
