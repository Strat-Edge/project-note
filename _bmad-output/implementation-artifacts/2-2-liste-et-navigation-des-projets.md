---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 2.2: Liste et navigation des projets

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want consulter la liste de mes projets et naviguer entre Général et Projets,
so that je retrouve facilement l'ensemble de mon travail organisé.

## Acceptance Criteria

1. **Given** plusieurs projets actifs et archivés existent **When** j'ouvre l'écran Projets **Then** les projets actifs s'affichent en premier, les archivés regroupés dans une section repliée par défaut.
2. **Given** je suis sur n'importe quel écran **When** je tape sur le switcher segmenté en haut **Then** je bascule entre "Général" et "Projets" sans perdre mon contexte.
3. **Given** un projet actif **When** il s'affiche dans la liste **Then** son nom et sa couleur sont visibles avec un indicateur de statut.

## Tasks / Subtasks

- [x] Task 1: Ajouter la règle de regroupement actifs/archivés dans `domain/` (AC: #1, #3)
  - [x] Dans `domain/project.ts`, ajouter le type `ProjectsByStatus = { active: Project[]; archived: Project[] }` et la fonction pure `groupProjectsByStatus(projects: readonly Project[]): ProjectsByStatus`.
  - [x] Logique : trier une copie du tableau par `createdAt` décroissant (le plus récemment créé en tête — aucun ordre n'est imposé par le PRD/l'UX à l'intérieur d'un groupe, cf. Dev Notes), puis répartir en deux tableaux via `status === "active"` / `status === "archived"`. Fonction pure, ne dépend d'aucune autre couche (cf. AD-2) — reçoit directement le tableau de `Project`, n'appelle jamais Dexie.
  - [x] Mettre à jour `domain/index.ts` pour exporter `groupProjectsByStatus` et le type `ProjectsByStatus` (même pattern d'export nommé que l'existant).

- [x] Task 2: Construire le composant Switcher segmenté (niveau 1 : Général/Projets) et l'intégrer au layout (AC: #2)
  - [x] Créer `components/switcher.tsx` (`"use client"`) : composant de navigation utilisant `usePathname()` (`next/navigation`) et `Link` (`next/link`) — PAS de `useState`/`onChange` générique (cf. Dev Notes, décision de portée sur la réutilisabilité). Deux entrées fixes `[{ href: "/", label: "Général" }, { href: "/projects", label: "Projets" }]`. Rendu : `<nav aria-label="Navigation principale">` contenant les deux `<Link>`, `aria-current="page"` sur le lien actif (actif = `pathname === "/"` pour Général, `pathname.startsWith("/projects")` pour Projets). Le composant retourne `null` si `pathname === "/login"` (absent sur Connexion, cf. `EXPERIENCE.md`).
  - [x] Créer `components/switcher.module.css` en suivant `DESIGN.md.components.segmented-control` : bloc unique (`.track`) fond `var(--color-bg-alt)` (clair) / `var(--color-surface-dark)` (sombre, via `@media (prefers-color-scheme: dark)` local — ces tokens ne sont pas aliasés de façon réactive dans `globals.css`, cf. Dev Notes de la Story 2.1 sur les tokens bruts), rayon `var(--radius-xl)`, padding `var(--space-1)`. Chaque item (`.item`) : rayon `var(--radius-lg)`, cible tactile min 44px, texte `var(--color-muted)`/`var(--color-muted-dark)` inactif ; item actif (`[data-active="true"]` ou via `:has()`/attribut, au choix de l'implémentation — le plus simple est un attribut `data-active` posé côté composant) fond `var(--color-primary)`, texte `var(--color-on-primary)`. Responsive (UX-DR22) : pleine largeur mobile (déjà le cas par défaut), centré avec `max-width` (ex. 420px) et `margin: 0 auto` à partir de `768px` (`@media (min-width: 768px)`).
  - [x] Dans `app/layout.tsx`, importer `Switcher` depuis `@/components/switcher` et le rendre juste après `<Header />` et avant `{children}`. Le layout reste un Server Component ; `Switcher` est un composant client importé normalement (même pattern que `StorageInit`/`Header`).

- [x] Task 3: Remplacer la liste brute de vérification de la Story 2.1 par la vraie liste groupée (AC: #1, #3)
  - [x] Dans `app/projects/projects-screen.tsx` : importer `groupProjectsByStatus` depuis `@/domain`, calculer `{ active, archived } = groupProjectsByStatus(projects)` à chaque rendu (pas de nouvel état — `projects` est déjà rechargé après création, cf. Story 2.1).
  - [x] Remplacer le bloc `<ul className={styles.rawList}>...</ul>` par : (a) un état vide `"Aucun projet pour l'instant. Cliquez sur « Nouveau projet » pour en créer un."` si `active.length === 0 && archived.length === 0 && !loadError` (texte adapté du pattern `EXPERIENCE.md` § State Patterns "Aucun projet" — référence "+" remplacée par le bouton réellement existant, cf. Dev Notes) ; (b) si `active.length > 0`, une `<ul>` de cartes actives (pas de section/titre visible pour ce groupe — seuls les archivés ont un en-tête, cf. AC#1 "les archivés regroupés dans une section... les actifs en premier" ne demande pas de titre "Actifs") ; (c) si `archived.length > 0`, un `<details className={styles.archivedSection}>` (fermé par défaut — ne PAS ajouter l'attribut `open`) avec `<summary>Archivés ({archived.length})</summary>` contenant une `<ul>` de cartes archivées. `<details>/<summary>` natif : pas de gestion d'état/ARIA custom nécessaire, clavier et lecteur d'écran gérés nativement (cf. Dev Notes).
  - [x] Créer une sous-fonction (dans le même fichier, pas un nouveau composant partagé — trop tôt pour l'extraire, cf. philosophie anti-sur-abstraction du projet) `ProjectRow({ project }: { project: Project })` rendant une `<li className={styles.projectCard}>` : pastille de couleur (`<span aria-hidden="true">`, `background-color: var(--color-${project.color})`, même mécanique que `swatchChip` du formulaire), nom (`<span className={styles.projectName}>`), et une puce de statut (`<span className={styles.statusPill} data-status={project.status}>`) affichant "Actif" ou "Archivé" (`Record<Project["status"], string>`, satisfait AC#3 "indicateur de statut" — affichée sur CHAQUE carte, actives comprises, pas seulement archivées).
  - [x] Mettre à jour `app/projects/projects-screen.module.css` : supprimer `.rawList` (remplacé), ajouter `.empty`, `.projectList` (flex column, `gap: var(--space-card-gap)`), `.projectCard` (réutilise les valeurs de `DESIGN.md.components.task-card` — bordure `var(--color-border)`, rayon `var(--radius-lg)`, fond `var(--color-surface)`, ombre `0 4px 14px rgba(0,0,0,.08)` clair / `.35` sombre via media query locale — aucun token `project-card` dédié n'existe dans `DESIGN.md`, cf. Dev Notes), `.projectSwatch` (20×20px, `var(--radius-sm)`), `.projectName`, `.statusPill` (fond `var(--color-bg-alt)`/`var(--color-surface-2-dark)`, texte `var(--color-muted)`/`var(--color-muted-dark)`, `var(--radius-sm)`), `.archivedSection`/`.archivedSummary` (cible tactile ≥44px sur le `<summary>`).

- [x] Task 4: Vérification manuelle de bout en bout (AC: #1, #2, #3)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Se connecter, confirmer que le switcher "Général | Projets" est visible sous le header sur `/` et sur `/projects`, et absent sur `/login` (déconnecter ou visiter directement l'URL si la session le permet, sinon vérifier par lecture de code que `pathname === "/login"` retourne `null`).
  - [x] Taper "Projets" depuis "Général" puis "Général" depuis "Projets" plusieurs fois : le contenu bascule sans rechargement complet de page (navigation Next.js client-side), le header reste stable, le segment actif (fond plein primaire) suit la page courante à chaque bascule.
  - [x] Créer 2-3 projets (réutilise le formulaire existant de la Story 2.1) : chacun apparaît dans la liste active avec sa pastille de couleur correcte, son nom, et une puce "Actif" ; le plus récemment créé apparaît en tête de liste.
  - [x] Aucune section "Archivés" ne doit apparaître tant qu'aucun projet n'a le statut `archived`.
  - [x] Via DevTools (Application → IndexedDB → `project-note` → `projects`), éditer manuellement le champ `status` d'un projet existant à `"archived"` (aucune UI d'archivage n'existe avant la Story 2.3 — cf. Dev Notes) puis recharger `/projects` : le projet disparaît de la liste active et apparaît sous "Archivés (1)", repliée par défaut ; taper sur le résumé révèle la carte avec une puce "Archivé".
  - [x] Vérifier au clavier : le `<summary>` "Archivés" est atteignable par Tab et s'ouvre/se ferme avec Entrée/Espace ; le switcher est atteignable par Tab, chaque lien a un état `aria-current="page"` visible dans l'inspecteur d'accessibilité quand actif.
  - [x] Aucune régression sur le formulaire de création existant (Story 2.1) : validation nom vide, rotation de couleur, sélection manuelle de couleur toujours fonctionnels après le remplacement de la liste.

### Review Findings

- [x] [Review][Patch] Un échec du rechargement post-création (`listProjects()`) après une création réussie est affiché comme un échec de création, risquant une création en double si l'utilisateur retente. Corrigé — la création et le rechargement post-création ont désormais des blocs `try/catch` séparés ; le formulaire se referme dès que la création réussit, indépendamment du résultat du rechargement (qui retombe sur le bandeau `loadError` existant en cas d'échec). [app/projects/projects-screen.tsx (handleSubmit)]
- [x] [Review][Patch] `openForm()` n'a aucune gestion d'erreur autour de son `listProjects()` — un rejet rend le bouton "Nouveau projet" silencieusement inopérant (rejet de promesse non géré). Corrigé — `openForm` enveloppe désormais son appel dans `try/catch`, bascule `loadError` sur échec. [app/projects/projects-screen.tsx (openForm)]
- [x] [Review][Patch] `loadError` ne se réinitialise jamais — si le chargement initial échoue puis qu'un chargement ultérieur réussit (ouverture du formulaire, création), le message "Impossible de charger la liste des projets." reste affiché en permanence sous une liste pourtant à jour. Corrigé — `loadError` est explicitement remis à `false` sur chacun des trois chemins de chargement réussi (montage, `openForm`, post-création). [app/projects/projects-screen.tsx]
- [x] [Review][Patch] Aucun état de chargement distinct : le message "Aucun projet pour l'instant." peut s'afficher brièvement avant la résolution du chargement initial, même quand des projets existent. Corrigé — nouvel état `loading` (initialisé à `true`, remis à `false` dans le `finally` du chargement de montage), condition de l'état vide étendue avec `!loading`. [app/projects/projects-screen.tsx]
- [x] [Review][Patch] Le test d'onglet actif du Switcher (`pathname.startsWith(tab.href)`) n'est pas borné — matcherait aussi une route hypothétique partageant le même préfixe (ex. `/projects-quelquechose`). Corrigé — `pathname === tab.href || pathname.startsWith(\`${tab.href}/\`)`. [components/switcher.tsx]
- [x] [Review][Patch] Le texte de l'état vide de l'écran Projets ("Cliquez sur") diverge du texte spécifié dans la Task 3 de cette story ("Touchez") — déviation intentionnelle demandée en direct par Guillaume après la création de la story ; la story documentaire doit être resynchronisée avec le code livré. Corrigé — le texte de la Task 3 mis à jour pour refléter le texte réellement livré. [2-2-liste-et-navigation-des-projets.md (Task 3), app/projects/projects-screen.tsx]
- [x] [Review][Defer] La pastille de couleur présélectionnée à l'ouverture du formulaire peut devenir obsolète sous création concurrente (deux onglets/appareils créant un projet presque simultanément) — deferred, pre-existing. Hérité tel quel de la Story 2.1, non modifié par cette story. [app/projects/projects-screen.tsx (openForm)]
- [x] [Review][Defer] Les pastilles de couleur utilisent `aria-pressed` (sémantique bouton bascule) plutôt qu'une sémantique de groupe radio pour un choix mutuellement exclusif — deferred, pre-existing. Hérité tel quel de la Story 2.1, non modifié par cette story. [app/projects/projects-screen.tsx (swatches)]
- [x] [Review][Defer] `groupProjectsByStatus` exclut silencieusement tout projet dont le `status` ne correspond à aucune des deux valeurs connues (`active`/`archived`) — deferred, pre-existing risk. Actuellement inatteignable (typage strict, tous les points d'écriture actuels garantissent une valeur valide), mais deviendrait un point de perte silencieuse si une future migration de schéma ou une modification manuelle des données introduisait une valeur inattendue. [domain/project.ts (groupProjectsByStatus)]

## Dev Notes

**Portée du switcher — composant routé, pas encore générique :** `DESIGN.md`/`UX-DR4` décrivent le Switcher comme "réutilisé à deux niveaux : navigation Général/Projets, et onglets Tâches/Documents/Notes" (ce dernier niveau appartient à la Story 3.3, hors périmètre ici). Cette story construit uniquement la version niveau 1, basée sur de vrais liens Next.js (`<Link>`/`usePathname`) — pas un composant générique `items`/`value`/`onChange` piloté par état, car le niveau 2 (onglets Tâches/Documents/Notes) sera très probablement piloté par état local à l'intérieur d'une seule route "Vue projet", pas par des routes distinctes, ce qui appelle une interaction différente (boutons, pas des ancres). Construire l'abstraction commune maintenant serait spéculatif (un seul cas d'usage réel existe aujourd'hui) — extraire une base partagée quand la Story 3.3 arrive avec son vrai second besoin, pas avant. Ne pas anticiper.

**Écran "Général" (`app/page.tsx`) inchangé — hors périmètre :** cette story câble uniquement la navigation vers `/`, pas son contenu. Le placeholder "Connecté." reste tel quel ; le vrai calendrier général est le périmètre de l'Epic 4. Ne pas construire de calendrier ici.

**Test de la section "Archivés" sans UI d'archivage :** la Story 2.3 (Archivage et désarchivage) n'est pas encore implémentée — aucun bouton n'existe pour faire passer un projet à `status: "archived"`. Pour vérifier l'AC#1 (regroupement des archivés), éditer manuellement le champ `status` d'un enregistrement existant via DevTools → IndexedDB, même technique que la vérification de persistance de la Story 2.1. Ce n'est pas un contournement du produit, seulement de la vérification manuelle en l'absence de l'UI qui viendra ensuite.

**Ordre au sein de chaque groupe (actifs / archivés) :** ni le PRD ni `DESIGN.md`/`EXPERIENCE.md` n'imposent un ordre précis à l'intérieur d'un groupe de statut identique — seul "actifs en premier, archivés regroupés" (FR-7) est spécifié. Choix pragmatique retenu : le plus récemment créé (`createdAt` décroissant) en tête — confirme visuellement qu'une création vient de réussir, cohérent avec le flux de vérification manuelle de la Story 2.1. Ajustable sans re-story si Guillaume préfère un autre ordre (alphabétique, etc.).

**État vide adapté — référence "+" remplacée :** `EXPERIENCE.md` § State Patterns propose "Aucun projet pour l'instant." + invite à créer via "+" pour l'état vide de l'écran Projets. Le FAB "+" n'existe pas avant l'Epic 3 (flux de capture universel) — la Story 2.1 a déjà établi que la création de projet passe par un bouton "Nouveau projet" explicite sur cet écran, pas par un FAB. Le message d'état vide de cette story référence donc ce bouton réel plutôt que le "+" qui n'existe pas encore, même logique de décision de portée que la Story 2.1 (formulaire inline vs modale).

**Carte de projet — réutilise les tokens `task-card` de `DESIGN.md`, faute de token dédié :** `DESIGN.md.components` ne définit pas de token `project-card` — le pattern visuel le plus proche est `task-card` (bg/border/rayon `lg`/ombre douce), déjà le langage visuel générique "carte de liste" de l'app. Le réutiliser ici est cohérent avec l'intention de `DESIGN.md` (mêmes valeurs que les futures cartes de tâche/note/document) plutôt que d'inventer un nouveau pattern.

**`<details>`/`<summary>` natif pour la section repliable — pas de state React custom :** couvre nativement le focus clavier, l'activation Entrée/Espace, et l'annonce de l'état ouvert/fermé aux lecteurs d'écran (`UX-DR21`), sans ARIA ni JS supplémentaire. Cohérent avec `EXPERIENCE.md` § Interaction Primitives ("Tap pour agir — pas de geste caché") et l'absence de transition à désactiver pour Reduce Motion (aucune animation ajoutée).

**"Sans perdre mon contexte" (AC#2) — interprétation :** signifie que la coquille applicative (header, session authentifiée, switcher) reste stable pendant la navigation — assuré par `next/link` (navigation client-side, pas de rechargement complet) et par le fait que `Header`/`Switcher` vivent dans `app/layout.tsx`, donc ne démontent/remontent pas entre `/` et `/projects`. Cela ne signifie PAS préserver un état de formulaire non sauvegardé entre les deux écrans (ce sont deux routes distinctes avec des composants différents) — `ProjectsScreen` se remonte normalement en revenant sur `/projects` (formulaire refermé, section "Archivés" repliée par défaut), ce qui est le comportement attendu, pas une régression à corriger.

**Tokens bruts sombres, pas d'alias réactif :** comme noté dans `app/globals.css` (commentaire en tête de fichier) et dans les Dev Notes de la Story 2.1, seuls `--color-bg/--color-surface/--color-border/--color-text/--color-muted/--color-heading` sont aliasés de façon réactive via `@media (prefers-color-scheme: dark)`. `--color-bg-alt`, `--color-surface-dark`, `--color-surface-2-dark`, `--color-muted-dark` restent des tokens bruts — chaque nouveau composant (ici `switcher.module.css` et les nouvelles classes de `projects-screen.module.css`) déclare sa propre bascule sombre locale, exactement comme `header.module.css`/`projects-screen.module.css` existants ne l'ont pas encore eu besoin de faire mais comme le prévoit le commentaire d'en-tête de `globals.css` ("chaque composant futur choisit sa paire lui-même").

### Project Structure Notes

Fichiers à créer :
```text
components/switcher.tsx
components/switcher.module.css
```

Fichiers à modifier :
```text
app/layout.tsx                        # rendu de <Switcher /> après <Header />
app/projects/projects-screen.tsx      # remplace la liste brute par la liste groupée + ProjectRow
app/projects/projects-screen.module.css  # nouvelles classes carte/pastille/statut/disclosure, .rawList supprimée
domain/project.ts                     # + groupProjectsByStatus, + type ProjectsByStatus
domain/index.ts                       # export des deux nouveaux symboles
```

`components/index.ts` reste vide (précédent établi Story 1.3/2.1 : import direct via `@/components/switcher`, pas de barrel). Aucun changement à `data/local/`, `data/remote/`, `sync/`, `proxy.ts` (toutes les routes concernées sont déjà protégées, cf. Story 2.1) ni à `app/page.tsx` (cf. Dev Notes).

### Testing Standards

Aucun framework de test automatisé n'est imposé par l'Architecture (identique aux Stories 1.1 à 2.1). Vérification manuelle exhaustive en Task 4, couvrant les 3 AC : regroupement actifs/archivés avec bascule manuelle du statut via DevTools (AC#1), navigation switcher bidirectionnelle avec persistance du header/session (AC#2), affichage nom/couleur/statut sur chaque carte (AC#3), plus non-régression du formulaire de création de la Story 2.1 et vérification clavier/accessibilité de base (`<summary>`, `aria-current`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Gestion des projets, Story 2.2]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.2 Gestion des projets (FR-7), §4.6 (pattern de carte/indicateurs, hors périmètre onglets), §6 Non-Goals]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter `components.segmented-control` (track/item, actif/inactif), `components.task-card` (réutilisé pour la carte projet), `components.meta-pill`; sections Components, Colors, Shapes]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Information Architecture (routes Général/Projets, switcher absent sur Connexion), §Component Patterns (ligne "Switcher segmenté (niveau 1)"), §State Patterns (ligne "Aucun projet", ligne "Projet archivé"), §Accessibility Floor (cibles ≥44px, focus clavier, lecteur d'écran), §Responsive & Platform (switcher pleine largeur mobile/centré desktop)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-2 (direction de dépendance, components/ ne dépend que de domain/), Capability → Architecture Map (4.2 Gestion des projets), Consistency Conventions]
- [Source: _bmad-output/implementation-artifacts/2-1-creation-dun-projet.md — Dev Notes ("Portée de l'écran Projets" : cette story remplace explicitement la liste brute), File List, Review Findings (patterns de gestion d'erreur/accessibilité déjà établis à respecter), Change Log]
- [Source: app/projects/projects-screen.tsx, app/projects/projects-screen.module.css — code existant de la Story 2.1 à étendre, pas à réécrire (formulaire de création inchangé)]
- [Source: app/layout.tsx, components/header.tsx, app/globals.css — patterns d'intégration composant/layout et tokens bruts clair/sombre existants]
- [Source: app/login/page.tsx, proxy.ts — confirmation que toutes les routes concernées (`/`, `/projects`) sont déjà protégées par authentification, aucun changement requis]

**Recherche technique (vérifiée, aucune nouvelle dépendance) :**
- `usePathname` (`next/navigation`) et `<Link>` (`next/link`) — API stables de Next.js 16.3.0 App Router, déjà la version en dépendance ; aucune nouvelle installation nécessaire.
- `<details>`/`<summary>` — élément HTML natif, support universel dans tous les navigateurs evergreen cibles (desktop et mobile), aucune dépendance ni polyfill.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run build`/`npm run lint` : propres du premier coup, aucune itération nécessaire.
- Vérification manuelle via `preview_start`/Browser pane sur un serveur `next dev` déjà actif (session authentifiée existante, mot de passe jamais saisi par l'agent — règle de sécurité) :
  - Switcher visible sur `/` et `/projects`, `aria-current="page"` et fond primaire pleins confirmés par inspection des styles calculés sur le segment actif à chaque bascule (`Général` ↔ `Projets`, plusieurs allers-retours) ; navigation client-side confirmée (pas de rechargement complet, header stable).
  - Visite directe de `/login` en session authentifiée redirige vers `/` (comportement de `proxy.ts`, inchangé) — impossible d'observer visuellement l'absence du switcher sur Connexion sans se déconnecter (mot de passe non ressaisi par l'agent) ; vérifié à la place par lecture du code (`components/switcher.tsx` : `if (pathname === "/login") return null;`), conforme à la clause de repli prévue par la Task 4.
  - Liste `/projects` (10 projets préexistants des Stories précédentes, tous actifs) : tri par `createdAt` décroissant confirmé (le plus récent en tête), pastille de couleur et puce "Actif" affichées sur chaque carte.
  - Regroupement archivés vérifié en éditant manuellement `status: "archived"` d'un projet existant via `indexedDB` (object store `projects`), puis rechargement de `/projects` : le projet quitte la liste active et apparaît sous "Archivés (1)", `<details open>` confirmé `false` par défaut puis `true` après clic sur le résumé (vérifié via `element.open` en JS). Statut revert à `"active"` après vérification pour ne pas laisser les données de test de Guillaume dans un état modifié.
  - Non-régression du formulaire de création (Story 2.1) : création d'un nouveau projet ("Projet test 11 (story 2.2)") réussie, apparaît immédiatement en tête de liste active avec puce "Actif" — aucune régression sur la validation nom/rotation de couleur observée (formulaire inchangé par cette story).
  - État vide ("Aucun projet pour l'instant...") non testé visuellement (les données de test existantes de Guillaume n'ont pas été effacées — action destructive hors périmètre) : vérifié uniquement par lecture du code (condition `active.length === 0 && archived.length === 0 && !loadError`), cohérente avec la logique déjà exercée pour les cas non-vides.

### Completion Notes List

- Toutes les tâches (1 à 4) complètes, les 3 AC vérifiés en navigateur (regroupement actifs/archivés avec bascule manuelle de statut, navigation switcher bidirectionnelle avec persistance du header/session, affichage nom/couleur/statut sur chaque carte), plus non-régression du formulaire de création de la Story 2.1.
- Décisions de portée prises à la création de la story et confirmées à l'implémentation, sans déviation : Switcher routé (pas générique état/items), écran "Général" inchangé (placeholder, Epic 4), état vide référence le bouton "Nouveau projet" plutôt que le FAB "+" (pas encore construit), carte de projet réutilise les tokens `task-card`, section archivés testée via bascule manuelle de statut en DevTools (pas d'UI d'archivage avant la Story 2.3).
- Aucune régression sur les écrans existants (`/`, `/login`, formulaire de création `/projects`) — seuls les fichiers listés en File List ont été touchés.

### File List

**Créés :**
- `components/switcher.tsx`
- `components/switcher.module.css`

**Modifiés :**
- `app/layout.tsx` (rendu de `<Switcher />` après `<Header />`)
- `app/projects/projects-screen.tsx` (liste groupée actifs/archivés, `ProjectRow`, état vide)
- `app/projects/projects-screen.module.css` (nouvelles classes carte/pastille/statut/disclosure, `.rawList` supprimée)
- `domain/project.ts` (+ `groupProjectsByStatus`, + type `ProjectsByStatus`)
- `domain/index.ts` (export des deux nouveaux symboles)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-11 : Implémentation initiale (Tasks 1 à 4 complètes). Composant `Switcher` (navigation Général/Projets, routé, exclu de `/login`) câblé dans `app/layout.tsx` ; fonction pure `groupProjectsByStatus` dans `domain/` ; liste de projets de la Story 2.1 remplacée par de vraies cartes groupées (actifs en premier, archivés dans une section `<details>` repliée par défaut), chacune affichant couleur/nom/puce de statut. Build, lint et les 3 AC vérifiés en navigateur (bascule switcher bidirectionnelle, tri par création décroissante, regroupement archivés via bascule manuelle de statut DevTools, non-régression du formulaire de création). Statut passé à `review`.
- 2026-08-11 : **Déviation demandée en direct par Guillaume après implémentation de la Story 2.3**, sur l'écran `/projects` réel : la section "Archivés" repliée en bas de page (`<details>`/`<summary>`, AC#1 de cette story) remplacée par un sélecteur segmenté "Actifs (n) / Archivés (n)" en haut de la liste (mêmes tokens `DESIGN.md.components.segmented-control` que le `Switcher` de niveau 1), qui filtre la liste affichée au lieu de l'empiler en dessous — accès direct aux archivés sans défilement. `app/projects/projects-screen.tsx`/`.module.css` modifiés (`.archivedSection`/`.archivedSummary` remplacées par `.statusToggle`/`.statusToggleItem`) ; `groupProjectsByStatus` (`domain/project.ts`) inchangée, toujours utilisée pour calculer les deux groupes. Voir Story 2.3, Change Log, pour le détail complet.
- 2026-08-11 : Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor, diff scopé aux fichiers de cette story). 6 patches appliqués : (1) création et rechargement post-création désormais séparés dans `handleSubmit` — un échec du rechargement n'est plus rapporté comme un échec de création ; (2) `openForm` protégé par `try/catch` contre un rejet non géré de `listProjects()` ; (3) `loadError` réinitialisé sur chacun des trois chemins de chargement réussi (montage, ouverture du formulaire, post-création) au lieu de rester bloqué à `true` indéfiniment ; (4) nouvel état `loading` pour supprimer le flash de l'état vide avant résolution du chargement initial ; (5) test d'onglet actif du `Switcher` borné (`pathname === tab.href || pathname.startsWith(...+"/")`) plutôt qu'un `startsWith` non borné ; (6) texte de la Task 3 resynchronisé avec le texte réellement livré ("Cliquez sur", changé sur demande directe de Guillaume après la création de la story). 3 points différés (pastille de couleur potentiellement obsolète sous création concurrente, `aria-pressed` au lieu d'une sémantique radio sur les pastilles de couleur — les deux hérités tels quels de la Story 2.1 — et exclusion silencieuse d'un `status` inconnu par `groupProjectsByStatus`, actuellement inatteignable) ajoutés à `deferred-work.md`. 8 findings rejetés comme bruit (dead code de la section Archivés en réalité exigé par l'AC#1, focus faible déjà tracké depuis la Story 2.1, absence de tests contredisant une décision d'architecture explicite, erreurs avalées sans logging cohérent avec la convention établie et l'absence d'outil de supervision, garde anti double-clic héritée de la Story 2.1, nom non trimé — faux positif, `createProject` trime déjà en interne —, tri sans départage sur `createdAt` dupliqué — théorique, `LOGIN_PATH` sans sous-route — spéculatif, aucune route de ce type n'existe ni n'est prévue). Build, lint et vérification en navigateur (console propre, liste inchangée) revérifiés après patchs. Statut passé à `done`.
