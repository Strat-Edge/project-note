# Project Note — Application de gestion de projets personnelle

PWA mono-utilisateur (Strat'Edge) — capture universelle, projets, tâches, notes, documents, calendrier, offline-first.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Règles de dépendance entre couches (AD-2 — non négociable)

- `domain/` ne dépend d'aucun autre module du projet. Il expose des types et interfaces, jamais l'inverse.
- `data/local/`, `data/remote/` et `sync/` dépendent de `domain/`, jamais l'inverse.
- `sync/` est le seul module autorisé à dépendre à la fois de `data/local/` et `data/remote/`.
- `components/` ne dépend que de `domain/` ; `app/` dépend de `domain/`, `components/`, et `data/local/`.
- **`data/remote/` ne peut être importé — directement ou transitivement — que par du code qui ne s'exécute jamais dans le bundle client** (route handlers, Server Actions, Render Cron). Un React Server Component qui l'importerait viole la règle au même titre qu'un composant client.

Voir `_bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md` pour le détail complet des décisions d'architecture (AD-1 à AD-10).

## Stack

Next.js 16.3.0 (App Router) · TypeScript 6.0.3 (déviation flaguée du pin AD-8 à 7.0.2 — incompatibilité `typescript-eslint`, cf. Story 1.1 Dev Agent Record) · Dexie.js (IndexedDB, local-first) · Supabase (Postgres + Auth + Storage) · Serwist (PWA/service worker) · Web Push (VAPID).

## Déploiement

Render (Web Service) — Build command : `npm install && npm run build` (Render n'enchaîne pas `npm install` automatiquement avant un Build Command custom), Start command : `npm run start`. Pas d'environnement de staging (décision explicite, outil interne solo).
