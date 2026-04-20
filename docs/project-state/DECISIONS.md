# DECISIONS — Paperasse

Journal des arbitrages structurants. Format ADR simplifié : contexte, options, décision, justification, alternatives rejetées, conséquences.

---

## D001 — Statut `locked` PERSISTÉ sur `journal_entries`

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, implémenté migrations M6+M7

**Contexte** : comment savoir si une écriture est verrouillée ? Via statut propre de la période (dérivé) ou colonne dédiée (persisté) ?

**Décision** : colonne `status` persistée sur `journal_entries` avec valeurs `posted`/`locked`/`reversed`, + colonnes `locked_at` et `locked_by`. Trigger `fn_propagate_period_lock` AFTER UPDATE status sur `accounting_periods` propage le verrouillage à toutes les entries de la période en même transaction.

**Justification** :
- Requêtes simples et rapides (pas de JOIN systématique avec `accounting_periods`)
- Immutabilité enforced directement par trigger sur entry (plus robuste)
- Traçabilité `locked_by` sur l'entry elle-même
- Cohérence avec pattern PCG : l'écriture **est** verrouillée, pas "sa période l'est"

**Alternatives rejetées** :
- Statut dérivé via `JOIN accounting_periods` → coût JOIN + cas de réouverture complexes

**Conséquences** : trigger propagation à maintenir. Test 7/8 Lot 0 le valide.

---

## D002 — `rule_applications` jsonb EMBARQUÉ (pas table dédiée)

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, implémenté migrations M6

**Contexte** : comment tracer quelles règles ont été appliquées à une proposition / écriture ? Historique audit obligatoire pour IA et règles versionnées.

**Décision** : colonne `rule_applications jsonb NOT NULL DEFAULT '[]'::jsonb` sur `accounting_proposals` ET `journal_entries`. Format : `[{rule_id, rule_code, rule_version, context_snapshot, result, applied_at}]`. Indexé via `GIN (rule_applications jsonb_path_ops)`.

**Justification** :
- Requêtes natives simples (`jsonb_path_query`)
- Pas de FK complexe, pas de table qui grossit vite
- Immutabilité naturelle (jsonb sur entry posted = locked)
- Cross-query "quelles propositions ont utilisé `TVA_IMPORT_UE_AUTOLIQ` ?" triviale avec index GIN

**Alternatives rejetées** :
- Table `rule_applications (proposal_id, rule_id, ...)` : normalisation mais JOIN systématique, complexité FK
- Audit log unique : séparation propre mais queries multi-step

**Conséquences** : GIN index coût écriture, acceptable pour nos volumes.

---

## D003 — Post automatique ASYNCHRONE via worker cron

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, implémenté Lot 2

**Contexte** : quand une proposition est `ready_to_post` (règle déterministe + confidence haute + montant sous cap), qui crée l'écriture ? Trigger sync dans la même transaction ou worker async ?

**Décision** : **worker Edge Function `compta-post-worker`** cron 30s, batch 50 avec `SELECT ... FOR UPDATE SKIP LOCKED`. Proposition passe `status='ready_to_post'` → worker la consomme.

**Justification** :
- Découplage : un trigger Serenity plante ne doit pas planter le post comptable
- Retry naturel : `post_attempts` + `post_last_error`
- Observabilité : logs Edge Function + `audit_logs` entry
- `FOR UPDATE SKIP LOCKED` = concurrent safe, scalable multi-worker

**Alternatives rejetées** :
- Trigger AFTER INSERT sur `accounting_proposals` → couplage fort, gestion erreur difficile dans PG

**Conséquences** : latence post ≤ 30s, acceptable. Monitoring cron critique.

---

## D004 — Idempotence universelle via `idempotency_key` generated STORED

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, implémenté migration M5

**Contexte** : un webhook Stripe peut être rejoué 5 fois. Un trigger Serenity peut se déclencher deux fois sur UPDATE idempotent. Comment garantir une seule `source_event` par événement réel ?

**Décision** : colonne générée `idempotency_key text GENERATED ALWAYS AS (external_source || ':' || external_id || ':' || tenant_id::text) STORED` avec `UNIQUE INDEX` dédié. Tout INSERT sur `source_events` utilise `ON CONFLICT (idempotency_key) DO NOTHING`.

**Justification** :
- Clé déterministe, pas de collision possible entre tenants
- Generated STORED = indexable, stable
- Pattern universel : appliqué à tous les types d'events (Stripe, Revolut, orders, uploads, manuel)

**Alternatives rejetées** :
- UNIQUE composite `(external_source, external_id, tenant_id)` → même effet mais moins explicite dans requêtes
- Déduplication applicative → erreur humaine possible

**Conséquences** : 1 tool call DB par event (ON CONFLICT), coût négligeable.

---

## D005 — Projet Supabase UNIQUE, schéma `compta` isolé

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, implémenté migration M1

**Contexte** : créer un projet Supabase dédié Paperasse ou coloc avec Serenity V2 Dashboard ?

**Décision** : même projet `wtvnepynwrvvpugmdacd`, schéma `compta` isolé. Triggers SQL peuvent référencer `public.*` et `compta.*` dans la même transaction.

**Justification** :
- Triggers AFTER INSERT/UPDATE sur `public.orders` doivent créer `compta.source_events` en même transaction — impossible avec projets séparés
- Coût DB négligeable vs complexité multi-projet
- RLS isole via `search_path` + policies

**Alternatives rejetées** :
- Projet séparé + sync async via webhooks Supabase → latence, risque désync, complexité énorme

**Conséquences** : schéma Serenity saturé (128 tables + 282 fonctions). Schéma `compta` isolé par convention de nommage.

---

## D006 — Triggers SQL AFTER INSERT/UPDATE sur tables Serenity

**Date** : 2026-04-19 · **Lot** : 0 (design), implémentation Lot 2  
**Statut** : ACTÉ

**Contexte** : comment ingérer les flux Serenity ?

**Décision** : triggers SQL `AFTER INSERT OR UPDATE` sur 6 tables Serenity (orders, purchase_invoices, wallet_transactions, revolut_orders, stripe_payments, supplier_orders). Chaque trigger appelle `compta.fn_ingest_*_event` qui INSERT dans `compta.source_events` via `ON CONFLICT (idempotency_key) DO NOTHING`.

**Justification** :
- Atomicité avec la transaction originale Serenity
- Pas de polling, pas de queue externe
- `fn_resolve_tenant_for_user` retourne NULL si user non mappé → skip silencieux

**Alternatives rejetées** :
- Outbox pattern + worker polling → latence + complexité
- Debezium CDC → overkill pour notre cas

**Conséquences** : Lot 2 doit être carré (gestion erreurs triggers). Si `compta.fn_ingest_*_event` plante, la transaction Serenity plante aussi — ce qui est voulu pour ne pas masquer les bugs.

---

## D007 — Repo `SAMAXAN-Comptabilite-Maquette` restructuré (pas nouveau)

**Date** : 2026-04-19 · **Lot** : 0  
**Statut** : ACTÉ, en cours d'implémentation

**Contexte** : garder le repo maquette comme monorepo Paperasse ou créer un nouveau repo ?

**Décision** : restructurer `SAMAXAN-Comptabilite-Maquette` → monorepo `apps/web/`, `apps/api/`, `packages/shared/`, `supabase/migrations/`, `docs/project-state/`, `docs/reference-dataset/`. Maquette archivée sous `reference/mockup-v0/`.

**Justification** :
- Histoire Git conservée
- Site Netlify `samaxan-compta-maquette` peut être redirigé/reconfiguré sans créer nouveau projet
- URL maquette reste accessible pour référence UI

**Alternatives rejetées** :
- Nouveau repo `paperasse` → histoire perdue, config Netlify à refaire, double gestion

**Conséquences** : commit de restructuration massif. Révisable en v2 si douleur.

---

## D013 — `public.compta_companies` orpheline préservée Lot 0

**Date** : 2026-04-20 · **Lot** : 0  
**Statut** : ACTÉ

**Contexte** : découverte d'une table `public.compta_companies` non prévue avec 1 row Samaxan saisi manuellement par Sam le 19/04 11:33 (jsonb complet).

**Décision** : **préserver** la table orpheline pendant Lot 0 (ne pas droper). Data récupérée et stockée dans `docs/reference-dataset/samaxan-ref/legal_entity_samaxan.json`. DROP déplacé au Lot 1 post-migration vers `compta.legal_entities`.

**Justification** :
- Zéro risque de perte de données saisies
- Lot 1 sera la migration contrôlée
- Trace honnête plutôt que tentation de "simplifier"

**Alternatives rejetées** :
- Drop immédiat → perte de la saisie
- Migration automatique Lot 0 → hors périmètre, risqué

**Conséquences** : tâche explicite `compta_companies drop` à l'ordre du jour Lot 1.

---

## D014 — `journal_entries.status` CHECK IN ('posted','locked','reversed')

**Date** : 2026-04-20 · **Lot** : 0  
**Statut** : ACTÉ, détecté par test invariant #3

**Contexte** : test 3 a rejeté INSERT status='draft'. Confirmation que c'est **par design correct**.

**Décision** : `journal_entries` ne peut **jamais** avoir `status='draft'`. Les drafts vivent exclusivement dans `accounting_proposals`. Pattern : INSERT `journal_entries` avec status='posted' + lignes dans la **même transaction**, trigger `DEFERRABLE INITIALLY DEFERRED` vérifie l'équilibre au COMMIT.

**Justification** :
- Séparation claire : `accounting_proposals` = cycle de vie humain, `journal_entries` = écritures comptables fermées dès écriture
- Conformité PCG : une écriture comptable ne devrait pas exister en "brouillon" dans les livres
- Trigger DEFERRABLE permet l'INSERT atomique entry+lignes sans erreur

**Alternatives rejetées** :
- Ajouter `'draft'` au CHECK → casse l'immutabilité, complique le trigger, brouille sémantique

**Conséquences** : worker Lot 2 et UI Lot 3 doivent suivre ce pattern. Documenté dans ARCHITECTURE.md.

---

## D015 — NAF Sirene autoritative vs saisie manuelle Samaxan (SAS confirmée)

**Date** : 2026-04-20  
**Contexte** : La row orpheline `public.compta_companies` pour Samaxan contenait `legal_form='SASU'` et `naf='6201Z'` (saisie manuelle). L'API Sirene publique (`recherche-entreprises.api.gouv.fr`) retourne pour le SIREN 851264606 : `nature_juridique='5710'` (SAS) et `activite_principale='47.91B'` (commerce de détail de biens d'occasion). Le dirigeant est `HERZI SAMY - Président de SAS`.

**Décision** : Sirene fait autorité légale. Lors de l'onboarding, les données Sirene sont préremplies mais éditables. Pour Samaxan, les valeurs finales retenues sont :
- `legal_form = SAS` (validé par Sam 2026-04-20)
- `naf = 47.91B`

La migration Lot 1.4 `20260421_000099_migrate_samaxan_then_drop_companies.sql` utilisera les valeurs Sirene et non les valeurs saisies.

**Alternatives rejetées** :
- Conserver la saisie manuelle sans vérif Sirene → risque d'erreurs silencieuses sur toute la chaîne fiscale (TVA, liasse, relations marketplaces).
- Imposer Sirene sans édition possible → bloquant pour entreprises en diffusion partielle ou avec champs INSEE retardés.

**Références** : validation visuelle Samaxan par Sam, payload Sirene test réel via `pg_net` le 2026-04-20.

---

## D016 — Mapping `nature_juridique` INSEE → `legal_form` Paperasse

**Date** : 2026-04-20  
**Contexte** : INSEE utilise un code numérique 4 chiffres pour la nature juridique (ex. 5710 = SAS, 5499 = SARL). Paperasse utilise un vocabulaire canonique en libellés (SAS, SASU, SARL, EURL, SA, SCI, SNC, SELARL, SCP, AUTRE). Il faut une table de correspondance maintenue en deux endroits (SQL + TS Edge Function).

**Décision** : Le mapping est centralisé dans `compta.fn_map_nature_juridique(p_code text) RETURNS text` côté SQL et **dupliqué à l'identique** dans la fonction `mapNatureJuridique()` de l'Edge Function `compta-sirene-lookup` (TypeScript). Tout code INSEE non listé retourne `'AUTRE'`. La liste v1 couvre les formes les plus fréquentes des PME françaises :

| Code INSEE | legal_form Paperasse |
|---|---|
| 5710 | SAS |
| 5720, 5488 | SASU |
| 5498 | EURL |
| 5499, 5410, 5422 | SARL |
| 5306, 5307, 5308 | SA |
| 6540 | SCI |
| 5202 | SNC |
| 6585 | SELARL |
| 6588 | SCP |
| autres | AUTRE |

**Alternatives rejetées** :
- Table SQL `nature_juridique_map` seedable → surcoût (table + RLS + CRUD admin) pour gain nul en v1 ; switch possible v2 si besoin d'extensibilité dynamique.
- Mapping unique côté SQL avec RPC appelée depuis TS → latence supplémentaire de 50-100ms à chaque lookup, sans valeur ajoutée (la table INSEE évolue ~1x/an).

**Risques** :
- Dérive entre SQL et TS si l'un des deux est modifié sans l'autre → mitigation : tout ajout de code INSEE doit passer par une migration SQL + mise à jour de l'Edge Function, tracée dans un nouvel ADR.

**Références** : `supabase/migrations/20260421_000001_onboarding_helpers.sql` (SQL) + `apps/api/supabase/functions/compta-sirene-lookup/index.ts` (TS).

---
