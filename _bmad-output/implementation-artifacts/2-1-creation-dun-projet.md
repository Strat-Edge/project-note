---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 2.1: Création d'un projet

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want créer un nouveau projet avec un nom, une description et une couleur,
so that je puisse commencer à y rattacher des tâches, notes et documents.

## Acceptance Criteria

1. **Given** je suis sur l'écran Projets **When** je lance la création d'un projet et saisis un nom **Then** le projet est créé avec le statut "actif" (description et couleur optionnelles à la saisie).
2. **Given** je ne modifie pas la couleur **When** le projet est créé **Then** une couleur est assignée automatiquement par rotation dans la palette de projet (8 teintes définies dans DESIGN.md).
3. **Given** je veux une couleur différente **When** je la sélectionne manuellement à la création **Then** le projet est créé avec la couleur choisie.
4. **Given** le nom du projet est vide **When** je tente de valider **Then** la création est bloquée (nom obligatoire).

## Tasks / Subtasks

- [x] Task 1: Modéliser l'entité Project et la rotation de couleur dans `domain/` (AC: #1, #2, #3, #4)
  - [x] Créer `domain/project.ts` : type `Project` (`id: string`, `name: string`, `description: string`, `color: ProjectColorKey`, `status: 'active' | 'archived'`, `createdAt: string`) et le type union `ProjectColorKey = 'project-1' | 'project-2' | ... | 'project-8'` (8 littéraux, dans cet ordre — reflète l'ordre de rotation `DESIGN.md.components.project-color.rotation`, pas les valeurs hex elles-mêmes : les couleurs vivent en CSS, `domain/` ne connaît que les clés).
  - [x] Fonction pure `nextProjectColor(existingCount: number): ProjectColorKey` — rotation cyclique sur les 8 clés, `existingCount % 8`. Prend un nombre déjà calculé en entrée (pas un accès Dexie direct : `domain/` ne dépend d'aucun autre module du projet, cf. AD-2).
  - [x] Fonction pure `validateProjectName(name: string): boolean` (ou équivalent) — nom non vide après `trim()`.
  - [x] Mettre à jour `domain/index.ts` pour exporter ces types/fonctions depuis `./project` (remplacer le `export {}` actuel — même pattern que `data/local/index.ts`, premier vrai contenu de `domain/`).
- [x] Task 2: Ajouter la persistance locale Dexie pour les projets (AC: #1, #2, #3)
  - [x] `data/local/db.ts` : ajouter la **première** déclaration de schéma, `this.version(1).stores({ projects: "id, status, createdAt" })`, dans le constructeur de `AppDatabase`. Aucune table n'a jamais été déclarée jusqu'ici (`db.ts` instancie la classe sans appeler `.version()` — cf. commentaire "Schéma vide pour l'instant") : ceci n'est donc pas une migration, c'est la version 1 elle-même.
  - [x] Créer `data/local/projects.ts` : `createProject(input: { name: string; description?: string; color?: ProjectColorKey }): Promise<Project>` (génère `id` via `crypto.randomUUID()`, `createdAt` via `new Date().toISOString()`, `status: 'active'`, écrit dans `db.projects`) et `listProjects(): Promise<Project[]>` (lecture complète, réutilisée par la Story 2.2 pour la vraie liste).
  - [x] Mettre à jour `data/local/index.ts` pour exporter `createProject`/`listProjects` depuis `./projects` (même pattern que l'export existant de `db`/`AppDatabase`).
- [x] Task 3: Construire l'écran Projets minimal avec formulaire de création (AC: #1, #2, #3, #4)
  - [x] Créer la route `app/projects/page.tsx` (Server Component minimal, aucune logique) qui rend un composant client `app/projects/projects-screen.tsx`.
  - [x] `app/projects/projects-screen.tsx` (`"use client"`) : bouton "Nouveau projet" qui révèle un formulaire **inline** (pas de modale/overlay — cf. Dev Notes, décision de portée) ; bouton "Annuler" (fantôme) qui le referme sans créer. Formulaire : champ Nom (obligatoire, pattern `text-input` de `DESIGN.md`, libellé au-dessus, aucune validation pendant la frappe), champ Description (optionnel, même pattern, `<textarea>`), sélecteur de couleur (8 pastilles carrées `--radius-sm`, une par `ProjectColorKey`, couleur de fond `var(--color-project-N)`, cible tactile ≥44px même si la pastille visuelle est plus petite, `aria-pressed` sur la pastille sélectionnée). À l'ouverture, présélectionner la pastille correspondant à `nextProjectColor(count)` (`count` = `listProjects().length` au moment de l'ouverture) ; la sélection manuelle d'une autre pastille prévaut sur cette présélection (AC#3).
  - [x] Validation au submit (pas pendant la frappe, cf. `UX-DR11`) : si le nom est vide/blanc → bloquer, afficher un message factuel sous le champ (même traitement que `login-form.tsx` : `role="alert"`, ton court/factuel, cf. `EXPERIENCE.md` Voice and Tone).
  - [x] Au submit valide : appeler `createProject` (import direct depuis `@/data/local`, **aucune Server Action** — cf. Dev Notes, écriture 100% locale) ; puis rafraîchir la liste brute de vérification (Task 3 suivant) et refermer le formulaire.
  - [x] Sous le formulaire, afficher une liste brute de vérification manuelle (texte simple : nom + couleur de chaque projet existant, chargée via `listProjects()` au montage et après chaque création) — **ce n'est pas la vraie liste de la Story 2.2** (pas de regroupement actifs/archivés, pas de cartes stylées) : juste de quoi confirmer visuellement qu'un projet a bien été créé et persiste après rechargement, sans dépendre des DevTools.
  - [x] Aucune modification de `proxy.ts` nécessaire : le `matcher` protège tout par défaut sauf une liste explicite d'exclusions d'assets statiques — `/projects` est donc déjà protégé (redirection vers `/login` si non authentifié) sans changement.
- [x] Task 4: Vérification manuelle de bout en bout (AC: #1, #2, #3, #4)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Créer un projet avec uniquement un nom → statut "actif", couleur = 1ère de la rotation (`project-1`), description vide acceptée.
  - [x] Créer un second projet sans toucher à la couleur → couleur suivante de la rotation (`project-2`) ; créer un 9e projet (au-delà des 8 teintes) → le cycle reprend à `project-1`.
  - [x] Créer un projet en sélectionnant manuellement une pastille différente de la présélection → la couleur choisie est bien celle enregistrée, pas celle de la rotation.
  - [x] Tenter de valider avec un nom vide (et avec un nom composé uniquement d'espaces) → création bloquée dans les deux cas, message affiché, aucune entrée Dexie créée.
  - [x] Recharger la page `/projects` → les projets créés précédemment restent visibles dans la liste brute de vérification (confirme la persistance IndexedDB, indépendamment du cycle de vie du composant React).
  - [x] Vérifier via les DevTools (onglet Application → IndexedDB → `project-note` → `projects`) que les enregistrements correspondent exactement aux champs attendus (`id` uuid, `status: 'active'`, `createdAt` ISO 8601).

### Review Findings

- [x] [Review][Patch] Rotation de couleur non atomique sous création concurrente (double-soumission rapide, plusieurs onglets ouverts sur `/projects`) — `createProject` lit `db.projects.count()` puis écrit sans transaction ; `handleSubmit` n'a pas de garde de ré-entrance (`if (pending) return`). Deux créations quasi simultanées peuvent lire le même compte et persister la même couleur de rotation. Corrigé — `count()`/`add()` regroupés dans `db.transaction("rw", ...)` (sérialise les créations concurrentes) ; garde `if (pending) return` ajoutée en tête de `handleSubmit`. [data/local/projects.ts, app/projects/projects-screen.tsx (handleSubmit)]
- [x] [Review][Patch] Aucune gestion d'erreur sur les appels Dexie — si `createProject` échoue (quota dépassé, transaction bloquée), `setPending(false)`/`closeForm()` ne s'exécutent jamais : le bouton "Créer" reste désactivé indéfiniment sans message, seul un rechargement de page permet de s'en sortir. Le chargement initial (`listProjects().then(setProjects)` dans le `useEffect`) n'a pas non plus de `.catch` : un échec laisse la liste vide silencieusement. Corrigé — `try/catch/finally` dans `handleSubmit` (message "La création a échoué. Réessayez.", `pending` toujours remis à `false`) ; `.catch` sur le chargement initial (message "Impossible de charger la liste des projets."). [app/projects/projects-screen.tsx]
- [x] [Review][Patch] La présélection de couleur à l'ouverture du formulaire utilise l'état React `projects.length` (potentiellement obsolète si le `useEffect` de montage n'a pas encore résolu, notamment juste après un rechargement de page) plutôt qu'un comptage frais "au moment de l'ouverture" comme l'exige la story. Si l'utilisateur ne modifie pas la présélection erronée, cette couleur incorrecte est bien celle persistée (pas de recalcul côté `createProject` puisqu'une couleur explicite est transmise) — déviation réelle, pas seulement cosmétique. Corrigé — `openForm` est désormais async et appelle `listProjects()` pour un comptage frais avant de calculer la présélection ; revérifié en navigateur (9 projets existants → présélection "Orange"/`project-2`, correct). [app/projects/projects-screen.tsx (openForm)]
- [x] [Review][Patch] L'attribut HTML `required` sur le champ Nom intercepte nativement une soumission à champ totalement vide avant l'exécution du handler applicatif : le message "Le nom du projet est obligatoire." ne s'affiche donc que pour le cas "espaces uniquement", pas pour le cas "champ vide" — la Task 4 de cette story exige explicitement l'affichage du message dans les deux cas (la création est bloquée dans les deux cas, seul l'affichage du message diffère). Corrigé — `required` retiré, la validation applicative gère les deux cas identiquement ; revérifié en navigateur. [app/projects/projects-screen.tsx (input Nom)]
- [x] [Review][Patch] `createProject` ne revalide pas le nom lui-même (`validateProjectName` n'est appelé que côté UI) — un futur appelant de `data/local` qui contournerait le formulaire pourrait persister un projet à nom vide sans qu'aucune garde ne l'en empêche au niveau de la couche de données. Corrigé — `createProject` appelle `validateProjectName` et lève si invalide, avant toute écriture. [data/local/projects.ts]
- [x] [Review][Patch] Les pastilles de couleur : la cible tactile et le carré visuel de couleur font tous deux 44×44px — la story demandait explicitement "cible tactile ≥44px même si la pastille visuelle est plus petite", ce qui implique un carré de couleur visuellement plus petit inséré dans une zone de tap plus grande. Corrigé — bouton `.swatch` (44×44, cible tactile) contient désormais un `<span className={styles.swatchChip}>` (24×24, couleur réelle). [app/projects/projects-screen.tsx, app/projects/projects-screen.module.css]
- [x] [Review][Patch] Le groupe de pastilles de couleur n'a pas de regroupement accessible (`fieldset`/`legend` ou `aria-labelledby` reliant le `<span>Couleur</span>` au groupe) ; chaque pastille porte un `aria-label` générique ("Couleur N") sans lien avec la teinte réelle — un lecteur d'écran n'identifie ni le groupe ni la couleur choisie de façon exploitable. Corrigé — groupe enveloppé dans `<fieldset>`/`<legend>Couleur</legend>` ; `aria-label` remplacé par un nom de couleur réel par clé ("Vert", "Orange", "Violet", "Rose", "Ambre", "Sarcelle", "Magenta", "Gris" — labels de présentation uniquement, `domain/` reste inchangé). [app/projects/projects-screen.tsx (swatches)]
- [x] [Review][Defer] Indicateur de focus faible sur `.input`/`.textarea` (`outline: none` remplacé uniquement par un changement de `border-color`, sans anneau de compensation) — deferred, pré-existant (motif identique copié de `login-form.module.css`, en place depuis les Stories 1.2/1.3, non introduit par cette story).
- [x] [Review][Defer] Aucune limite de taille sur les champs Nom/Description — deferred (aucune valeur maximale n'est définie par le PRD/l'Architecture pour ces champs ; NFR-10 ne couvre que la taille des fichiers. Fixer une limite maintenant serait une contrainte inventée, pas dérivée de la spec — à visiter si Guillaume en exprime le besoin).
- [x] [Review][Defer] Les noms de projet dupliqués ne sont pas contrôlés — deferred (FR-6 n'exige aucune unicité de nom ; pas un bug, une extension possible hors périmètre de cette story).

## Dev Notes

**Portée de "l'écran Projets" pour cette story — décision de portée explicite :** ni le switcher de navigation (Général/Projets) ni la vraie liste de projets (regroupement actifs/archivés, cartes stylées) n'existent encore — les deux sont le périmètre exact de la Story 2.2 ("Liste et navigation des projets"), qui vient juste après. Cette story construit uniquement `/projects` comme route minimale hébergeant le formulaire de création, accessible pour l'instant par URL directe (pas de lien de navigation) — même précédent que `/login` en Story 1.2, accessible sans nav avant que le reste ne soit construit. Ne pas anticiper le switcher ni la vraie liste ici ; la Story 2.2 remplacera la "liste brute de vérification" de cette story par la vraie UI.

**Formulaire inline, pas une modale — décision de portée, vérifiée contre `EXPERIENCE.md` :** la ligne "Modale/overlay" de `EXPERIENCE.md` § Component Patterns énumère explicitement ses 3 seuls usages : "le flux de capture, la confirmation de désarchivage, et la confirmation de suppression de document" — la création de projet n'y figure pas. La ligne "Formulaire de création de projet" du même tableau ne mentionne aucune présentation en overlay. Construire un composant `Modal` générique réutilisable maintenant serait donc de l'anticipation non justifiée par les specs (le vrai premier besoin de ce composant arrive en Story 2.3 — confirmation de désarchivage — et Story 6.3/Epic 3). Cette story utilise une simple révélation inline (bouton "Nouveau projet" → formulaire visible sur la même page, bouton "Annuler" fantôme pour le refermer), cohérente avec les patterns Bouton primaire/fantôme déjà établis. Si Guillaume préfère une modale au moment de la revue, c'est un ajustement localisé au formulaire, pas une refonte.

**Aucune écriture Supabase dans cette story — décision d'architecture, pas un oubli :** `AD-1` dit que toute écriture passe d'abord par Dexie et que "seul `sync/` fait transiter ces écritures vers `data/remote/`" — mais `sync/index.ts` est explicitement vide ("Logique implémentée à partir de l'Epic 3 ... vide pour l'instant"), et l'Epic 3 (qui construit ce moteur) vient *après* l'Epic 2 dans l'ordre de développement. Il n'existe donc, au moment de cette story, aucun mécanisme pour pousser un `Project` vers Supabase — en créer un ici serait reconstruire en avance ce que l'Epic 3 "prouve de bout en bout... que les epics suivants réutiliseront" (cf. description Epic 3, qui parle des epics *suivants*, pas d'Epic 2). Conséquence assumée et attendue : un projet créé sur un appareil n'est visible que sur cet appareil tant que la Story 3.2 n'a pas livré le moteur de synchronisation générique — ce n'est pas un bug de cette story. Aucune table Supabase `projects` n'est créée ici non plus (pas de schéma SQL à écrire) ; sa création est laissée à la story qui implémentera effectivement la synchronisation des projets.

**`Project` n'est pas lié par `AD-3` (résolution de conflit par champ) :** le binding d'`AD-3` liste explicitement les champs concernés — "`Task.status`, `priority` partagée `Task`/`Note`/`Document`, `Note.transcription`" — `Project` n'y figure pas. Ne pas ajouter de métadonnées `<champ>_updated_at`/`<champ>_synced_at` sur `Project` dans cette story : ce serait spéculatif (rien ne les consommerait, cf. le même anti-pattern déjà noté pour `data/local/db.ts` non importé en Story 1.1). `createdAt` seul suffit pour l'instant.

**Pas de Server Action pour la création — contraste explicite avec le seul précédent existant (`app/login/actions.ts`) :** la connexion utilise une Server Action parce que Supabase Auth doit s'exécuter côté serveur (gestion de cookies de session, cf. `AD-6`/`AD-9`). La création d'un projet est une écriture 100% locale (Dexie, dans le navigateur) — aucune donnée ne part vers un serveur dans cette story. `createProject` s'appelle donc directement depuis le composant client (`app/projects/projects-screen.tsx`), pas via `"use server"`. Ne pas reproduire le pattern Server Action ici par réflexe.

**Couleurs : `domain/` ne connaît que des clés, pas des valeurs hex.** Les 8 teintes existent déjà comme custom properties CSS (`--color-project-1` à `--color-project-8`, posées en Story 1.3 dans `app/globals.css`, valeurs `DESIGN.md.colors.project-1..8`) — ne pas dupliquer ces valeurs hex en TypeScript. `Project.color` stocke une clé (`'project-1'` etc.), et le composant d'écran mappe cette clé vers `var(--color-project-N)` en CSS/inline style à l'affichage.

**Convention d'ids et d'horodatage (Architecture, Consistency Conventions) :** ids en `uuid` v4 générés côté client (`crypto.randomUUID()`, disponible nativement dans tous les navigateurs cibles — aucune dépendance à ajouter) ; horodatages en ISO 8601 UTC (`new Date().toISOString()`), conversion en fuseau local réservée à l'affichage (aucun affichage de date n'est requis par cette story).

**Barrel exports :** `domain/index.ts` et `data/local/index.ts` suivent le même pattern d'export nommé déjà en place pour `db`/`AppDatabase` (`export { x, y } from "./fichier"`) — ne pas introduire un `export *`. `components/index.ts` reste, lui, intentionnellement vide (précédent établi en Story 1.3 : `components/header.tsx` n'y est pas ré-exporté, importé directement via `@/components/header`) — cette story n'ajoute d'ailleurs aucun fichier sous `components/` (cf. décision "pas de modale" ci-dessus).

### Project Structure Notes

Fichiers à créer :
```text
domain/project.ts
data/local/projects.ts
app/projects/page.tsx
app/projects/projects-screen.tsx
app/projects/projects-screen.module.css
```

Fichiers à modifier :
```text
domain/index.ts        # export des types/fonctions de project.ts (remplace `export {}`)
data/local/index.ts     # export de createProject/listProjects
data/local/db.ts        # première déclaration de schéma Dexie (version 1, table `projects`)
```

Aucun changement à `proxy.ts`, `components/`, ni aux fichiers Supabase (`data/remote/`) — cf. Dev Notes. Aligné avec l'arborescence posée en Story 1.1 ; aucun nouveau dossier de premier niveau.

### Testing Standards

Aucun framework de test n'est imposé par l'Architecture (identique aux Stories 1.1/1.2/1.3). Vérification manuelle exhaustive listée en Task 4 — couvre les 4 AC (création avec nom seul, rotation de couleur sur plusieurs créations dont un cycle complet de 8, sélection manuelle de couleur, blocage sur nom vide) plus une vérification de persistance réelle via IndexedDB (pas seulement via l'état React).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Gestion des projets, Story 2.1]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.2 Gestion des projets (FR-6), §10 Assumptions Index]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter `components.project-color` (ordre de rotation, 8 teintes), `components.text-input`, `components.button-primary`/`button-ghost`; sections Components, Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns — lignes "Formulaire de création de projet" et "Modale/overlay" (usages explicites, création de projet absente de cette dernière), Voice and Tone]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3 (binding exact, Project exclu), AD-4, Consistency Conventions (uuid/ISO8601), Capability → Architecture Map (4.2), Deferred]
- [Source: _bmad-output/implementation-artifacts/1-1-initialisation-et-deploiement-du-projet.md — Review Findings/Deferred (`data/local/db.ts` non importé, à revisiter "dès qu'Epic 2 ajoute le premier usage réel de Dexie (table Project)")]
- [Source: _bmad-output/implementation-artifacts/1-3-application-de-lidentite-visuelle-stratedge.md — Dev Notes (système de tokens à deux couches, palette brute `--color-project-1..8` déjà posée), Completion Notes]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — item `data/local/db.ts` (Story 1.1), confirmé applicable à cette story]
- [Source: proxy.ts — matcher en denylist, `/projects` protégé sans changement]
- [Source: app/login/login-form.tsx, app/login/login-form.module.css — seul précédent existant de formulaire (pattern champ/label/validation/message d'erreur à répliquer), et seul précédent de Server Action (pattern à ne PAS répliquer ici, cf. Dev Notes)]

**Recherche technique (vérifiée, aucune version à figer ici — aucune nouvelle dépendance) :**
- `crypto.randomUUID()` — API Web standard, supportée nativement par tous les navigateurs evergreen cibles (Chrome/Edge/Firefox/Safari desktop et mobile) en contexte sécurisé (HTTPS ou localhost, déjà le cas pour ce projet) ; aucun polyfill ni dépendance npm nécessaire.
- Dexie 4.4.4 (déjà en dépendance depuis la Story 1.1) — `this.version(N).stores({...})` est l'API stable de déclaration de schéma ; appeler `.version(1)` pour une base qui n'a jamais eu de version déclarée n'est pas une migration, aucune considération de compatibilité ascendante à gérer ici.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run build`/`npm run lint` : propres du premier coup, aucune itération nécessaire.
- Vérification manuelle en navigateur (dev server local, `preview_start`), après connexion manuelle de Guillaume (mot de passe jamais saisi par l'agent — règle de sécurité) :
  - `/projects` bien protégée par `proxy.ts` (redirection `/login` avant connexion, accès direct après) — aucune modification du matcher nécessaire, confirmé.
  - Nom vide (champ HTML `required`) : bloqué nativement par le navigateur avant même l'exécution du handler `onSubmit` — le message custom `role="alert"` ne s'affiche donc pas pour ce cas précis (le `required` HTML intercepte en amont). Nom composé uniquement d'espaces (contourne `required`, qui ne considère que la présence de caractères) : bloqué par `validateProjectName`, message "Le nom du projet est obligatoire." affiché comme prévu. Dans les deux cas, aucune entrée Dexie créée — l'AC#4 est satisfait dans les deux scénarios, seul le mécanisme de blocage diffère (natif vs. JS applicatif).
  - Rotation de couleur vérifiée sur 9 créations successives sans sélection manuelle : `project-1, project-2, project-4, project-5, project-6, project-7, project-8, project-1` (la 3e création a été faite avec sélection manuelle, cf. ligne suivante) — cycle de 8 confirmé, rebouclage exact sur la 9e création.
  - Sélection manuelle vérifiée : 3e projet créé avec "Couleur 8" sélectionnée explicitement (la présélection de rotation aurait été "Couleur 3") — valeur choisie bien celle enregistrée (`aria-pressed` vérifié avant submit, valeur en base vérifiée après).
  - Persistance vérifiée par rechargement de `/projects` (liste brute inchangée) et par lecture directe d'IndexedDB (`indexedDB.open('project-note')` → object store `projects`) : tous les enregistrements (`id` uuid v4, `status: 'active'`, `createdAt` ISO 8601, `color` cohérente) conformes à `Project`.

### Completion Notes List

- ✅ Toutes les tâches (1 à 4) complètes, les 4 AC vérifiés de bout en bout en navigateur (build/lint propres, 9 créations de projet testées couvrant rotation complète + rebouclage, sélection manuelle, blocage nom vide sous ses deux formes, persistance IndexedDB confirmée par lecture directe du object store).
- Décisions de portée prises à la création de la story et confirmées à l'implémentation, sans déviation : formulaire inline (pas de modale), écran `/projects` minimal sans switcher/vraie liste (Story 2.2), aucune écriture Supabase (Epic 3), pas de Server Action (écriture 100% locale).
- Nuance découverte en vérification (non un défaut) : l'attribut HTML `required` sur le champ Nom bloque nativement un envoi à champ complètement vide avant que `validateProjectName`/le message custom ne s'exécutent ; seul le cas "espaces uniquement" déclenche effectivement le message applicatif "Le nom du projet est obligatoire." Les deux cas bloquent bien la création (AC#4 satisfait), documenté ici pour éviter toute confusion en revue.
- Aucune régression sur les écrans existants (`/`, `/login`) — aucun fichier partagé (globals.css, header, proxy) modifié par cette story.

### File List

**Créés :**
- `domain/project.ts`
- `data/local/projects.ts`
- `app/projects/page.tsx`
- `app/projects/projects-screen.tsx`
- `app/projects/projects-screen.module.css`

**Modifiés :**
- `domain/index.ts` (export des types/fonctions de `project.ts`)
- `data/local/index.ts` (export de `createProject`/`listProjects`)
- `data/local/db.ts` (première déclaration de schéma Dexie — version 1, table `projects`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-07 : Implémentation initiale (Tasks 1 à 4 complètes). Entité `Project` et rotation de couleur dans `domain/`, première table Dexie (`projects`, version 1), écran `/projects` minimal avec formulaire de création inline (nom/description/couleur) et liste brute de vérification. Build, lint et les 4 AC vérifiés en navigateur (rotation sur 9 créations avec rebouclage, sélection manuelle, blocage nom vide, persistance IndexedDB). Statut passé à `review`.
- 2026-08-11 : Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor, diff scopé aux fichiers de cette story). 7 patches appliqués : (1) `count()`/`add()` regroupés en transaction Dexie + garde de ré-entrance sur `handleSubmit`, contre la rotation de couleur non atomique sous création concurrente ; (2) `try/catch/finally` sur la soumission + `.catch` sur le chargement initial, contre le formulaire bloqué indéfiniment en cas d'échec Dexie ; (3) présélection de couleur recalculée via un `listProjects()` frais à l'ouverture du formulaire (async) au lieu de l'état React potentiellement obsolète ; (4) attribut `required` retiré du champ Nom pour que le message applicatif s'affiche de façon cohérente sur nom vide et sur espaces uniquement ; (5) `createProject` revalide désormais le nom lui-même (défense en profondeur au niveau de la couche de données) ; (6) pastille de couleur : cible tactile 44×44 avec carré de couleur visuel 24×24 à l'intérieur ; (7) sélecteur de couleur enveloppé dans `fieldset`/`legend`, labels accessibles remplacés par de vrais noms de couleur. 3 points différés (indicateur de focus faible — pré-existant Story 1.2/1.3, absence de limite de taille sur nom/description, doublons de nom non contrôlés) ajoutés à `deferred-work.md`. 4 findings rejetés comme bruit (justification d'index non bloquante à cette échelle, champ `status` jugé à tort spéculatif alors qu'il découle de l'AC#1, absence de repli pour `crypto.randomUUID()` en contexte non sécurisé — environnement inatteignable pour ce déploiement, garde de démontage sur le fetch initial — impact négligeable en React 19 sur une lecture Dexie locale quasi instantanée). Build, lint et bout en bout revérifiés en navigateur après patchs (présélection correcte à 9 projets existants, message d'erreur affiché sur nom vide, création réussie). Statut passé à `done`.
