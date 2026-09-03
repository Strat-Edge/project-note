---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 4.2: Filtre par projet et gestion des projets archivés

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want filtrer le calendrier par projet et exclure les projets archivés par défaut,
so that je ne voie que ce qui est pertinent aujourd'hui.

## Acceptance Criteria

1. **Given** plusieurs projets actifs **When** j'en sélectionne un ou plusieurs dans le filtre **Then** seules les tâches de ces projets restent affichées
2. **Given** un projet archivé **When** j'affiche le calendrier sans filtre spécifique **Then** ses tâches n'apparaissent pas
3. **Given** je veux revoir les tâches d'un projet archivé **When** j'active le filtre "afficher les projets archivés" **Then** elles réapparaissent dans le calendrier

## Tasks / Subtasks

- [x] Task 1: `domain/calendar.ts` — filtre pur multi-projet + archivés (AC: #1, #2, #3 ; Capability Map 4.7)
  - [x] Ajouter `import type { Project } from "./project";` en tête de fichier (à côté de `import type { Task } from "./task";`).
  - [x] Ajouter, à la suite de `getMonthGridDays` :
    ```ts
    // Story 4.2 (FR-28, FR-31) — filtre multi-projet + exclusion des projets archivés par
    // défaut. Reçoit Project[] en plus de Task[] (toujours aucune dépendance IO, cf. AD-2) :
    // la distinction actif/archivé vit sur Project.status, pas sur Task — ce module doit donc
    // résoudre chaque task.projectId vers son Project pour appliquer le filtre.
    export interface CalendarFilters {
      // Vide = aucun filtre actif : toutes les tâches de projets actifs sont affichées (AC#2,
      // comportement par défaut). Non vide = "seules les tâches de ces projets restent
      // affichées" (AC#1, texte exact de l'AC) : les tâches sans projet et les tâches d'un
      // projet actif non sélectionné sont exclues tant qu'un filtre est actif.
      selectedProjectIds: ReadonlySet<string>;
      // FR-31 : false par défaut, les tâches de projets archivés n'apparaissent jamais
      // (AC#2). AC#3 : ce booléen est indépendant de selectedProjectIds — la liste de
      // sélection ne propose que des projets actifs (AC#1 : "plusieurs projets actifs"),
      // jamais de projets archivés un par un ; ce seul contrôle les révèle tous à la fois,
      // quelle que soit la sélection active en cours.
      showArchivedProjects: boolean;
    }

    // FR-28, FR-31, Capability Map 4.7. `projects` sert uniquement à résoudre le statut
    // actif/archivé de chaque task.projectId — jamais à lire une couleur (cf. commentaire
    // d'en-tête de ce fichier, résolue côté UI via Project[]).
    export function filterTasksForCalendar(
      tasks: readonly Task[],
      projects: readonly Project[],
      filters: CalendarFilters,
    ): Task[] {
      const projectsById = new Map(projects.map((project) => [project.id, project]));
      const hasProjectFilter = filters.selectedProjectIds.size > 0;

      return tasks.filter((task) => {
        if (task.projectId === null) {
          // Tâche générale (FR-2) : visible seulement en l'absence de filtre projet actif —
          // une sélection explicite de projets signifie littéralement "seules les tâches de
          // CES projets" (AC#1), une tâche sans aucun projet n'en fait jamais partie.
          return !hasProjectFilter;
        }

        const project = projectsById.get(task.projectId);
        if (!project) {
          // Référence orpheline (ne devrait pas arriver en écriture locale-first
          // mono-utilisateur) : jamais affichée plutôt que de planter le filtre sur une
          // donnée incohérente.
          return false;
        }

        if (project.status === "archived") {
          return filters.showArchivedProjects;
        }

        return hasProjectFilter ? filters.selectedProjectIds.has(project.id) : true;
      });
    }
    ```
  - [x] `domain/index.ts` : ajouter `filterTasksForCalendar` à l'export de `./calendar`, et `CalendarFilters` au bloc `export type { CalendarViewMode } from "./calendar";` (devient `export type { CalendarFilters, CalendarViewMode } from "./calendar";`).

- [x] Task 2: `app/general-screen.tsx` — état de filtre + panneau de cases à cocher (AC: #1, #2, #3)
  - [x] Étendre l'import `@/domain` existant : ajouter `filterTasksForCalendar`, `groupProjectsByStatus` au bloc de fonctions, et `CalendarFilters` au bloc de types :
    ```ts
    import type { CalendarFilters, CalendarViewMode, Priority, Project, Task } from "@/domain";
    import {
      dateKey,
      filterTasksForCalendar,
      getMonthGridDays,
      getWeekDays,
      groupProjectsByStatus,
      groupTasksByDueDate,
      isSameDay,
    } from "@/domain";
    ```
  - [x] Ajouter deux états, à la suite de `loadError` (existants : `viewMode`, `referenceDate`, `tasks`, `projects`, `loadError`) :
    ```ts
    // Story 4.2 — état de filtre indépendant du mode d'affichage, jamais réinitialisé par
    // selectViewMode/goToPrevious/goToNext (même principe que referenceDate, cf. Dev Notes
    // de la Story 4.1 : "le futur filtre de projet devra suivre le même principe, état
    // indépendant du mode d'affichage, jamais réinitialisé par setViewMode").
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
    const [showArchivedProjects, setShowArchivedProjects] = useState(false);
    ```
  - [x] Ajouter, à côté de `goToPrevious`/`goToNext` :
    ```ts
    function toggleProjectFilter(id: string) {
      setSelectedProjectIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
    ```
  - [x] Remplacer le calcul existant de `tasksByDate` (actuellement `groupTasksByDueDate(tasks)`) par une version filtrée, et dériver `activeProjects`/`archivedProjects` :
    ```ts
    const { active: activeProjects, archived: archivedProjects } = groupProjectsByStatus(projects);
    const filters: CalendarFilters = { selectedProjectIds, showArchivedProjects };
    const visibleTasks = filterTasksForCalendar(tasks, projects, filters);
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const tasksByDate = groupTasksByDueDate(visibleTasks);
    ```
    (Remplace les deux lignes `const projectsById = ...` et `const tasksByDate = groupTasksByDueDate(tasks);` déjà présentes — ne pas les dupliquer. Tout le reste du composant qui lit `tasksByDate`/`projectsById` — grille, légende, `hasProjectlessTask` — n'a besoin d'aucun autre changement : il reflète déjà automatiquement l'ensemble filtré.)
  - [x] Insérer le panneau de filtre juste avant `weekdayRow`, à l'intérieur de la branche `!loadError`, visible seulement s'il y a au moins un projet (actif ou archivé) :
    ```tsx
    {(activeProjects.length > 0 || archivedProjects.length > 0) && (
      <ProjectFilterControls
        activeProjects={activeProjects}
        archivedCount={archivedProjects.length}
        selectedProjectIds={selectedProjectIds}
        showArchivedProjects={showArchivedProjects}
        onToggleProject={toggleProjectFilter}
        onToggleArchived={() => setShowArchivedProjects((current) => !current)}
      />
    )}
    ```
  - [x] Ajouter le sous-composant, à la suite de `GeneralScreen` (même précédent que `SortFilterControls` dans `app/projects/[id]/project-view.tsx`, sous-composant interne non extrait sous `components/` — aucun composant Checkbox partagé n'existe encore dans ce projet) :
    ```tsx
    // FR-28, FR-31 (Story 4.2). Case à cocher dupliquée littéralement du pattern
    // .filter/.checkboxInput/.checkboxBox de project-view.module.css (DESIGN.md.components.
    // checkbox) — même convention déjà établie dans ce fichier pour .viewToggle (dupliqué de
    // switcher.module.css).
    function ProjectFilterControls({
      activeProjects,
      archivedCount,
      selectedProjectIds,
      showArchivedProjects,
      onToggleProject,
      onToggleArchived,
    }: {
      activeProjects: Project[];
      archivedCount: number;
      selectedProjectIds: ReadonlySet<string>;
      showArchivedProjects: boolean;
      onToggleProject: (id: string) => void;
      onToggleArchived: () => void;
    }) {
      return (
        <div
          className={styles.projectFilters}
          role="group"
          aria-label="Filtrer le calendrier par projet"
        >
          {activeProjects.map((project) => (
            <label key={project.id} className={styles.filter}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={selectedProjectIds.has(project.id)}
                onChange={() => onToggleProject(project.id)}
              />
              <span className={styles.checkboxBox} aria-hidden="true" />
              <span
                className={styles.filterSwatch}
                style={{ backgroundColor: `var(--color-${project.color})` }}
                aria-hidden="true"
              />
              {project.name}
            </label>
          ))}
          {archivedCount > 0 && (
            <label className={styles.filter}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={showArchivedProjects}
                onChange={onToggleArchived}
              />
              <span className={styles.checkboxBox} aria-hidden="true" />
              {`Afficher les projets archivés (${archivedCount})`}
            </label>
          )}
        </div>
      );
    }
    ```

- [x] Task 3: `app/general-screen.module.css` — styles du panneau de filtre (AC: #1, #2, #3)
  - [x] Ajouter, à la suite de `.toolbarControls` (avant `.nav`) — bloc dupliqué littéralement de `app/projects/[id]/project-view.module.css` (`.filters`/`.filter`/`.checkboxInput`/`.checkboxBox`, renommé `.filters` → `.projectFilters` pour éviter toute confusion de nom avec les futurs filtres de tri d'un autre écran) plus `.filterSwatch`, nouveau à cette story :
    ```css
    /* FR-28, FR-31 (Story 4.2) — filtre multi-projet + case "Afficher les projets archivés".
       Case à cocher dupliquée littéralement de project-view.module.css (.filter/
       .checkboxInput/.checkboxBox, DESIGN.md.components.checkbox) — même convention déjà
       établie ci-dessus pour .viewToggle (dupliqué de switcher.module.css). */
    .projectFilters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .visuallyHidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .filter {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 44px;
      color: var(--color-muted);
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      .filter {
        color: var(--color-muted-dark);
      }
    }

    .checkboxInput {
      composes: visuallyHidden;
    }

    .checkboxBox {
      flex-shrink: 0;
      position: relative;
      width: 13px;
      height: 13px;
      border: 1.5px solid var(--color-muted);
      border-radius: 4px;
      background: var(--color-bg);
    }

    @media (prefers-color-scheme: dark) {
      .checkboxBox {
        border-color: var(--color-muted-dark);
      }
    }

    .checkboxInput:checked + .checkboxBox {
      border-color: var(--color-primary);
      background: var(--color-primary);
    }

    .checkboxInput:checked + .checkboxBox::after {
      content: "";
      position: absolute;
      left: 3px;
      top: 0.5px;
      width: 4px;
      height: 7px;
      border: solid var(--color-on-primary);
      border-width: 0 1.6px 1.6px 0;
      transform: rotate(45deg);
    }

    .checkboxInput:focus-visible + .checkboxBox {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* Pastille de couleur projet dans le libellé du filtre — même swatch que .legendItem i,
       taille réduite pour tenir dans une case à cocher. */
    .filterSwatch {
      width: 9px;
      height: 9px;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }
    ```
  - [x] Placer le bloc `.projectFilters` dans le JSX juste avant `.weekdayRow` (cf. Task 2) — pas de nouvelle marge à ajouter, `.main` porte déjà `gap: var(--space-5)` entre tous ses enfants directs.

- [x] Task 4: Vérification manuelle (AC #1 à #3)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Préparer les données : au moins 3 projets actifs (couleurs distinctes) avec chacun une tâche à échéance dans le mois affiché ; archiver un 4ᵉ projet (Story 2.3, écran Projets) après lui avoir créé une tâche à échéance ; garder aussi une tâche générale ("Sans projet") à échéance, réutilisée si déjà présente d'une story précédente.
  - [x] **AC#1** : ouvrir l'écran Général, cocher un seul projet actif dans le panneau de filtre → seules ses tâches restent visibles dans la grille (et dans la légende) ; les tâches des autres projets actifs et la tâche "Sans projet" disparaissent. Cocher un deuxième projet actif → ses tâches réapparaissent également (combinaison, pas exclusivité). Décocher les deux → toutes les tâches actives (et "Sans projet") reviennent.
  - [x] **AC#2** : sans aucune case cochée (état par défaut à l'ouverture), vérifier que la tâche du projet archivé n'apparaît nulle part dans la grille ni dans la légende.
  - [x] **AC#3** : cocher "Afficher les projets archivés" → la tâche du projet archivé réapparaît dans la grille, à la bonne date. Décocher → elle disparaît de nouveau. Vérifier la combinaison : avec un projet actif spécifique coché ET "Afficher les projets archivés" coché, la tâche archivée reste visible (indépendante de la sélection active) pendant que seuls les projets actifs cochés restent filtrés.
  - [x] Vérifier la non-réinitialisation du filtre au changement de vue : cocher un projet, basculer Mois ↔ Semaine et naviguer précédent/suivant → la sélection reste cochée, le filtre reste appliqué dans les deux vues.
  - [x] Vérifier l'absence de régression : couleur par projet et puce de priorité (Story 4.1, AC#1/#3) toujours correctes sur les tâches restant visibles ; légende cliquable toujours fonctionnelle vers `/projects/{id}` ; switcher Général/Projets et FAB "+" toujours accessibles ; aucun bouton "+ Nouveau projet" ajouté dans la toolbar (hors périmètre, Story 4.3). Aucune erreur console (`read_console_messages`), aucune erreur serveur (`preview_logs`).
  - [x] Vérifier l'accessibilité : chaque case de filtre atteignable au clavier (Tab), état coché/décoché annoncé (attribut natif `checked` d'un `<input type="checkbox">`, pas de rôle ARIA custom nécessaire), cible tactile ≥44px (`.filter` porte déjà `min-height: 44px`).
  - [x] Supprimer les données de test créées (mêmes limites qu'à la Story 4.1 : aucune suppression de tâche possible depuis l'UI — consigner dans le Debug Log ce qui reste en base pour un nettoyage manuel par Guillaume si souhaité).

### Review Findings

- [x] [Review][Decision] Visibilité des tâches "Sans projet" quand un filtre de projet actif est sélectionné — **résolu par Guillaume (2026-08-19) : comportement actuel confirmé.** Les tâches "Sans projet" restent masquées dès qu'un filtre de projet actif est sélectionné, cohérent avec le texte littéral de l'AC#1. Aucun changement de code nécessaire.
- [x] [Review][Patch] Sélection de projet non réconciliée avec la liste des projets actifs — filtre fantôme si un projet sélectionné est archivé pendant que le calendrier reste monté (scénario multi-appareil plausible via la synchro live) : `selectedProjectIds` garde l'id, aucune case ne l'affiche plus (le projet est passé côté `archivedProjects`), mais `hasProjectFilter` reste `true` dans `filterTasksForCalendar` et masque silencieusement toutes les autres tâches actives et "Sans projet", sans aucun moyen de s'en sortir dans l'UI hors rechargement de page [app/general-screen.tsx, domain/calendar.ts] — **corrigé** : `activeProjectIds`/`effectiveSelectedProjectIds` dérivés avant construction de `CalendarFilters` dans `app/general-screen.tsx`, ignore tout id qui n'est plus dans `activeProjects` sans muter l'état `selectedProjectIds` lui-même.
- [x] [Review][Patch] `aria-label` du groupe de filtres ("Filtrer le calendrier par projet") décrit inexactement la case "Afficher les projets archivés" qu'il contient, qui n'est pas un filtre par projet [app/general-screen.tsx] — **corrigé** : `aria-label` changé en "Filtrer le calendrier".
- [x] [Review][Patch] Commentaire d'en-tête de `domain/calendar.ts` ("Ne dépend d'aucun autre module du projet") devenu imprécis après l'ajout de l'import intra-`domain/` de `Project` (AD-2 reste respecté — l'import est interne à `domain/` — mais le commentaire ne le précise plus) [domain/calendar.ts] — **corrigé** : commentaire reformulé ("Ne dépend d'aucun module HORS domain/") avec précision que l'import de `./project` reste interne et autorisé par AD-2.
- [x] [Review][Defer] Pattern de case à cocher dupliqué une 3e fois (`project-view.module.css` → `general-screen.module.css`) sans composant partagé — deferred, pattern déjà établi et documenté par la story, candidat à extraction future si un 4e usage apparaît [app/general-screen.module.css]

## Dev Notes

**Portée exacte de cette story.** Epic 4 est découpé en 3 stories par FR (cf. Dev Notes de la Story 4.1). Cette story (4.2) couvre exactement FR-28 (filtre multi-projet) et FR-31 (exclusion des projets archivés par défaut) — les deux seuls FR encore non couverts après la Story 4.1 en dehors de FR-30. **FR-30 (créer/sélectionner un projet directement depuis le calendrier, bouton "+ Nouveau projet" visible dans `mockups/key-general-calendar.html`) reste le périmètre exact de la Story 4.3 — ne pas l'ajouter ici.**

**Aucun mockup ne couvre le panneau de filtre.** `mockups/key-general-calendar.html` (seule référence visuelle de l'écran Général) ne montre ni case à cocher de filtre projet, ni case "Afficher les projets archivés" — la légende de couleurs y est statique, sans aucune interaction de filtre. Même situation que la vue semaine en Story 4.1 (« aucun mockup de référence ») : le panneau de filtre ci-dessus est dérivé du composant Case à cocher déjà spécifié (DESIGN.md `components.checkbox`, EXPERIENCE.md Component Patterns "Case à cocher — Filtres de tri") et déjà implémenté pour les filtres de tri de la vue projet (Story 3.4, `app/projects/[id]/project-view.tsx` `SortFilterControls`) — réutilisation directe du même pattern visuel, jamais une nouvelle interaction inventée. Si Guillaume préfère un panneau repliable (disclosure) plutôt qu'un bandeau toujours visible, ajuster librement : aucune AC ne fixe la présentation exacte, seulement le comportement de filtrage.

**Décision de conception — case "Afficher les projets archivés" indépendante de la sélection de projets actifs, jamais de sélection archivée individuelle.** Le texte exact de l'AC#3 ("j'active le filtre 'afficher les projets archivés'... elles réapparaissent") décrit un contrôle unique, global, pas une liste de projets archivés sélectionnables un par un — cohérent avec l'AC#1 qui ne parle que de "plusieurs projets actifs" pour la sélection multiple. Le panneau ne liste donc jamais de projets archivés individuellement ; ils réapparaissent tous ensemble, sans filtrage supplémentaire par la sélection active en cours (cf. `filterTasksForCalendar` : la branche `project.status === "archived"` ignore volontairement `selectedProjectIds`).

**Décision de conception — tâche "Sans projet" masquée dès qu'un filtre actif est appliqué.** Ni les FR ni les AC ne mentionnent explicitement le sort de la tâche générale (FR-2, `projectId: null`) quand un filtre de projet est actif. Lecture retenue : l'AC#1 dit littéralement "seules les tâches de CES projets restent affichées" — une tâche qui n'appartient à aucun projet n'est jamais une tâche "de ces projets", elle est donc exclue dès que `selectedProjectIds` n'est pas vide. Sans filtre actif (état par défaut), elle reste visible comme avant cette story (comportement inchangé de la Story 4.1). Si Guillaume juge ce comportement contre-intuitif en usage réel, ajuster `filterTasksForCalendar` (aucune AC ne fixe ce cas précisément) — documenter le changement s'il a lieu.

**La légende (Story 4.1) reflète déjà automatiquement le filtre, sans changement de son propre code.** `legendProjects`/`hasProjectlessTask` sont dérivés de `tasksByDate`, qui vient maintenant de `visibleTasks` (post-filtre) au lieu de `tasks` (brut) — un projet dont toutes les tâches visibles sont masquées par le filtre disparaît donc naturellement de la légende, cohérent avec le principe déjà établi en Story 4.1 ("la légende n'y liste que les couleurs effectivement présentes sur la grille").

**Pourquoi `domain/calendar.ts` reçoit `Project[]` en plus de `Task[]`.** Le statut actif/archivé vit exclusivement sur `Project.status` (`domain/project.ts`), jamais dupliqué sur `Task` — `filterTasksForCalendar` doit donc résoudre chaque `task.projectId` vers son `Project` pour appliquer FR-31. Reste une fonction pure sans dépendance IO (cf. AD-2) : elle reçoit des tableaux déjà chargés côté UI, comme `groupTasksByDueDate` avant elle.

**Enseignement direct de la Story 4.1, appliqué ici sans y déroger.** Les Dev Notes de la 4.1 anticipaient exactement ce point : *"le futur filtre de projet (Story 4.2) devra suivre le même principe (état indépendant du mode d'affichage, jamais réinitialisé par `setViewMode`)"* — `selectedProjectIds`/`showArchivedProjects` sont des états React indépendants, jamais touchés par `selectViewMode`/`goToPrevious`/`goToNext`/le `useEffect` de défaut responsive. Aucun risque du piège `react-hooks/set-state-in-effect` rencontré en 4.1 ici : les nouveaux `setState` (`toggleProjectFilter`, `onToggleArchived`) sont tous déclenchés par des gestionnaires d'événements (`onChange`), jamais au corps d'un effet.

**Pas de nouvelle table/version Dexie, pas de nouveau champ Project/Task.** Cette story ne fait que lire `Project.status` (déjà existant, Story 2.1) pour filtrer en mémoire — `data/local/db.ts`, `data/local/projects.ts`, `data/local/tasks.ts` inchangés. `listAllTasks()`/`listProjects()` (déjà utilisés par `GeneralScreen` depuis la Story 4.1) restent la seule source de données ; le filtrage est un traitement en lecture pur côté `domain/`+UI, jamais une nouvelle requête Dexie filtrée.

**Aucun composant `Checkbox` partagé n'existe dans `components/`.** `components/index.ts` n'exporte encore rien (`export {};`) — la case à cocher de la Story 3.4 vit en inline dans `project-view.tsx`/`project-view.module.css`, jamais extraite. Cette story duplique le même pattern plutôt que de créer prématurément une abstraction partagée (cf. convention déjà établie pour `.viewToggle`/`.segmented-control` en Story 4.1 — dupliqué littéralement, pas de nouveau composant générique).

### Project Structure Notes

Fichiers modifiés :
```text
domain/calendar.ts                    # + CalendarFilters, filterTasksForCalendar
domain/index.ts                       # + export CalendarFilters, filterTasksForCalendar
app/general-screen.tsx                # + état de filtre, ProjectFilterControls, filtrage de tasksByDate
app/general-screen.module.css         # + .projectFilters/.filter/.checkboxInput/.checkboxBox/.filterSwatch/.visuallyHidden
```

Aucun fichier créé, aucun fichier supprimé. Aucun changement à `data/local/`, `sync/`, `data/remote/`, `domain/project.ts` (réutilisé tel quel via `groupProjectsByStatus`), ou tout autre écran (`/projects`, `/projects/[id]`, `/login`, capture "+").

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 4.1). Vérification manuelle exhaustive en Task 4, avec attention particulière à la combinaison des deux filtres (sélection de projets actifs + case archivés) et à la persistance du filtre au changement de vue Mois/Semaine (déjà couvert par l'AC#2 de la Story 4.1, maintenant testé avec un état réellement non trivial).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Calendrier général, Story 4.2 (texte exact des 3 AC) ; Story 4.1 Dev Notes (portée exacte, FR-28/FR-31 explicitement hors périmètre 4.1, principe d'état indépendant du mode d'affichage) ; Story 4.3 (FR-30, hors périmètre de cette story)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.7 Calendrier général — FR-28 (filtre multi-projet), FR-31 (exclusion des projets archivés par défaut, réapparition via filtre explicite)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, 4.7 Calendrier général ("components/ (vue mois/semaine), domain/ (agrégation en lecture des tâches à échéance)") ; AD-2 (domain/ sans dépendance IO, direction de dépendance)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Case à cocher — Filtres de tri, cochables indépendamment et combinables") ; State Patterns ("Projet archivé — retiré du sélecteur de capture et du calendrier par défaut ; réapparaît via filtre explicite 'afficher les projets archivés'") ; Information Architecture ("Général — filtre multi-projet")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.checkbox (13px, rayon 4px, bordure muted au repos, fond primary + coche blanche coché) ; colors (project-1..8)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-general-calendar.html — aucune case de filtre ni bouton "afficher les archivés" représentés (légende statique uniquement) ; confirme l'absence de référence visuelle pour cette story, cf. Dev Notes]
- [Source: app/projects/[id]/project-view.tsx — `SortFilterControls`/`.filters`/`.filter`/`.checkboxInput`/`.checkboxBox` (Story 3.4, pattern de case à cocher combinable réutilisé à l'identique) ; project-view.module.css lignes 115-181 (bloc CSS dupliqué littéralement)]
- [Source: app/projects/projects-screen.tsx — `groupProjectsByStatus` déjà utilisé pour scinder actifs/archivés (Story 2.2), réutilisé tel quel ici pour peupler `activeProjects`/`archivedCount`]
- [Source: app/general-screen.tsx (Story 4.1) — `GeneralScreen`, `tasksByDate`/`projectsById`/légende déjà en place, seule la source de `tasksByDate` change (tasks → visibleTasks) ; état `viewMode`/`referenceDate` déjà indépendant du filtre à venir, principe étendu ici à `selectedProjectIds`/`showArchivedProjects`]
- [Source: domain/calendar.ts (Story 4.1) — `groupTasksByDueDate`, `tasksWithDueDate` ; domain/project.ts — `Project.status: ProjectStatus`, `groupProjectsByStatus` (Story 2.2, actifs en premier, archivés regroupés)]
- [Source: domain/task.ts — `Task.projectId: string | null` (FR-2, tâche générale, cf. traitement dans `filterTasksForCalendar`)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre.
- `npx tsc --noEmit` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker).
- Le code réel de `app/general-screen.tsx`/`app/general-screen.module.css` avait divergé du texte littéral de la Story 4.1 (corrections de revue de code appliquées avant cette story : `taskLoadError`/`projectLoadError` séparés au lieu d'un `loadError` unique, garde `bothLoaded` avant lecture de `tasksByDate`, structure de grille `role="row"`/`.week`/`chunkIntoWeeks` conforme WAI-ARIA Grid, `formatCellLabel` incluant la priorité, `.weekdayRow` renommé en `.week`/`.weekdayHeader`). Les Tasks 2 et 3 de cette story ont donc été adaptées au code réel plutôt qu'au texte prescrit littéralement (points d'insertion différents : avant `.grid`/`role="grid"` au lieu de `.weekdayRow`, état ajouté après `projects` au lieu d'après `loadError`) — comportement final identique à celui décrit par la story, sans aucune régression sur les correctifs déjà en place.
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` (démarré via `preview_start`) et le projet Supabase de production réel (session déjà authentifiée, mot de passe jamais saisi par l'agent, cf. règle de sécurité).
- Données de test : réutilisation des projets "Test Story 4.1"/"Test Story 3.3" (actifs, déjà existants) et du projet archivé "Test story 3.2 - projet sync" — désarchivé temporairement pour lui créer une tâche à échéance ("Tâche projet archivé 4.2", 14 août 2026, priorité Normale), puis ré-archivé. Tâche "Sans projet" (25 août 2026) déjà existante d'une story précédente, réutilisée telle quelle.
- **AC#1 vérifiée** : cocher "Test Story 4.1" seul → seules ses tâches (20 août, 5 septembre) restent visibles dans la grille et la légende, "Test Story 3.3" et "Sans projet" disparaissent. Cocher aussi "Test Story 3.3" → ses tâches (1er août, 22 août) réapparaissent (combinaison additive, pas exclusivité) ; "Sans projet" reste masquée (décision de conception documentée dans les Dev Notes). Décocher les deux → retour à l'état par défaut.
- **AC#2 vérifiée** : à l'état par défaut (aucune case cochée), la tâche du 14 août (projet archivé) n'apparaît nulle part dans la grille ni dans la légende.
- **AC#3 vérifiée** : cocher "Afficher les projets archivés (1)" → la tâche du 14 août réapparaît, "Test story 3.2 - projet sync" apparaît dans la légende. Combinaison vérifiée : avec "Test Story 4.1" ET "Afficher les projets archivés" cochés simultanément, la tâche archivée (14 août) reste visible indépendamment de la sélection active, pendant que seule "Test Story 4.1" reste filtrée parmi les projets actifs ("Test Story 3.3" masquée).
- Persistance du filtre au changement de vue vérifiée : sélection conservée (et grille filtrée en conséquence) après bascule Mois → Semaine → Mois et navigation précédent/suivant (Août → Septembre → Août).
- Accessibilité clavier vérifiée réellement (pas seulement supposée) : `Tab` depuis le bouton "Période suivante" amène le focus sur la première case de filtre, `Espace` la coche/décoche — la grille et la légende se mettent à jour en conséquence, confirmé via `read_page`/`get_page_text` avant/après.
- Non-régression vérifiée : switcher Général/Projets et FAB "+" toujours accessibles, légende cliquable toujours fonctionnelle vers `/projects/{id}`, couleur par projet et puce de priorité (Story 4.1) inchangées sur les tâches restant visibles, aucun bouton "+ Nouveau projet" ajouté. `read_console_messages` sans erreur, `preview_logs` sans erreur serveur.
- **Suppression des données de test** : aucun mécanisme de suppression de tâche n'existe dans l'app (même constat que les Stories 4.1/3.6). La tâche "Tâche projet archivé 4.2" (14 août 2026, projet "Test story 3.2 - projet sync") créée pour cette vérification reste donc en base (IndexedDB + Supabase) à la fin de la session — à retirer manuellement par Guillaume via le Table Editor Supabase s'il le souhaite. Le projet lui-même a été remis dans son état d'origine (archivé).

### Completion Notes List

- Toutes les tâches (1 à 4) complètes. Les 3 AC vérifiées en conditions réelles contre le projet Supabase de production, y compris la combinaison des deux filtres et la persistance au changement de vue.
- Écart entre le texte littéral des Tasks 2/3 de la story et le code réel (déjà modifié par la revue de code de la Story 4.1) — adapté sans changer le comportement prescrit, documenté ci-dessus (Debug Log).
- Décisions de conception de la story appliquées sans déviation : case "Afficher les projets archivés" indépendante de la sélection active (aucune sélection archivée individuelle), tâche "Sans projet" masquée dès qu'un filtre de projet actif est sélectionné.
- Aucune déviation de portée : aucun bouton "+ Nouveau projet" ajouté (FR-30, Story 4.3, hors périmètre).
- Aucun framework de test automatisé dans ce projet — vérification manuelle exhaustive documentée ci-dessus, cohérente avec les Stories 1.1 à 4.1.
- Aucune nouvelle dépendance ajoutée.
- **Action restante pour Guillaume** : supprimer si souhaité la tâche de test créée pendant la vérification ("Tâche projet archivé 4.2", 14 août 2026) ; aucune suppression de tâche n'étant possible depuis l'UI, un nettoyage direct dans Supabase Table Editor est nécessaire.

### File List

**Modifiés :**
- `domain/calendar.ts` (+ `CalendarFilters`, `filterTasksForCalendar`, import de `Project`)
- `domain/index.ts` (+ export `CalendarFilters`, `filterTasksForCalendar`)
- `app/general-screen.tsx` (+ état `selectedProjectIds`/`showArchivedProjects`, `toggleProjectFilter`, filtrage de `tasksByDate` via `filterTasksForCalendar`, composant `ProjectFilterControls`)
- `app/general-screen.module.css` (+ `.projectFilters`/`.visuallyHidden`/`.filter`/`.checkboxInput`/`.checkboxBox`/`.filterSwatch`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-18 : Implémentation complète (Tasks 1 à 4). Filtre multi-projet (`domain/calendar.ts` — `CalendarFilters`, `filterTasksForCalendar`, pure, sans dépendance IO) et panneau de cases à cocher (`app/general-screen.tsx` — `ProjectFilterControls`, réutilisant littéralement le pattern de case à cocher de la Story 3.4) intégrés à l'écran Général. Sélection multi-projet combinable (AC#1), exclusion des projets archivés par défaut (AC#2), case "Afficher les projets archivés" indépendante de la sélection active (AC#3) — toutes vérifiées en conditions réelles, y compris leur combinaison. État de filtre indépendant du mode d'affichage Mois/Semaine, conformément au principe établi par la Story 4.1. Légende déjà existante (Story 4.1) reflète automatiquement le filtre sans changement de son propre code. `npm run build`/`npm run lint`/`tsc --noEmit` propres. Statut passé à `review`.
- 2026-08-19 : Revue de code (3 couches parallèles — Blind Hunter, Edge Case Hunter, Acceptance Auditor — sur un diff scopé exactement à cette story). 1 décision tranchée par Guillaume (tâches "Sans projet" restent masquées sous filtre actif — comportement confirmé, aucun changement de code). 3 patchs appliqués : réconciliation de `selectedProjectIds` contre les projets actifs avant filtrage (corrige un filtre fantôme si un projet sélectionné est archivé pendant que le calendrier reste monté, scénario multi-appareil via la synchro live) ; `aria-label` du groupe de filtres corrigé ("Filtrer le calendrier" au lieu de "... par projet", n'engobe plus incorrectement la case archivés) ; commentaire d'en-tête de `domain/calendar.ts` clarifié sur la portée d'AD-2. 1 item différé (3e duplication du pattern de case à cocher, consigné dans `deferred-work.md`). 6 findings rejetés comme bruit ou décisions déjà documentées. `npm run build`/`npm run lint`/`tsc --noEmit` propres après application des patchs. Statut passé à `done`.
