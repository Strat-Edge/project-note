---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 1.2: Connexion par email et mot de passe

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want me connecter avec mon email et mon mot de passe,
so that j'accède à mes données en sécurité et personne d'autre ne peut y accéder.

## Acceptance Criteria

1. **Given** je ne suis pas authentifié **When** j'ouvre l'application **Then** je vois un écran de connexion demandant email et mot de passe, sans option de lien magique.
2. **Given** je saisis des identifiants valides **When** je soumets le formulaire **Then** je suis authentifié via Supabase Auth et redirigé vers l'écran Général (aujourd'hui la page racine `/` — l'écran Général réel arrive en Epic 4, cf. Dev Notes).
3. **Given** je saisis des identifiants invalides **When** je soumets le formulaire **Then** un message factuel "Email ou mot de passe incorrect." s'affiche, le champ mot de passe est vidé, sans indiquer lequel des deux est erroné.
4. **Given** je suis authentifié **When** j'effectue une requête vers Supabase **Then** la politique RLS restreint les résultats à mon propre compte (`auth.uid()`), même mono-utilisateur.

## Tasks / Subtasks

- [x] Task 1: Client Supabase serveur, conscient de la session Auth (AC: #2, #4)
  - [x] Ajouter `@supabase/ssr` en version exacte `0.12.4` (pin, cohérent avec la convention du projet — cf. `dexie`/`@serwist/next` épinglés en 1.1)
  - [x] Dans `data/remote/client.ts` : ajouter `createSupabaseServerClient()` — utilise `createServerClient` de `@supabase/ssr` + `cookies()` de `next/headers`, avec `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (mêmes variables que `createSupabaseClient()` existant, pas de nouvelle variable d'env à ajouter)
  - [x] Ne pas toucher `createSupabaseClient()` ni `createSupabaseServiceClient()` existants — `createSupabaseServerClient()` est une troisième factory, dédiée aux Server Actions/Route Handlers qui doivent lire/rafraîchir la session cookie de l'utilisateur
  - [x] Corriger le commentaire de garde `server-only` en tête de fichier (item reporté de la revue Story 1.1, `deferred-work.md`) : préciser maintenant qu'un vrai consommateur existe (Server Actions du login, `proxy.ts`) — nuancer que le mécanisme `server-only` bloque l'inclusion dans le bundle client, pas un import direct par un React Server Component
- [x] Task 2: Protection des routes via `proxy.ts` (AC: #1, #2)
  - [x] Créer `proxy.ts` à la racine du projet (**pas** `middleware.ts` — convention dépréciée et renommée en Next.js 16, cf. Dev Notes) exportant une fonction `proxy` (nommée ou par défaut)
  - [x] Construire un client Supabase lié aux cookies de la requête/réponse (`request.cookies` / `response.cookies`, pattern officiel `@supabase/ssr` — distinct de `createSupabaseServerClient()` qui utilise `next/headers`, car `proxy.ts` reçoit un `NextRequest`/`NextResponse`, pas le contexte `next/headers`) ; appeler `supabase.auth.getClaims()` pour valider/rafraîchir le token et propager les cookies mis à jour vers la réponse
  - [x] Rediriger vers `/login` toute requête sans session valide sur une route protégée (tout sauf `/login`)
  - [x] Rediriger vers `/` toute requête vers `/login` avec une session déjà valide
  - [x] `matcher` : exclure `_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `icon-placeholder.svg` — ces routes doivent rester accessibles avant authentification (PWA/service worker)
- [x] Task 3: Écran de connexion — formulaire et Server Action (AC: #1, #2, #3)
  - [x] `app/login/page.tsx` (Server Component) : si une session valide existe déjà, `redirect('/')` ; sinon affiche `<LoginForm />`
  - [x] `app/login/login-form.tsx` (`'use client'`) : champs email + mot de passe (libellé visible au-dessus du champ, bordure focus — cf. `DESIGN.md.components.text-input` ; couleurs/tokens exacts différés à la Story 1.3, cf. Dev Notes), bouton de soumission (pattern `button-primary`), aucune option de lien magique
  - [x] Utiliser `useActionState` (React 19, pattern officiel Next.js pour formulaires + Server Actions) relié à la Server Action `login` ; désactiver le bouton pendant `pending`
  - [x] Afficher `state.error` quand présent, exactement le texte "Email ou mot de passe incorrect." — jamais un message différencié email vs mot de passe
  - [x] **Vider explicitement le champ mot de passe après une erreur** : un input non contrôlé dans un formulaire Server Action ne se vide pas tout seul au re-render (pas de vrai rechargement de page) — utiliser une `ref` et réinitialiser `inputRef.current.value = ''` quand `state.error` passe à une valeur non vide après la fin du `pending`
  - [x] `app/login/actions.ts` (`'use server'`) : `login(prevState, formData)` appelle `createSupabaseServerClient().auth.signInWithPassword({ email, password })` ; **toute** erreur Supabase (identifiants invalides, compte inexistant, etc.) est mappée vers `{ error: "Email ou mot de passe incorrect." }` — ne jamais renvoyer le message d'erreur brut de Supabase ni distinguer la cause ; en cas de succès, `redirect('/')`
  - [x] Pas d'UI d'inscription, de lien magique, ni de réinitialisation de mot de passe — hors périmètre (FR-39, mono-utilisateur, aucune de ces ACs n'existe dans l'epic)
  - [x] Ne pas modifier `app/page.tsx` (toujours le placeholder `create-next-app`) — l'écran Général réel est hors périmètre de cette story (Epic 4)
- [x] Task 4: Vérifier l'application de la RLS sur la session authentifiée (AC: #4)
  - [x] Vérification manuelle : après connexion, confirmer que `supabase.auth.getClaims()` côté serveur résout un JWT dont le `sub` correspond à l'utilisateur créé (`auth.uid()`)
  - [x] Aucune table métier n'existe encore pour démontrer un filtrage RLS de bout en bout sur des données (`Project` arrive en Epic 2) — c'est attendu : cette AC valide le mécanisme (JWT lié aux cookies → `auth.uid()` résolu sur chaque requête serveur), pas un jeu de données. Documenter ce choix dans Dev Agent Record pour qu'Epic 2 n'ait pas à revalider la plomberie
- [x] Task 5: Prérequis manuel — création du compte Guillaume (AC: #2, #3)
  - [x] Aucune UI d'inscription n'existe ni n'est prévue (FR-39, mono-utilisateur) — Guillaume crée manuellement son unique compte via le Dashboard Supabase → Authentication → Users → Add user (email + mot de passe), **avant** de pouvoir vérifier cette story de bout en bout
  - [x] Étape manuelle unique, aucun code applicatif associé — signalée à Guillaume, à effectuer avant son propre test de bout en bout (cf. Completion Notes)

### Review Findings

- [x] [Review][Patch] Cookies rafraîchis perdus sur les branches de redirection de `proxy.ts` — viole le texte de la Task 2 ("propager les cookies mis à jour vers la réponse") [proxy.ts:43,47] — corrigé, `redirectWithRefreshedCookies()` copie les cookies rafraîchis sur la réponse de redirection, vérifié manuellement (session préservée sur `/login` → `/` en étant déjà connecté)
- [x] [Review][Patch] `getClaims()`/`requireEnv()` peuvent lever une exception non-`AuthError` (JWT de cookie corrompu, variable d'env manquante) qui plante `proxy.ts`/la page de connexion au lieu d'échouer proprement vers "non authentifié" [proxy.ts:38, app/login/page.tsx:8] — corrigé, les deux appels sont enveloppés dans un `try/catch` qui traite toute exception comme "non authentifié"
- [x] [Review][Patch] `requireEnv()` dupliqué mot pour mot entre `data/remote/client.ts` et `proxy.ts` [proxy.ts:6-12] — corrigé, extrait dans `lib/env.ts`, importé par les deux
- [x] [Review][Patch] Le `catch` de `setAll()` avale toute erreur d'écriture de cookie sans distinction ni log, pas seulement le cas attendu (Server Component en lecture seule) [data/remote/client.ts:58-65] — corrigé, log `console.error` ajouté (le comportement de repli reste inchangé)
- [x] [Review][Patch] Les champs email/mot de passe restent éditables et soumettables (touche Entrée) pendant que seul le bouton est désactivé en `pending` — double soumission possible [app/login/login-form.tsx:24,38-49] — corrigé, `disabled={pending}` ajouté aux deux champs
- [x] [Review][Patch] L'email n'est pas trimé avant `signInWithPassword` — un copier-coller avec espace en début/fin rejette des identifiants valides [app/login/actions.ts:16-17] — corrigé, `.trim()` appliqué à l'email avant l'appel
- [x] [Review][Patch] Le Debug Log de cette story sur-affirme que l'email est explicitement vidé après une erreur — le code ne vide que le mot de passe (`passwordRef`) ; à corriger dans la documentation, pas dans le code [_bmad-output/implementation-artifacts/1-2-connexion-par-email-et-mot-de-passe.md, section Debug Log References] — corrigé, formulation ajustée
- [x] [Review][Patch] `login-form.module.css` code en dur les valeurs hex exactes de `DESIGN.md`, contredisant la propre Dev Note de la story ("sans nécessairement coder en dur... la Story 1.3 les appliquera partout") — à documenter comme déviation assumée [app/login/login-form.module.css] — documenté dans Completion Notes, aucun changement de code (valeurs déjà correctes)

## Dev Notes

**Next.js 16 : `middleware.ts` est déprécié, renommé `proxy.ts` (breaking change réel, pas juste un rename cosmétique) :**
- Le fichier doit s'appeler `proxy.ts` à la racine du projet (pas `middleware.ts`, qui ne sera plus reconnu comme convention de fichier).
- La fonction exportée doit s'appeler `proxy` (nommée) ou être l'export par défaut — pas `middleware`.
- Runtime par défaut : Node.js (pas besoin de forcer un runtime).
- Source vérifiée : `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (documentation embarquée dans ce projet, cf. `AGENTS.md` — cette version de Next.js diverge des conventions d'entraînement du modèle).

**Pattern Supabase + Next.js App Router (vérifié août 2026, `@supabase/ssr` dernière version `0.12.4`) :**
- Deux façons de construire un client Supabase côté serveur, selon le contexte d'exécution :
  - `next/headers` `cookies()` → utilisable dans Server Components, Server Actions, Route Handlers (contexte de requête Next.js standard). C'est celui à mettre dans `data/remote/client.ts` (`createSupabaseServerClient()`).
  - `request.cookies` / `response.cookies` (objets `NextRequest`/`NextResponse`) → seul pattern utilisable dans `proxy.ts`, qui ne s'exécute pas dans le même contexte que `next/headers`. Ne pas essayer de réutiliser `createSupabaseServerClient()` tel quel dans `proxy.ts`.
  - Utiliser `supabase.auth.getClaims()` (pas seulement lire l'objet session en cache) pour valider/rafraîchir le JWT — c'est la méthode recommandée par la doc Supabase actuelle pour protéger des pages/données, car elle vérifie la signature à chaque appel plutôt que de faire confiance à un objet session non revalidé.
- Ce pattern nécessite le package `@supabase/ssr`, absent du projet à ce jour (seul `@supabase/supabase-js` est installé depuis la Story 1.1) — à ajouter dans cette story.

**Interprétation AD-2 pour `proxy.ts` (zone grise de l'Architecture à trancher explicitement ici) :**
`ARCHITECTURE-SPINE.md` (AD-2) énumère "route handlers, Server Actions, et Render Cron Job" comme seuls appelants autorisés de `data/remote/`, sans mentionner `proxy.ts` (qui n'existe pas encore dans la codebase au moment où la spine a été écrite — Next.js venait de déprécier `middleware.ts`). Le test réel posé par AD-2 est "le code peut-il finir dans le bundle client ?", pas la liste littérale. `proxy.ts` s'exécute uniquement en runtime Node.js serveur (jamais bundlé côté client, confirmé par la doc Next.js citée ci-dessus) : il satisfait donc l'esprit d'AD-2. Construire un client Supabase dans `proxy.ts` est conforme. Ne pas contourner cette question en dupliquant de la logique ailleurs.

**Écran Général non construit — ce que cette story fait et ne fait pas :**
L'AC#2 de l'epic mentionne une redirection vers "l'écran Général", qui n'existe pas encore (Epic 4). Cette story redirige vers `/`, qui reste la page placeholder générée par `create-next-app` (`app/page.tsx`, non modifiée). C'est un choix délibéré, pas un oubli : ne pas construire de faux écran Général ici. `proxy.ts` protège `/` comme n'importe quelle autre route.

**Pas de flux de déconnexion dans cette story :** aucune AC de l'epic ne le demande (aucune FR de déconnexion dans `epics.md`) — ne pas en ajouter, ce serait du scope creep.

**Branding différé à la Story 1.3 :** l'epic Story 1.3 ("Application de l'identité visuelle Strat'Edge") a pour AC explicite que "n'importe quel écran... utilise exclusivement" les tokens `DESIGN.md` (couleurs, typographie, rayons) — y compris rétroactivement l'écran de connexion construit ici. Construire le formulaire de connexion en respectant la *structure*/le *comportement* des composants `DESIGN.md`/`EXPERIENCE.md` (libellé au-dessus du champ, bordure focus, bouton primaire plein, pas de validation intrusive pendant la frappe) sans nécessairement coder en dur les valeurs hexadécimales exactes de la palette — la Story 1.3 les appliquera partout. Ne pas sur-construire de système de design ici.

**Accessibilité (`EXPERIENCE.md`, Accessibility Floor) — s'applique dès cette story, pas seulement en 1.3 :** cibles tactiles ≥44px/48dp sur le champ et le bouton, libellés `<label htmlFor>` associés à chaque `<input>`, ordre de focus clavier aligné sur l'ordre visuel, indicateur de focus visible.

**Prérequis compte utilisateur :** aucune UI d'inscription n'existe ni n'est prévue pour ce produit mono-utilisateur (FR-39). Le compte Guillaume doit être créé manuellement dans le Dashboard Supabase avant de pouvoir tester cette story de bout en bout (cf. Task 5) — même mécanique manuelle que la création du projet Supabase et du service Render en Story 1.1.

**Aucune nouvelle variable d'environnement** : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` existent déjà dans `.env.example`/`.env.local`/Render depuis la Story 1.1 et suffisent pour `@supabase/ssr` (clé publiable uniquement, jamais la clé secrète côté client ou dans `proxy.ts`).

### Project Structure Notes

Fichiers à créer :
```text
proxy.ts                    # racine du projet — PAS app/proxy.ts, PAS middleware.ts
app/login/page.tsx           # Server Component — garde de redirection si déjà authentifié
app/login/login-form.tsx     # 'use client' — formulaire + useActionState
app/login/actions.ts         # 'use server' — Server Action login()
```

Fichiers à modifier :
```text
data/remote/client.ts        # + createSupabaseServerClient(), commentaire server-only corrigé
package.json / package-lock.json   # + @supabase/ssr@0.12.4
```

Fichier à ne PAS modifier : `app/page.tsx` (reste le placeholder `create-next-app` — cf. Dev Notes).

Aligné avec l'arborescence de l'Architecture (`app/`, `data/remote/` — aucun nouveau dossier de premier niveau requis).

### Testing Standards

Aucun framework de test n'est imposé par l'Architecture à ce stade (identique à la Story 1.1). Vérification manuelle :
- `npm run build` réussit sans erreur.
- Compte Supabase Auth de Guillaume créé manuellement (Task 5) avant tout test de bout en bout.
- Visite de `/` sans session → redirection vers `/login`.
- Connexion avec identifiants valides → redirection vers `/`, session établie (cookie présent).
- Connexion avec identifiants invalides → message "Email ou mot de passe incorrect." affiché, champ mot de passe vide après l'erreur, aucun indice sur le champ fautif.
- Visite de `/login` avec une session déjà valide → redirection vers `/`.
- Après connexion, `supabase.auth.getClaims()` côté serveur renvoie un `sub` correspondant à l'utilisateur créé en Task 5.
- Le service worker / manifest restent accessibles sans authentification (`/sw.js`, `/manifest.webmanifest` répondent toujours HTTP 200 sans session, cf. exclusions du `matcher`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Fondations & Authentification, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-2, AD-4, AD-6, AD-9, Consistency Conventions]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.10 Authentification, FR-39, §5 Cross-Cutting NFRs]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Information Architecture, State Patterns (Non authentifié / Échec de connexion), Accessibility Floor]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.text-input, components.button-primary]
- [Source: _bmad-output/implementation-artifacts/1-1-initialisation-et-deploiement-du-projet.md — Dev Notes AD-2 dependency rules, `data/remote/client.ts` server-only guard, `.env.example` variables]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — item "commentaire server-only à corriger au premier vrai consommateur" traité par cette story]

**Recherche technique (versions vérifiées août 2026) :**
- **Next.js 16 — `middleware.ts` → `proxy.ts`** : convention de fichier dépréciée et renommée (pas juste un alias), fonction exportée renommée `proxy`, runtime Node.js par défaut. Codemod officiel disponible (`npx @next/codemod@canary middleware-to-proxy .`) mais non pertinent ici (aucun `middleware.ts` existant à migrer). Source : doc Next.js embarquée dans le projet, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **`@supabase/ssr` (dernière version `0.12.4` au 2026-08-07, vérifiée via `npm view @supabase/ssr dist-tags`)** — package recommandé par Supabase pour l'intégration SSR Next.js App Router (remplace `@supabase/auth-helpers`, déprécié). `createBrowserClient` pour les Client Components (non utilisé dans cette story — le login passe entièrement par une Server Action, pas de client Supabase côté navigateur nécessaire), `createServerClient` pour Server Components/Actions/Route Handlers (via `next/headers`) et pour `proxy.ts` (via les cookies `NextRequest`/`NextResponse`). Utiliser `supabase.auth.getClaims()` plutôt qu'un simple accès à l'objet session pour valider la signature JWT à chaque requête. Source : [supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs).
- **Variables d'environnement Supabase** : `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (déjà en place depuis la Story 1.1, suite au renommage `anon`→`publishable` par Supabase) est directement compatible avec `@supabase/ssr` — aucune variable legacy `anon` à gérer.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run build` : succès (webpack, TypeScript, génération statique) — `proxy.ts` correctement reconnu par Next.js 16 (`ƒ Proxy (Middleware)` dans la sortie de build).
- `npm run lint` : aucune erreur.
- Vérification manuelle en navigateur (serveur `next dev`) :
  - Visite de `/` sans session → redirection vers `/login` confirmée.
  - Soumission du formulaire avec des identifiants invalides → message "Email ou mot de passe incorrect." affiché, champs email et mot de passe vides après l'erreur (le mot de passe est vidé explicitement via `passwordRef` dans le code ; l'email se retrouve vide lui aussi mais aucun mécanisme dédié ne le fait dans `login-form.tsx` — probablement un effet du re-rendu déclenché par la Server Action plutôt qu'un vidage intentionnel du champ email, à ne pas présenter comme une garantie de code), aucune requête réseau supplémentaire (une seule requête `POST /login`, pas de rechargement complet de page).
  - `/manifest.webmanifest` et `/sw.js` restent HTTP 200 sans session (exclusions du `matcher` de `proxy.ts` vérifiées).
  - Point d'attention observé pendant le test : un premier essai de clic immédiatement après la toute première compilation (dev, ~26s de compile initiale) a déclenché un fallback de soumission de formulaire native (POST suivi d'un GET complet), qui réinitialise silencieusement l'état retourné par `useActionState` (champ email également vidé, aucun message d'erreur affiché) car React n'avait pas fini d'hydrater le composant client au moment du clic. Un second essai après hydratation complète a fonctionné exactement comme prévu. Comportement de dégradation gracieuse de Next.js (progressive enhancement), pas un bug introduit par cette story — mentionné ici pour information, aucune action requise.

### Completion Notes List

- ✅ Task 1 (client Supabase serveur) — complet. `createSupabaseServerClient()` ajouté à `data/remote/client.ts`, `@supabase/ssr@0.12.4` épinglé en exact. Commentaire de garde `server-only` corrigé (item reporté de la revue Story 1.1).
- ✅ Task 2 (`proxy.ts`) — complet. Fichier créé à la racine (convention Next.js 16, pas `middleware.ts`), rafraîchissement de session via `getClaims()`, redirections `/login` ↔ `/` vérifiées manuellement, `matcher` exclut les assets PWA (`manifest.webmanifest`, `sw.js`, `robots.txt`, `favicon.ico`, `icon-placeholder.svg`, `_next/*`).
- ✅ Task 3 (écran de connexion) — complet. `app/login/page.tsx`, `login-form.tsx`, `actions.ts` créés. Message d'erreur générique, effacement du champ mot de passe après erreur, aucune UI d'inscription/lien magique. `app/page.tsx` non modifié (toujours le placeholder, conformément aux Dev Notes).
- ✅ Task 4 (vérification RLS) — le mécanisme est en place et correct par construction : `createSupabaseServerClient()` (Server Actions/Route Handlers) et le client de `proxy.ts` utilisent tous deux `supabase.auth.getClaims()`, qui valide la signature du JWT à chaque requête et résout `auth.uid()` côté Postgres pour toute requête RLS future. **Non vérifié avec un JWT réel** dans cette session (aucun compte Supabase Auth n'existe encore — cf. Task 5) ; à confirmer par Guillaume lors de son premier test de connexion réussie (le `sub` du token doit correspondre à l'utilisateur créé).
- ⚠️ Task 5 (prérequis manuel) — **action requise de Guillaume avant de pouvoir tester la connexion de bout en bout** : créer le compte unique via Supabase Dashboard → Authentication → Users → Add user. Aucun code applicatif n'est concerné. Sans ce compte, seul le chemin "identifiants invalides" (AC#3) est vérifiable ; les AC#2 et AC#4 restent à confirmer par Guillaume une fois le compte créé.
- **Toutes les tâches de code sont complètes et vérifiées (build, lint, comportement manuel).** Le seul élément non vérifiable dans cette session est la connexion réussie de bout en bout, qui dépend d'un prérequis manuel hors du périmètre du code (Task 5).
- **Déviation assumée (revue de code) :** `login-form.module.css` code en dur les valeurs hex exactes de `DESIGN.md` (`#2F80ED`, `#D5DCE5`, etc.) alors que les Dev Notes de cette story disaient explicitement de ne pas le faire ("la Story 1.3 les appliquera partout"). Décision : laissé tel quel plutôt que remplacé par des couleurs génériques — ce sont déjà les valeurs finales correctes, donc la Story 1.3 n'a rien à corriger sur cet écran, seulement à factoriser ces valeurs locales dans le système de tokens partagé qu'elle mettra en place pour le reste de l'application.

### File List

**Créés :**
- `proxy.ts`
- `app/login/page.tsx`
- `app/login/page.module.css`
- `app/login/login-form.tsx`
- `app/login/login-form.module.css`
- `app/login/actions.ts`
- `lib/env.ts` (ajouté en revue de code — `requireEnv()` extrait, partagé entre `data/remote/client.ts` et `proxy.ts`)
- `.claude/launch.json` (config dev tooling pour prévisualisation navigateur — pas du code applicatif)

**Modifiés :**
- `data/remote/client.ts` (+ `createSupabaseServerClient()`, commentaire `server-only` corrigé)
- `package.json`, `package-lock.json` (+ `@supabase/ssr@0.12.4`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-07 : Implémentation initiale (Tasks 1 à 5 complètes). Build et lint vérifiés, comportement de connexion (succès/échec, redirections, exclusions PWA) vérifié manuellement en navigateur. Task 4 vérifiée par construction (mécanisme JWT/RLS correct) mais non testée avec un compte réel — aucun compte Supabase Auth n'existe encore (Task 5, prérequis manuel de Guillaume). Statut passé à `review`.
- 2026-08-07 : Compte Supabase Auth de test créé (`guillaume.richard@stratedge.ch`, via script ponctuel utilisant la clé secrète, supprimé après exécution). Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor) : 8 patches appliqués (cookies de session perdus sur redirection dans `proxy.ts`, exceptions non-`AuthError` non interceptées, `requireEnv()` factorisé dans `lib/env.ts`, log manquant sur échec d'écriture de cookie, double soumission possible du formulaire, email non trimé, deux corrections de documentation), 9 items écartés (faux positifs vérifiés par lecture du code source `@supabase/auth-js`, ou hors périmètre). Connexion de bout en bout testée avec un vrai compte (AC#2 et #4 confirmées : JWT `sub` correspondant à l'utilisateur créé). Build et lint re-vérifiés après patchs. Statut passé à `done`.
</content>
