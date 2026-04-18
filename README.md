# SAMAXAN Comptabilité — Maquette Statique

Maquette HTML premium pour le système de gestion comptable SAMAXAN.

## 🎨 Design System

- **Palette** : Serenity (Violet #431E96, Accent #A202C7)
- **Typographie** : Inter (Google Fonts)
- **Inspiration UX** : Pennylane
- **Graphs** : Recharts (CDN)

## 📁 Structure

```
/
├── index.html                  # Login
├── dashboard.html              # Dashboard principal (KPI + graphs)
├── onboarding-1.html          # Onboarding étape 1/5
├── onboarding-2.html          # Onboarding étape 2/5
├── onboarding-3.html          # Onboarding étape 3/5
├── onboarding-4.html          # Onboarding étape 4/5
├── onboarding-5.html          # Onboarding étape 5/5
├── ecritures.html             # Écritures comptables
├── banque.html                # Rapprochement bancaire
├── factures.html              # Facturation
├── liasse.html                # Liasse fiscale
├── audit.html                 # Audit IA
├── documents.html             # Archive documents
├── societes.html              # Gestion multi-sociétés
├── equipe.html                # Gestion utilisateurs
├── audit-log.html             # Journal d'audit
├── agent-compta.html          # Agent comptable IA
└── assets/
    ├── css/
    │   └── style.css          # Design system complet
    ├── js/
    │   ├── navigation.js      # Routing client-side
    │   ├── charts.js          # Graphs Recharts
    │   └── agent.js           # Interface Agent IA
    └── img/
        ├── logo-samaxan.svg
        └── logo-samaxan-baseline.svg
```

## 🚀 Déploiement

**Netlify** : Auto-deploy depuis `main`

**URL Preview** : https://samaxan-comptabilite-maquette.netlify.app

## 🔧 Développement

Aucune compilation nécessaire, HTML/CSS/JS statiques.

Ouvrir `index.html` dans un navigateur moderne.

## 📝 Workflow validation

1. ✅ Login page
2. 🔄 Dashboard (en cours)
3. ⏳ Onboarding 5 étapes
4. ⏳ Pages métier (écritures, factures, etc.)
5. ⏳ Interface Agent IA

## 🎯 Next Steps

Une fois maquette validée :
- Migration HTML → React components
- Connexion Supabase
- Backend Edge Functions
- Déploiement production `compta.samaxan.fr`
