---
baseline_commit: NO_VCS
---

# Story 1.1: Initialisation et déploiement du projet

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want l'application déployée et installable en tant que PWA, avec le socle technique en place,
so that je dispose d'une base fonctionnelle sur laquelle construire toutes les fonctionnalités suivantes.

## Acceptance Criteria

1. **Given** le dépôt du projet est initialisé avec Next.js App Router et TypeScript **When** le projet est déployé sur Render (Web Service) **Then** l'application est accessible via une URL publique et répond avec succès (HTTP 200).
2. **Given** un navigateur mobile ou desktop compatible PWA **When** l'utilisateur visite l'application **Then** il peut l'installer sur l'écran d'accueil (manifest PWA + service worker Serwist enregistrés).
3. **Given** le projet Supabase dédié est créé **When** une table est ajoutée au schéma **Then** elle active Row Level Security par défaut avant tout déploiement en production.
4. **Given** le stockage local Dexie est initialisé **When** l'application démarre pour la première fois **Then** elle demande un stockage persistant au navigateur (`navigator.storage.persist()`).

## Tasks / Subtasks

- [x] Task 1: Initialiser le dépôt Next.js App Router + TypeScript (AC: #1)
  - [x] Créer le projet avec `create-next-app` — App Router, TypeScript, ESLint ; répertoire racine (pas de `src/`, cf. arborescence Architecture)
  - [x] Épingler `next` à `16.3.0` et `typescript` à `7.0.2` dans `package.json`
  - [x] Créer les dossiers vides `domain/`, `data/local/`, `data/remote/`, `sync/`, `components/` avec un fichier `index.ts` minimal ou `.gitkeep` — respecter dès maintenant AD-2 (voir Dev Notes) même si aucune logique n'y vit encore
  - [x] Ajouter un `README.md` court à la racine rappelant la règle de dépendance AD-2 (domain/ ne dépend de rien ; data/remote/ jamais dans le bundle client)
  - [x] Créer `.env.example` listant toutes les variables attendues (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ; noter en commentaire que `OPENAI_API_KEY` et `VAPID_*` seront ajoutées en Epic 5/Epic 7) et `.env.local` réel (gitignoré) pour le développement local
- [x] Task 2: Configurer le projet Supabase dédié (AC: #3)
  - [x] Guillaume crée manuellement un nouveau projet Supabase (séparé de toute autre infra existante, région Europe) — projet `pxdmtnysvglorwchwsmc` créé, clé publiable + clé secrète (nouveau système Supabase, remplace anon/service_role) placées dans `.env.local`, connectivité vérifiée (REST API + Storage API)
  - [x] Ajouter `@supabase/supabase-js` en version `2.112.0`
  - [x] Créer un client Supabase scopé (`data/remote/client.ts`), gardé par `server-only` (AD-2/AD-6) — client publiable + client secret séparé
  - [x] Créer deux buckets Supabase Storage : `documents` et `audio` — créés, vérifiés privés (`public: false`) via l'API Storage
  - [x] Documenter (`data/remote/index.ts`) la règle non-négociable : toute migration SQL doit inclure `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` **avant** toute politique — aucune table n'est créée sans RLS actif
  - [x] Activer "Activer le RLS automatique" à la création du projet — confirmé présent dans le schéma (fonction `rls_auto_enable`)
- [x] Task 3: Initialiser Dexie et le stockage persistant (AC: #4)
  - [x] Ajouter `dexie` en version `4.4.4`
  - [x] Initialiser la base Dexie dans `data/local/` (schéma vide pour l'instant — les tables sont ajoutées par les stories qui en ont besoin, jamais toutes d'un coup)
  - [x] Appeler `navigator.storage.persist()` au démarrage de l'application (une fois, côté client)
- [x] Task 4: Configurer Serwist pour l'installabilité PWA (AC: #2)
  - [x] Ajouter `@serwist/next` en version `9.5.11` (dependency) et `serwist` en version `9.5.11` (dependency — nécessaire au build, pas seulement en dev)
  - [x] Wrapper `next.config.ts` avec `withSerwistInit({ swSrc: "app/sw.ts", swDest: "public/sw.js" })`
  - [x] Créer `app/sw.ts` — API réelle du package 9.5.11 : `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true, navigationPreload: true, runtimeCaching: defaultCache })` puis `.addEventListeners()` (import `defaultCache` depuis `@serwist/next/worker`, pas `/browser` — corrigé après échec de build, voir Dev Agent Record)
  - [x] `tsconfig.json` : ajouté `"@serwist/next/typings"` à `compilerOptions.types`, `"webworker"` à `lib`, exclu `public/sw.js`
  - [x] `.gitignore` : ajouté `public/sw*` et `public/swe-worker*`
  - [x] Créé `app/manifest.ts` (convention App Router, équivalent typé à `manifest.json`) — nom "Project Note", `display: standalone`, icône SVG placeholder neutre (`public/icon-placeholder.svg`) — logo réel Strat'Edge arrive en Story 1.3
  - [x] Ajouté `applicationName`, `appleWebApp`, `viewport` (export séparé `Viewport`) à `app/layout.tsx`
- [x] Task 5: Déployer sur Render (AC: #1)
  - [x] Vérifié en local : `npm run build` puis `npm run start` répondent HTTP 200 sur `http://localhost:3000` — l'app est prête à déployer
  - [x] Guillaume crée le Web Service Render (palier Starter, sans mise en veille) et le connecte au dépôt `Strat-Edge/project-note`
  - [x] Build command : `npm install && npm run build` (Render n'enchaîne pas `npm install` automatiquement avant un Build Command custom — premier déploiement a échoué avec `next: not found` jusqu'à correction, cf. Dev Agent Record) — Start command : `npm run start`
  - [x] Variables d'environnement renseignées sur Render : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (les clés `OPENAI_API_KEY`/`VAPID_*` seront ajoutées par les stories qui en ont besoin — Epic 5 et Epic 7 — pas ici)
  - [x] Vérifié : `https://project-note-1ble.onrender.com/` (HTTP 200), `/manifest.webmanifest` (HTTP 200), `/sw.js` (HTTP 200)

### Review Findings

- [x] [Review][Patch] Incohérence version TypeScript entre README.md (7.0.2) et package.json (6.0.3) [README.md:26] — corrigé, README reflète maintenant la déviation flaguée AD-8
- [x] [Review][Patch] README documentait `npm run build` seul comme build command Render, alors que le Debug Log indique que ça échoue sans `npm install` préalable [README.md:30] — corrigé
- [x] [Review][Patch] `navigator.storage.persist()` sans gestion de rejet de promesse [app/storage-init.tsx:11] — ajout de `.catch(() => {})`
- [x] [Review][Patch] `requireEnv` acceptait une valeur composée uniquement d'espaces comme valide [data/remote/client.ts:9] — ajout de `.trim()`
- [x] [Review][Patch] Aucun contrôle d'indexation pour un outil public sans authentification (Story 1.2 pas encore livrée) — ajout de `app/robots.ts` (disallow global)
- [x] [Review][Defer] `data/local/db.ts` n'est importé nulle part encore ; risque latent si un futur composant serveur importe `data/local` avant qu'un vrai usage client existe [data/local/db.ts] — deferred, pre-existing (pattern de stub vide intentionnel, cf. Dev Notes)
- [x] [Review][Defer] Icônes manifest/apple-touch-icon insuffisantes pour l'installabilité PWA complète (une seule icône SVG `sizes: any`, pas de variante maskable ni PNG 192/512, pas d'apple-touch-icon) [app/manifest.ts, app/layout.tsx] — deferred, pre-existing (placeholder explicitement en attente du vrai logo Story 1.3)
- [x] [Review][Defer] Commentaire de `data/remote/client.ts` sur la garde `server-only` : le mécanisme ne bloque que l'inclusion dans le bundle client, pas un import direct par un React Server Component — nuance à corriger dans le commentaire quand un premier Server Action/route handler consommera réellement ce module [data/remote/client.ts:4-6] — deferred, pre-existing
- [x] [Review][Defer] Aucune règle ESLint n'impose automatiquement les frontières de dépendance AD-2 (domain/, components/, sync/) — repose entièrement sur la discipline humaine — deferred, pre-existing
- [x] [Review][Defer] Pas de `engines.node`/`.node-version` pour figer la version Node utilisée par Render [package.json] — deferred, pre-existing

## Dev Notes

**Paradigme et règles de dépendance (Architecture AD-1, AD-2) — s'appliquent dès cette story, même si les dossiers sont encore vides :**
- `domain/` ne dépend d'aucun autre module du projet (ni `data/*`, ni `sync/`, ni `app/`, ni `components/`).
- `data/local/`, `data/remote/` et `sync/` dépendent de `domain/`, jamais l'inverse.
- `data/remote/` ne peut être importé — directement ou transitivement — que par du code qui ne s'exécute jamais dans le bundle client (route handlers, Server Actions, Render Cron). Un React Server Component qui l'importerait violerait la règle au même titre qu'un composant client.
- `components/` ne dépend que de `domain/` ; `app/` dépend de `domain/`, `components/`, et `data/local/` (seule implémentation de stockage que `app/` peut importer directement, car toujours disponible même hors ligne).
- Cette story ne code aucune logique métier — elle pose juste la structure de dossiers pour que les stories suivantes (Epic 2+) respectent la règle dès le départ plutôt que de devoir refactorer.

**RLS non négociable (AD-4) :** toute table Supabase créée par n'importe quelle story future doit activer Row Level Security avec une policy restreignant l'accès au propriétaire (`auth.uid()`), même si l'app reste mono-utilisateur. Cette story n'a aucune table à créer elle-même, mais pose la discipline (checklist/README) que les stories suivantes doivent suivre.

**Stockage des fichiers (AD-5) :** `navigator.storage.persist()` doit être appelé au démarrage pour réduire le risque d'éviction du stockage navigateur, en particulier sur iOS. Support navigateur vérifié à jour (2026) : pleinement supporté sur Safari desktop et iOS Safari depuis la version 15.2+, et sur tous les navigateurs Chromium — aucune lacune de compatibilité. Safari/Chromium accordent ou refusent automatiquement selon des heuristiques d'engagement (pas de prompt visible) ; Firefox affiche un prompt.

**Aucun starter/template imposé par l'Architecture** — projet initialisé de zéro avec `create-next-app`, pas de boilerplate à cloner.

**Buckets Storage séparés (AD-8) :** `documents` et `audio`, jamais un bucket unique — cf. spec technique initiale §3.

**Pas d'environnement de staging (Architecture, décision explicite)** — développement direct contre la production Render/Supabase. Un seul environnement à configurer dans cette story.

### Project Structure Notes

Arborescence minimale à créer par cette story (cf. Architecture § Structural Seed) :

```text
/
  app/          # routes Next.js App Router — pages client + route handlers serveur + app/sw.ts + app/manifest.json
  domain/       # règles métier pures, aucune dépendance IO (vide pour l'instant)
  data/
    local/      # Dexie / IndexedDB — source de vérité immédiate (schéma initialisé, vide)
    remote/     # client Supabase — importé uniquement en contexte serveur (vide pour l'instant)
  sync/         # moteur de synchronisation + résolution de conflit par champ (vide pour l'instant, Epic 3)
  components/   # UI partagée (vide pour l'instant)
```

Ne pas utiliser de répertoire `src/` — l'Architecture place `app/`, `domain/`, `data/`, `sync/`, `components/` directement à la racine du dépôt.

Aucune table Supabase ni aucun schéma Dexie de contenu métier n'est créé dans cette story — chaque story future (Epic 2 pour `Project`, Epic 3 pour `Task`, etc.) crée uniquement les tables dont elle a besoin, jamais toutes d'un coup.

### Testing Standards

Aucun framework de test n'est imposé par l'Architecture à ce stade (non couvert, pas de module Test Architecture invoqué sur ce projet). Pour cette story spécifiquement, une vérification manuelle suffit :
- `npm run build` réussit sans erreur.
- L'application déployée sur Render répond HTTP 200.
- Le service worker s'enregistre (vérifiable via les DevTools navigateur, onglet Application).
- Une table Supabase de test créée manuellement puis supprimée confirme que RLS est bien actif par défaut (tentative de lecture sans policy → refusée).

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Design Paradigm, AD-1, AD-2, AD-4, AD-5, AD-8, Structural Seed]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Fondations & Authentification, Story 1.1]
- [Source: spec-app-gestion-projets.md#3 (buckets Storage séparés documents/audio, révisé Render)]

**Recherche technique (versions vérifiées août 2026) :**
- **Serwist + Next.js App Router (`@serwist/next` 9.5.x)** — Install `npm i @serwist/next && npm i -D serwist`. `next.config.mjs` : wrapper avec `withSerwistInit({ swSrc: "app/sw.ts", swDest: "public/sw.js" })`. SW source dans `app/sw.ts`, compile vers `public/sw.js`. `tsconfig.json` : ajouter `"@serwist/next/typings"` aux types, `"webworker"` au lib, exclure `public/sw.js`. `.gitignore` : `public/sw*`, `public/swe-worker*`. PWA installable : `app/manifest.json` avec `name`, `icons`, `theme_color`, `display: standalone` + `applicationName`/`appleWebApp`/`viewport` dans `metadata` de `app/layout.tsx`. Source : [serwist.pages.dev/docs/next/getting-started](https://serwist.pages.dev/docs/next/getting-started)
- **Render Web Service pour Next.js** — Build `npm run build`, start `next start`. Jamais `output: 'export'` (App Router avec route handlers/Server Actions/middleware exige un process Node = Web Service, pas Static Site). Config dashboard suffit pour un service unique ; `render.yaml` optionnel. Source : [render.com/articles/how-to-deploy-next-js-applications-with-ssr-and-api-routes](https://render.com/articles/how-to-deploy-next-js-applications-with-ssr-and-api-routes)
- **Supabase RLS default-deny** — `alter table "table_name" enable row level security;` puis `create policy "..." on table_name for select using ( (select auth.uid()) = user_id );` (envelopper `auth.uid()` dans `(select ...)` pour la mise en cache du plan de requête). Le dashboard (Authentication → Policies) propose un toggle "Enable RLS on new tables" comme filet de sécurité au niveau projet ; le Security Advisor alerte sur les tables sans RLS (avertissement, pas un blocage de déploiement dur). Source : [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` a d'abord planté avec `typescript-eslint does not support TS 7.0` — TypeScript 7.0.2 (pin AD-8) casse `typescript-eslint`/`eslint-config-next`, incompatibilité connue et trackée (correctif attendu ~TS 7.1, octobre 2026). Le contournement officiel side-by-side (alias npm vers `@typescript/typescript6`) s'est révélé trop fragile avec le hoisting npm de ce projet (l'override ciblait un chemin imbriqué qui n'existait pas réellement, npm hoistant le paquet). Résolu en rétrogradant `typescript` à `6.0.3` (dernière stable 6.x) — build ET lint passent proprement. Voir Completion Notes pour la recommandation de suivi.
- `npm run build` a ensuite planté sur un conflit Turbopack/webpack : Serwist injecte une config webpack alors que Next.js 16 utilise Turbopack par défaut, et les deux ne sont pas encore compatibles (issue ouverte trackée par Serwist). Résolu en forçant webpack via le flag `--webpack` sur les scripts `dev`/`build`.
- `app/sw.ts` a ensuite planté sur deux imports incorrects (`installSerwist` depuis `@serwist/sw` inexistant, `defaultCache` depuis `@serwist/next/browser` — chemin d'export inexistant dans le package réellement installé). Corrigé après vérification directe des `exports` du package installé et de la doc officielle à jour : l'API réelle du 9.5.11 est `new Serwist({...}).addEventListeners()`, avec `defaultCache` exporté depuis `@serwist/next/worker`.
- ESLint lintait par défaut tout le repo, y compris les scripts BMad (`_bmad/`, `.claude/`) et le service worker généré (`public/sw.js`) — ajout d'ignores explicites dans `eslint.config.mjs`.
- Supabase a récemment remplacé les clés `anon`/`service_role` (JWT, dépréciées fin 2026) par de nouvelles clés `publishable`/`secret` (format opaque `sb_publishable_...`/`sb_secret_...`) — vérifié via la doc officielle avant de nommer les variables d'environnement, pour éviter de partir sur une convention déjà obsolète. `data/remote/client.ts` et `.env.example` utilisent `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY`, pas les noms legacy.
- Premier déploiement Render a échoué (`sh: 1: next: not found`, exit 127) : le Build Command custom (`npm run build`) n'enclenche pas `npm install` automatiquement sur Render. Corrigé en changeant le Build Command en `npm install && npm run build`.
- Les buckets Supabase Storage avaient d'abord été créés en `Documents`/`Audio` (majuscule) — renommés en `documents`/`audio` (minuscule) pour matcher exactement ce que le code et l'architecture attendent (Supabase Storage est sensible à la casse).

### Completion Notes List

- ✅ Task 1 (scaffold Next.js/TS + arborescence + README + env) — complet, build et lint vérifiés.
- ✅ Task 2 (Supabase) — complet. Projet dédié `pxdmtnysvglorwchwsmc` créé (région Europe, RLS automatique activé), clés publiable/secrète en place, connectivité vérifiée via l'API REST, buckets `documents`/`audio` créés et confirmés privés via l'API Storage, client scopé + client secret créés (`data/remote/client.ts`, gardés par `server-only`).
- ✅ Task 3 (Dexie + stockage persistant) — complet.
- ✅ Task 4 (Serwist/PWA) — complet ; manifest + service worker générés et vérifiés au build (`/manifest.webmanifest`, `public/sw.js`), et re-vérifiés en production sur Render (HTTP 200 sur les deux).
- ✅ Task 5 (Render) — complet. Web Service Starter (sans mise en veille) créé, connecté à `Strat-Edge/project-note`, build/start corrigés et fonctionnels, variables d'environnement renseignées. URL publique `https://project-note-1ble.onrender.com` vérifiée HTTP 200 (page d'accueil, manifest, service worker).
- **Recommandation de suivi (hors périmètre de cette story)** : le pin TypeScript 7.0.2 (AD-8) est actuellement contourné par une rétrogradation locale à 6.0.3 pour cause d'incompatibilité `typescript-eslint`, à relever vers 7.x une fois le correctif amont disponible (~octobre 2026). Je n'ai pas modifié `ARCHITECTURE-SPINE.md` moi-même (cette story ne touche que les fichiers autorisés) — à faire lors d'une prochaine story ou par une mise à jour dédiée de la spine.
- **Toutes les tâches et critères d'acceptation sont satisfaits.** Aucune régression détectée (build + lint propres, déploiement vérifié en production).

### File List

**Créés :**
- `domain/index.ts`, `data/local/index.ts`, `data/local/db.ts`, `data/remote/index.ts`, `data/remote/client.ts`, `sync/index.ts`, `components/index.ts`
- `.env.example`, `.env.local`
- `app/storage-init.tsx`, `app/sw.ts`, `app/manifest.ts`
- `public/icon-placeholder.svg`

**Modifiés :**
- `package.json`, `package-lock.json` (nom du package, `typescript` 6.0.3, scripts `--webpack`, dépendances `dexie`/`@serwist/next`/`serwist`/`@supabase/supabase-js`/`server-only`)
- `next.config.ts` (wrapper Serwist)
- `tsconfig.json` (types Serwist, lib webworker, exclude sw.js)
- `.gitignore` (exclusions Serwist ; correction : `.env.example` doit rester versionné malgré le pattern générique `.env*`, `.claude/settings.local.json` exclu — config personnelle, pas destinée à être partagée)
- `eslint.config.mjs` (ignores BMad + sw.js)
- `README.md` (remplacé le README générique par la doc projet + règles AD-2)
- `app/layout.tsx` (lang="fr", StorageInit monté, métadonnées PWA)

**Générés par `create-next-app` (non listés individuellement) :** structure App Router standard (`app/page.tsx`, `app/globals.css`, `public/*.svg` par défaut, `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs` initial, `next-env.d.ts`).

## Change Log

- 2026-08-06 : Implémentation initiale (Tasks 1, 3, 4 complets en autonomie ; Tasks 2 et 5 finalisées en binôme avec Guillaume pour les étapes cloud — création du projet Supabase, des buckets, du service Render). Toutes les tâches complètes, tous les AC vérifiés en production. Statut passé à `review`.
- 2026-08-06 : Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 5 patches appliqués (incohérences README/package.json, promesse non gérée, validation env var, ajout robots.ts), 5 items reportés (pré-existants, non bloquants — voir deferred-work.md). Build re-vérifié après patchs. Statut passé à `done`.
