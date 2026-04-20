# UX_PRODUCT_BLUEPRINT — Paperasse

**Cadre produit** : expérience utilisateur du module Paperasse  
**Validation user** : Sam — 2026-04-19  
**Implémentation** : Lot 3 (shell UI) → Lot 4 (facturation) → Lot 5 (IA) → Lot 6+ (TVA/liasse)

## 1. Personae

### Tenant Owner (Sam, Samaxan v1)
- Fondateur, responsable légal, signe la liasse
- **Ce qu'il veut voir d'abord** : « est-ce que ma compta est à jour, tout est cohérent, rien de bloqué ? »
- **Ce qu'il redoute** : découvrir une proposition fausse déjà postée, perdre des données, régularisations TVA massives
- **Fréquence usage** : hebdomadaire, pointu à fin de mois et fin d'exercice

### Accountant (expert-comptable invité)
- Valide les propositions flaguées
- **Ce qu'il veut voir d'abord** : la pile de propositions `review_required`, priorité critiques
- **Ce qu'il redoute** : cohérence douteuse sans traçabilité
- **Fréquence usage** : quotidien ou hebdomadaire selon volume

### Viewer (Jérémy, Samaxan v1)
- Lecture seule, suivi business
- **Ce qu'il veut voir** : dashboard balance, CA, marges par marketplace

## 2. Shell d'interface (Lot 3)

Navigation principale (sidebar mobile-first cohérent avec Serenity) :
- **Dashboard** — KPIs : solde compte, CA du mois, propositions en attente, périodes à verrouiller
- **Propositions** — liste filtrable (status, période, marketplace, montant)
- **Écritures** — journaux, balance, grand livre
- **Factures** — émission + réception
- **Banque** — rapprochement (Lot 6)
- **TVA** — CA3 par période (Lot 6)
- **Liasse** — état + export FEC (Lot 8)
- **Société** — legal_entity settings, journaux, exercices
- **Équipe** — memberships, rôles
- **Audit** — audit_logs drill-down

## 3. Règles UX structurantes

### R1 — Double validation pour actions irréversibles
- Verrouiller période = modal explicite + reason text + confirmation
- Clôturer exercice = modal + snapshot preview + confirmation 2 étapes

### R2 — Réouverture période = réservée platform_admin
- Boutton absent pour tenant_owner (403 au backend)
- Action tracée dans audit_logs priority=high avec `reopen_reason` obligatoire

### R3 — Auto-post silencieux visible à posteriori
Les écritures auto-postées apparaissent dans "Écritures" avec un badge `auto` et lien vers la règle appliquée (`rule_applications` jsonb → UI drill-down).

### R4 — Propositions en attente toujours actionnables en 1 clic
- Accepter = UPDATE status=ready_to_post → worker pick up
- Rejeter = modal + reason obligatoire
- Modifier = editor des `proposed_lines` (ajout/suppression/édition) → re-balance auto affiché

### R5 — Pas de suppression
- Aucune action "supprimer" n'est exposée côté UI
- Écritures posted : seule la contrepassation est possible (`reverses_id`)
- Propositions rejetées : `status='rejected'` + reason, jamais deleted

### R6 — Chronologie visible
Chaque écriture affiche : `piece_reference` (unique par legal_entity), `entry_date`, `created_at`, `posted_at` → traçabilité chronologique conforme PCG.

### R7 — Samaxan en franchise TVA = indicateurs absents par défaut
Menus TVA / déclarations CA3 grisés avec tooltip "Régime franchise art. 293 B CGI — pas de CA3 requise". Activation automatique au basculement assujetti.

## 4. Écran « Propositions »

Colonne | Contenu | Action rapide
--- | --- | ---
Date | `occurred_at` event | —
Source | Badge coloré stripe/revolut/orders/etc. | Filtre
Libellé | `proposed_lines[0].label_template` résolu | —
Montant TTC | Formaté `1 234,56 €` | Tri
Confidence | Badge vert/orange/rouge | —
Règle | `rule_applications[0].rule_code` | Tooltip
Action | Accepter · Modifier · Rejeter | —

Filtres latéraux : status, confidence_level, marketplace, date range, montant range.

## 5. Écran « Écritures »

Vue par défaut = **Journal général**, filtre journal code `VT/AC/BQ/OD/...`.

Colonnes : n° pièce, date, journal, libellé, total débit, total crédit, status (posted/locked/reversed badge).

Expand row → affichage des lignes détaillées (account_pcg + label + débit/crédit + analytical_code).

Action sur entry posted : « Contrepasser » (crée une nouvelle entry avec `reverses_id`).

## 6. Écran « Société »

- **Identité** : SIREN/SIRET/forme/NAF (lecture SIRENE onboarding Lot 1, modifiable admin)
- **Régimes** : TVA + IS + préfixes facture
- **Exercice courant** : start/end + status
- **Périodes** : liste mensuelle avec status badge, action « verrouiller »
- **Journaux** : seed VT/AC/BQ/OD créés auto Lot 1, ajout custom possible
- **Banques** : liste comptes (`banks` jsonb) — connexion Revolut/autre Lot 6

## 7. Onboarding Lot 1 (flux)

Step 1 : identité société — SIREN saisi → appel API Sirene → préremplissage
Step 2 : régime fiscal — TVA (franchise/réel simplifié/réel normal/mini_reel) + IS (réel simplifié/réel normal/IR transparent)
Step 3 : exercice + préfixes facture
Step 4 : invitations équipe — memberships initiales
Step 5 : connexion Serenity (optionnel) — lookup `serenity_user_id`
Step 6 : récap + création atomique legal_entity + journaux seed + exercice courant + 12 accounting_periods

## 8. États vides (empty states)

- Pas de propositions : « Tout est traité ! Les nouvelles écritures apparaîtront ici automatiquement. »
- Pas d'écritures : « Premier mois : les écritures apparaîtront dès que Serenity envoie les premiers flux. »
- Période non verrouillée : CTA clair « Verrouiller le mois » avec compteur checks préalables (balance=0, ...)

## 9. Micro-copy

- « Verrouiller » (jamais « clôturer » en UX v1 — on réserve « clôturer » à l'exercice)
- « Proposition » = `accounting_proposal` status review_required
- « Écriture » = `journal_entry` status posted/locked
- « Pièce » = référence chronologique UNIQUE par legal_entity
- « Contrepasser » = reverses_id

## 10. Design system

Réutilise les tokens Serenity : palette violet `#431E96`, accent `#A202C7`, fonts système, composants sobres. Détails à cadrer Lot 3 via `serenity-design-system` skill.
