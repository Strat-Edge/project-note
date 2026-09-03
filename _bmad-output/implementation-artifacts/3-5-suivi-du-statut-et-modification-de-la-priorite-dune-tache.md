---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 3.5: Suivi du statut et modification de la priorité d'une tâche

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want faire évoluer le statut d'une tâche et changer sa priorité après coup,
so that mon suivi reste à jour sans avoir à recréer la tâche.

## Acceptance Criteria

1. **Given** une tâche existante **When** je tape un segment de statut (à faire / en cours / terminé) **Then** son statut change immédiatement, sans ordre imposé
2. **Given** une tâche existante **When** je modifie sa priorité depuis son détail **Then** la nouvelle priorité est enregistrée et reflétée partout où elle est affichée
3. **Given** une tâche avec une échéance **When** elle est créée ou modifiée **Then** elle porte les données nécessaires à son affichage dans le calendrier général (Epic 4)

## Tasks / Subtasks

- [x] Task 1: Mutations pures dans `domain/task.ts` (AC: #1, #2)
  - [x] Ajouter, juste après `openTask` (même style de fonction pure "transforme et retourne une copie") :
    ```ts
    export function setTaskStatus(task: Task, status: TaskStatus): Task {
      return { ...task, status };
    }

    export function setTaskPriority(task: Task, priority: Priority): Task {
      return { ...task, priority };
    }
    ```
  - [x] Exporter les deux depuis `domain/index.ts`, à côté de `openTask` dans le bloc `export { validateTaskTitle, canSetReminder, openTask, isTaskOverdue, sortTasksChronologically, sortTasks } from "./task";` — ajouter `setTaskStatus, setTaskPriority` à cette même liste. Ne pas les nommer `updateTaskStatus`/`updateTaskPriority` : ces noms sont réservés à la couche `data/local/` (Task 2) qui écrit réellement en base — garder les deux couches distinctes dans leur nommage évite toute confusion sur "quelle fonction touche Dexie" (même raison que `archiveProject`/`toArchivedProject` dans `data/local/projects.ts`).

- [x] Task 2: Écriture Dexie + file de synchronisation dans `data/local/tasks.ts` (AC: #1, #2)
  - [x] Importer `TaskStatus` (type) et `setTaskStatus`, `setTaskPriority` depuis `@/domain`, à côté des imports existants (`validateTaskTitle`, `canSetReminder`, `openTask`).
  - [x] Ajouter, après `markTaskOpened`, en suivant **exactement** le même gabarit transactionnel que `archiveProject`/`unarchiveProject` (`data/local/projects.ts`) — get-or-throw, transformation pure, `put`, `enqueueField` dans la même transaction :
    ```ts
    export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
      return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
        const existing = await getTaskOrThrow(id);
        if (existing.status === status) {
          return existing;
        }
        const updated = setTaskStatus(existing, status);
        await db.tasks.put(updated);
        await enqueueField(
          {
            entity: "task",
            entityId: id,
            field: "status",
            operation: "update",
            value: updated.status,
            deviceId: getDeviceId(),
          },
          tx,
        );
        return updated;
      });
    }

    export async function updateTaskPriority(id: string, priority: Priority): Promise<Task> {
      return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
        const existing = await getTaskOrThrow(id);
        if (existing.priority === priority) {
          return existing;
        }
        const updated = setTaskPriority(existing, priority);
        await db.tasks.put(updated);
        await enqueueField(
          {
            entity: "task",
            entityId: id,
            field: "priority",
            operation: "update",
            value: updated.priority,
            deviceId: getDeviceId(),
          },
          tx,
        );
        return updated;
      });
    }
    ```
  - [x] Le court-circuit `if (existing.X === X) return existing` **sans** écrire ni mettre en file reproduit le précédent idempotent de `markTaskOpened` ("évite une entrée de file de synchronisation inutile") — appliqué ici à un re-tap sur le segment de statut déjà actif (AC #1 : "tap sur un segment pour basculer directement dessus, pas de cycle forcé" — retaper le segment actif ne doit rien déclencher) et à une re-sélection de la même priorité dans le détail.
  - [x] Exporter `updateTaskStatus, updateTaskPriority` depuis `data/local/index.ts`, à côté de `createTask, listTasksByProject, markTaskOpened` dans le bloc `export { ... } from "./tasks";`.
  - [x] **Ne pas** ajouter de métadonnée `status_updated_at`/`priority_updated_at` sur `Task` — cf. commentaire déjà présent en tête de `domain/task.ts` ("Pas de métadonnée de conflit ici — AD-3 ne s'applique qu'à partir de l'implémentation réelle de sync/, Story 3.2/3.6"). La résolution de conflit par champ (AD-3) est le périmètre exact de la Story 3.6 (à venir), pas de celle-ci — l'entrée de file `{ field: "status" | "priority", ... }` produite ici est déjà tout ce que Story 3.6 consommera, aucune préparation supplémentaire n'est nécessaire ni attendue.

- [x] Task 3: Contrôle de statut sur la carte de tâche — `app/projects/[id]/project-view.tsx` (AC: #1)
  - [x] **Restructurer `TaskCard`** : aujourd'hui toute la carte est un seul `<button className={styles.taskCardButton}>` (Story 3.3/3.4). Le contrôle de statut introduit 3 boutons supplémentaires par carte (un par segment) — les imbriquer dans le bouton existant produirait un `<button>` dans un `<button>` (HTML invalide, comportement clavier/lecteur d'écran cassé). Sortir le contrôle de statut du bouton d'ouverture : celui-ci ne doit plus englober que le contenu "informationnel" (badge, priorité, titre, méta), le contrôle de statut devient un frère du bouton à l'intérieur du même `<li className={styles.taskCard}>` (qui garde `position: relative`, donc `.newBadgeDot` continue à se positionner correctement même en dehors du bouton).
    ```tsx
    function TaskCard({
      task,
      onOpen,
      onStatusChange,
    }: {
      task: Task;
      onOpen: (task: Task) => void;
      onStatusChange: (task: Task, status: TaskStatus) => void;
    }) {
      const overdue = isTaskOverdue(task, new Date());

      return (
        <li className={styles.taskCard}>
          <button
            type="button"
            className={styles.taskCardButton}
            onClick={() => onOpen(task)}
          >
            {task.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {task.isNew ? "Nouveau" : ""}
            </span>

            <div className={styles.taskCardRow}>
              <PriorityChip priority={task.priority} />
              <span className={styles.taskTitle} data-done={task.status === "done"}>
                {task.title}
              </span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{PROVENANCE_LABELS[task.provenance]}</span>
              {task.dueDate && (
                <span className={styles.metaPill} data-overdue={overdue}>
                  {formatDueDate(task.dueDate)}
                  {overdue ? " · en retard" : ""}
                </span>
              )}
            </div>
          </button>

          <StatusRow
            status={task.status}
            onChange={(status) => onStatusChange(task, status)}
          />
        </li>
      );
    }
    ```
    `data-done={task.status === "done"}` sur `.taskTitle` reprend `.task-title.done` du mockup (`key-project-view.html` ligne 243-246, barré + `muted`) — seul ajout visuel non explicitement demandé par une AC, gratuit car le style existe déjà dans le design system référencé par cette même vue (cf. Task 4) et rend le changement de statut visible même quand le contrôle lui-même n'est pas dans le champ visuel immédiat.
  - [x] Ajouter le sous-composant `StatusRow`, même précédent d'imbrication interne que `SortFilterControls`/`PriorityChip` (Story 3.4) — pas de fichier sous `components/` :
    ```tsx
    const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
      { value: "todo", label: "à faire" },
      { value: "in_progress", label: "en cours" },
      { value: "done", label: "terminé" },
    ];

    function StatusRow({
      status,
      onChange,
    }: {
      status: TaskStatus;
      onChange: (status: TaskStatus) => void;
    }) {
      return (
        <div className={styles.statusRow} role="group" aria-label="Statut de la tâche">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.statusOption}
              data-active={status === option.value}
              data-status={option.value}
              aria-pressed={status === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }
    ```
    3 vrais `<button>` avec `aria-pressed`, pas un cycle sur un seul bouton — reprend le précédent déjà établi pour les sélecteurs à choix exclusif de l'app (couleur de projet, étapes de capture : `OptionButton` dans `app/capture-flow.tsx`, `aria-pressed={selected}`), qui n'utilise **pas** de sémantique `radio`/`radiogroup`. `role="group"` (pas `role="radiogroup"`) sur le conteneur pour rester cohérent avec ce même précédent. EXPERIENCE.md est explicite : "tap sur un segment pour basculer directement dessus (pas de cycle forcé)" — chaque segment est une cible indépendante, pas un bouton unique qui boucle.
  - [x] Dans `ProjectView`, ajouter le gestionnaire et le passer à `TaskCard` :
    ```tsx
    async function handleStatusChange(task: Task, status: TaskStatus) {
      try {
        const updated = await updateTaskStatus(task.id, status);
        setTasks((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSelectedTask((current) =>
          current && current.id === updated.id ? updated : current,
        );
      } catch {
        // Échec silencieux assumé — même précédent que handleOpenTask/markTaskOpened
        // (Story 3.3) : une écriture Dexie locale n'échoue en pratique que sur un cas
        // dégénéré (quota/corruption navigateur), jamais sur un problème réseau (AD-1,
        // l'écriture est locale-first) ; il n'existe aujourd'hui aucun mécanisme de
        // bannière d'erreur pour une mutation ponctuelle dans cette vue, en introduire un
        // pour ce seul cas serait hors du périmètre de cette story. Si l'écriture échoue,
        // l'état React n'est pas mis à jour et le segment retombe visuellement sur l'état
        // précédent (aucune mise à jour optimiste ici) — comportement silencieux mais jamais
        // trompeur.
      }
    }
    ```
    Mettre à jour `tasks` **et** `selectedTask` (contrairement à `handleOpenTask`, qui ne touchait que `tasks`) : le contrôle de statut vit sur la carte, mais si la fiche détail de cette même tâche est ouverte en parallèle, elle affiche `task.title` avec `data-done` dérivé de `task.status` — sans cette double mise à jour, rouvrir/refermer la fiche après un changement de statut fait via la carte afficherait un état obsolète jusqu'au prochain rechargement.
    `handleStatusChange` n'est **pas** un no-op précoce côté UI (le court-circuit "même valeur" vit déjà dans `updateTaskStatus`, Task 2) — inutile de dupliquer la vérification ici.
  - [x] Passer `onStatusChange={handleStatusChange}` à chaque `<TaskCard>` dans le rendu de la liste.
  - [x] Importer `updateTaskStatus` depuis `@/data/local` et le type `TaskStatus` depuis `@/domain` en tête de fichier.

- [x] Task 4: Sélecteur de priorité dans le détail — `app/projects/[id]/project-view.tsx` (AC: #2)
  - [x] Dans `TaskDetail`, remplacer le `<PriorityChip priority={task.priority} />` statique (actuellement affiché à côté du titre dans `.detailHeader`) par un sélecteur interactif à 3 options, en reprenant **le même précédent visuel déjà établi** pour le choix de priorité en capture (`app/capture-flow.tsx`, étape 2/3, `OptionButton` + `PRIORITY_OPTIONS`) plutôt qu'en inventer un nouveau : liste verticale de 3 lignes sélectionnables, fond coloré par niveau, bordure `--color-primary` sur l'option sélectionnée.
    ```tsx
    const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
      { value: "low", label: "Basse" },
      { value: "normal", label: "Normale" },
      { value: "high", label: "Haute" },
    ];

    function PrioritySelector({
      priority,
      onChange,
    }: {
      priority: Priority;
      onChange: (priority: Priority) => void;
    }) {
      return (
        <div className={styles.prioritySelector} role="group" aria-label="Priorité de la tâche">
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.priorityOption}
              data-priority={option.value}
              data-selected={priority === option.value}
              aria-pressed={priority === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }
    ```
  - [x] `TaskDetail` reçoit désormais aussi `onPriorityChange: (task: Task, priority: Priority) => void` en prop ; dans `.detailHeader`, remplacer `<PriorityChip priority={task.priority} />` par rien (le titre reste seul dans le header) et insérer `<PrioritySelector priority={task.priority} onChange={(priority) => onPriorityChange(task, priority)} />` juste après `.detailHeader` (avant `task.description`) — la puce compacte (`PriorityChip`, 20px, une lettre) reste utilisée telle quelle sur la **carte** (lecture seule, Story 3.3/3.4) ; le sélecteur du détail est un composant distinct, plus grand, pensé pour l'interaction (même logique de duplication délibérée déjà suivie pour `.filters`/`.checkboxBox` en Story 3.4 : pas de composant partagé forcé entre deux usages différents — lecture vs. édition — d'un même concept).
  - [x] Dans `ProjectView`, ajouter :
    ```tsx
    async function handlePriorityChange(task: Task, priority: Priority) {
      try {
        const updated = await updateTaskPriority(task.id, priority);
        setTasks((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSelectedTask((current) =>
          current && current.id === updated.id ? updated : current,
        );
      } catch {
        // Même rationale que handleStatusChange (Task 3).
      }
    }
    ```
    Mettre à jour `tasks` (AC #2 : "reflétée partout où elle est affichée" — la puce de priorité de la carte, le tri "Prioritaire" actif, Story 3.4) **et** `selectedTask` (le sélecteur du détail lui-même doit refléter la sélection sans fermer/rouvrir la fiche).
  - [x] Passer `onPriorityChange={handlePriorityChange}` à `<TaskDetail>` dans le rendu de `ProjectView`, et importer `updateTaskPriority` depuis `@/data/local`.

- [x] Task 5: Styles `app/projects/[id]/project-view.module.css` (AC: #1, #2, Accessibility Floor)
  - [x] `.statusRow` — piste à 3 segments (`DESIGN.md.components.status-row` + layout de `mockups/key-project-view.html` `.status-row`) : `display: flex; margin-top: var(--space-2); background: var(--color-bg-alt); border-radius: var(--radius-md); padding: 2px;` avec `background: var(--color-surface-2-dark)` en sombre (`status-row.track-bg-dark`). `margin-top` remplace le `margin-top:10px` littéral du mockup — utiliser le token le plus proche (`--space-2` = 8px) plutôt qu'une valeur littérale isolée, cohérent avec le reste de ce fichier qui n'a que 2 valeurs littérales assumées et documentées (badge 11/-4px, checkbox 4px) ; 10px n'a pas de justification propre qui manquerait au token voisin.
  - [x] `.statusOption` — chaque segment : `flex: 1; min-height: 44px; display: flex; align-items: center; justify-content: center; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--color-muted); font-size: var(--font-micro-size); font-weight: var(--font-micro-weight); letter-spacing: var(--font-micro-letter-spacing); text-transform: uppercase; cursor: pointer;` avec `color: var(--color-muted-dark)` en sombre. **`min-height: 44px` déroge à la hauteur visuelle fine du mockup** (`padding: 6px 0` sur une police 9.5px, track total ≈ 30px) — même dérogation documentée que `.filter`/`.checkboxBox` en Story 3.4 (Accessibility Floor, "cibles tactiles ≥44px... y compris les segments de statut", `EXPERIENCE.md` ligne 111) : ici c'est le bouton entier (pas un `<label>` autour d'un input cette fois, un vrai `<button>`) qui doit atteindre 44px, la police/le padding visuels restent ceux du mockup.
  - [x] `.statusOption[data-active="true"]` — `background: var(--color-primary); color: var(--color-on-primary);` (segments "à faire"/"en cours" actifs).
  - [x] `.statusOption[data-active="true"][data-status="done"]` — `background: var(--color-secondary); color: var(--color-priority-normale-text);` (segment "terminé" actif — reprend `.status-opt.active.done-state` du mockup et `status-row.active-done-bg`/`stepper.step-done-text` de `DESIGN.md`, seule paire de tokens du fichier qui utilise déjà `--color-priority-normale-text` comme couleur de texte sur fond secondaire, cf. `.stepDot[data-state="done"]` équivalent dans `app/capture-flow.module.css` si présent, sinon valeur reprise directement de `DESIGN.md.components.stepper.step-done-text`).
  - [x] Pas de `:focus-visible` custom sur `.statusOption` — même traitement que `.tab` (Story 3.3, aucun style de focus personnalisé), contrairement à `.checkboxInput` (Story 3.4) qui en avait besoin uniquement parce que l'input natif était visuellement masqué. Ici le bouton est pleinement visible, l'anneau de focus par défaut du navigateur suffit.
  - [x] `.taskTitle[data-done="true"]` — `color: var(--color-muted); text-decoration: line-through;` avec `color: var(--color-muted-dark)` en sombre (reprend `.task-title.done` du mockup à l'identique).
  - [x] `.prioritySelector` — conteneur du sélecteur de priorité dans le détail : `display: flex; flex-direction: column; gap: var(--space-2);` (reprend `.optionList` de `app/capture-flow.module.css`, dupliqué ici plutôt que partagé — même convention établie en Story 3.3/3.4 pour ce fichier).
  - [x] `.priorityOption` — chaque ligne sélectionnable : reprendre **littéralement** les valeurs de `.option`/`.option[data-priority="..."]` de `app/capture-flow.module.css` (`min-height: 48px; padding: var(--space-2) var(--space-3); border: 2px solid var(--color-border); border-radius: var(--radius-default); text-align: left; font-size: var(--font-body-size); font-weight: var(--font-body-weight); cursor: pointer;`, fond/texte par niveau via `data-priority="low"|"normal"|"high"` identiques à `capture-flow.module.css` lignes 172-191 y compris la variante sombre de `low`) et `.priorityOption[data-selected="true"] { border-color: var(--color-primary); }`. Dupliqué (pas importé depuis `capture-flow.module.css`, CSS Modules ne s'y prête pas nativement) — même précédent de duplication assumée que le reste de ce fichier.

- [x] Task 6: AC #3 — vérification, aucun code (AC: #3)
  - [x] **Ne rien implémenter pour cette AC.** `Task.dueDate` (ISO 8601 UTC) existe déjà depuis la Story 3.1, et `Project.color` depuis l'Epic 2 — ce sont les deux seules données que FR-11 ("apparition automatique dans le calendrier général, colorée selon son projet") et FR-32 ("indicateur visuel de priorité dans le calendrier, sans affecter le positionnement") nécessitent pour un calendrier qui lit ces champs en Epic 4 ; `Task.priority` existe aussi déjà depuis la Story 3.1. Aucune colonne/champ calendrier-spécifique n'existe ni n'est nécessaire sur `Task` — le calendrier (Epic 4, à venir) sera un affichage en lecture des tâches déjà existantes, agrégées par date, sans écriture ni schéma supplémentaire côté `Task`.
  - [x] Documenter cette AC comme déjà satisfaite dans les Dev Notes de la story (fait, cf. ci-dessous) : elle ne doit générer ni nouveau code ni nouvelle route, seulement une confirmation explicite que rien ne manque au modèle de données pour Epic 4.

- [x] Task 7: Vérification manuelle de bout en bout (AC #1 à #3)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Réutiliser un projet de test existant avec plusieurs tâches (statuts et priorités variés) — ou en créer si besoin.
  - [x] AC #1 : sur une carte, taper chaque segment de statut (à faire → en cours → terminé, dans n'importe quel ordre, y compris "reculer" de terminé à à faire) → le segment tapé devient actif immédiatement (fond primary, ou secondary pour "terminé"), les deux autres redeviennent neutres ; le titre de la tâche devient barré/atténué quand "terminé" est actif, redevient normal sinon. Re-taper le segment déjà actif ne change rien visuellement (pas d'erreur, pas de scintillement).
  - [x] AC #1 (non-régression tri) : avec le filtre "Chronologique" actif (Story 3.4), faire passer une tâche à "terminé" ne doit **pas** la faire disparaître de la liste ni changer son tri — le statut n'entre dans aucun critère de `sortTasks` (seuls `createdAt`/`priority` y participent, inchangé par cette story).
  - [x] AC #1 (indicateur "en retard") : faire passer une tâche en retard (échéance passée, statut ≠ terminé) à "terminé" via le contrôle de statut → la puce "· en retard" disparaît immédiatement (comportement déjà couvert par `isTaskOverdue`, Story 3.3, revérifié ici car c'est la première fois que le statut change réellement en cours de session plutôt qu'à la création).
  - [x] AC #2 : ouvrir le détail d'une tâche → le sélecteur de priorité affiche la priorité actuelle sélectionnée (bordure primary) ; taper une autre option → la sélection change immédiatement dans le détail, **et** en fermant le détail, la puce de priorité de la carte correspondante dans la liste reflète la nouvelle valeur sans rechargement.
  - [x] AC #2 (tri "Prioritaire") : avec le filtre "Prioritaire" actif (Story 3.4), changer la priorité d'une tâche depuis son détail → à la fermeture du détail, la tâche a changé de position dans la liste selon son nouveau niveau de priorité.
  - [x] AC #3 : confirmer par lecture de `domain/task.ts` que `Task.dueDate`/`Task.priority` et `Project.color` existent déjà — aucune vérification en navigateur possible ni nécessaire (aucun calendrier à observer avant l'Epic 4).
  - [x] Vérifier au clavier : chaque segment de statut et chaque option de priorité est atteignable au Tab, activable à l'Espace/Entrée (vrais `<button>`), anneau de focus visible par défaut du navigateur.
  - [x] Vérifier la non-régression : ouverture/fermeture du détail (badge "nouveau", piège à focus), 3 onglets, tri combinable (Story 3.4), onglets Documents/Notes toujours "Bientôt disponible.". Aucune erreur console.
  - [x] Vérifier le responsive : mobile (375px) et desktop (1280px) — les 3 segments de statut restent lisibles et tactiles sur mobile, le sélecteur de priorité (3 lignes empilées) ne déborde pas dans la modale de détail (mobile plein écran / desktop carte centrée, inchangé).

### Review Findings

- [x] [Review][Patch] Le piège à focus de `TaskDetail` se ré-exécute à chaque changement de priorité, sortant brièvement le focus du dialogue [app/projects/[id]/project-view.tsx:487] — corrigé : dépendance de `useEffect` passée de `[task]` à `[task?.id]`
- [x] [Review][Defer] `selectedTask.isNew` n'est jamais resynchronisé après `markTaskOpened` [app/projects/[id]/project-view.tsx:161-170] — déjà présent en Story 3.3, non touché par cette story
- [x] [Review][Defer] `TaskDetail` n'a ni fermeture par Échap ni clic en dehors du panneau [app/projects/[id]/project-view.tsx:463-556] — déjà présent en Story 3.3, non touché par cette story
- [x] [Review][Defer] `role="tab"` n'implémente pas le pattern clavier complet ARIA APG (flèches, roving tabindex) [app/projects/[id]/project-view.tsx:212-232] — déjà présent en Story 3.3, non touché par cette story
- [x] [Review][Defer] `isTaskOverdue` n'est réévalué qu'au rendu, sans minuteur [domain/task.ts, app/projects/[id]/project-view.tsx] — déjà présent en Story 3.3, non touché par cette story
- [x] [Review][Defer] `formatDueDate` est fragile au changement de fuseau horaire [app/projects/[id]/project-view.tsx] — déjà présent en Story 3.3, non touché par cette story
- [x] [Review][Defer] Géométrie CSS de la coche de case à cocher en valeurs magiques sans marge de sécurité [app/projects/[id]/project-view.module.css:166-174] — déjà présent en Story 3.4, non touché par cette story

## Dev Notes

**Cette story reste petite malgré le nombre de tâches : aucune nouvelle route, aucun nouveau fichier, aucune nouvelle table Dexie, aucune modification de schéma (`data/local/db.ts` inchangé).** Elle ajoute deux mutations (statut, priorité) sur une entité `Task` déjà entièrement modélisée (Story 3.1) et déjà affichée (Story 3.3/3.4). Le seul risque réel de complexité est **UI** (restructuration de `TaskCard` pour éviter un bouton dans un bouton), pas données ni synchronisation.

**AC #3 ne demande aucun code.** Voir Task 6 — `Task.dueDate`, `Task.priority` et `Project.color` existent déjà depuis la Story 3.1/Epic 2. Ne pas anticiper Epic 4 (vue calendrier) en créant des champs, une route, ou un composant calendrier prématurément : cette AC valide seulement que le modèle de données actuel n'a **rien** à changer, ce qui est déjà vrai.

**Statut ≠ tri, ne pas les mélanger.** `sortTasks`/`SortFilters` (Story 3.4) ne connaissent que `createdAt`/`priority` — le statut n'est un critère de tri nulle part dans les 5 AC de la Story 3.4 ni dans celle-ci. Changer le statut d'une tâche ne doit jamais réordonner la liste au-delà de ce que son `createdAt`/`priority` (inchangés par cette story) déterminent déjà.

**Le contrôle de statut vit sur la carte (`TaskCard`), pas dans le détail (`TaskDetail`).** `EXPERIENCE.md` Component Patterns est explicite : "Contrôle de statut | **Carte de tâche** | 3 segments...". La modification de priorité, à l'inverse, vit exclusivement dans le détail — l'AC #2 le dit explicitement ("depuis son détail"). Ne pas dupliquer l'un dans l'autre (pas de contrôle de statut dans la modale, pas de sélecteur de priorité sur la carte) : chaque mutation a un seul point d'entrée UI, cohérent avec le mockup `key-project-view.html` (statut visible sur chaque carte de la liste) et avec le texte des ACs.

**Pourquoi `TaskCard` doit être restructuré (pas juste étendu).** Depuis la Story 3.3, toute la carte est un unique `<button className={styles.taskCardButton}>` qui ouvre le détail au clic — l'intégralité du contenu de la carte (titre, priorité, méta) est à l'intérieur de ce bouton. Le contrôle de statut de cette story ajoute 3 boutons supplémentaires *par carte* ; les placer à l'intérieur du bouton existant produirait un `<button>` imbriqué dans un `<button>`, invalide en HTML et qui casse le comportement clavier/lecteur d'écran (le bouton externe intercepterait les clics destinés aux boutons internes selon les navigateurs). La restructuration de Task 3 sort le contrôle de statut du bouton d'ouverture, comme frère direct dans le même `<li>`.

**Aucune mise à jour optimiste, échec silencieux assumé pour les deux mutations.** Même précédent que `handleOpenTask`/`markTaskOpened` (Story 3.3) : `updateTaskStatus`/`updateTaskPriority` écrivent dans Dexie (IndexedDB), pas sur le réseau — une écriture locale n'échoue en pratique jamais dans l'usage normal de l'app (AD-1, écriture locale d'abord). En cas d'échec (cas dégénéré, quota/corruption), l'état React n'est pas mis à jour et l'UI retombe silencieusement sur l'état précédent — aucune bannière d'erreur introduite pour ce cas, cohérent avec l'absence de tout mécanisme de ce type ailleurs dans cette vue.

**Court-circuit idempotent dans `data/local/tasks.ts`, pas dans les gestionnaires `app/`.** `updateTaskStatus`/`updateTaskPriority` ne réécrivent rien ni ne mettent rien en file si la valeur est déjà celle demandée (même précédent que `markTaskOpened`) — cette vérification vit dans la couche `data/local/`, pas dupliquée dans `handleStatusChange`/`handlePriorityChange` de `project-view.tsx`.

**`selectedTask` doit être mis à jour en plus de `tasks`, contrairement au précédent `handleOpenTask`.** `handleOpenTask` (Story 3.3) ne mettait à jour que `tasks` car `markTaskOpened` porte sur `isNew`, un champ qui n'est pas affiché dans `TaskDetail`. Ici, `TaskDetail` affiche directement `task.priority` (via `PrioritySelector`) et potentiellement le statut (via `data-done` sur le titre si le détail est rouvert) — sans mettre à jour `selectedTask` en parallèle de `tasks`, la fiche détail resterait affichée avec une valeur obsolète tant qu'elle n'est pas refermée/rouverte.

**Pas de sémantique `radio`/`radiogroup` pour le contrôle de statut ni le sélecteur de priorité.** Suit le précédent déjà établi par `OptionButton` (`app/capture-flow.tsx`, sélection de projet/priorité en capture) : boutons indépendants avec `aria-pressed`, conteneur `role="group"`. La Story 3.4 avait fait un choix différent pour les filtres de tri (vraie sémantique `checkbox`) car ce sont des cases indépendantes et combinables ; ici, comme pour `OptionButton`, il s'agit d'un choix exclusif parmi plusieurs options — le précédent le plus proche et le plus récent dans la base de code est `OptionButton`, pas `SortFilterControls`.

### Project Structure Notes

Fichiers à modifier (aucun fichier créé) :
```text
domain/task.ts                              # + setTaskStatus, setTaskPriority
domain/index.ts                             # + export setTaskStatus, setTaskPriority
data/local/tasks.ts                         # + updateTaskStatus, updateTaskPriority
data/local/index.ts                         # + export updateTaskStatus, updateTaskPriority
app/projects/[id]/project-view.tsx          # TaskCard restructuré (+StatusRow), TaskDetail (+PrioritySelector), handleStatusChange, handlePriorityChange
app/projects/[id]/project-view.module.css   # + .statusRow, .statusOption (+variantes), .taskTitle[data-done], .prioritySelector, .priorityOption (+variantes)
```

Aucun changement à `data/local/db.ts` (schéma Dexie inchangé — pas de nouvelle version), `data/remote/`, `sync/`, `components/`, ou tout autre écran (`/projects`, `/login`, capture "+"). `domain/sync.ts`/`SyncEntity` restent `"project" | "task"` — cette story n'introduit aucune nouvelle entité de synchronisation, seulement deux nouveaux `field` (`"status"`, `"priority"`) sur l'entité `"task"` déjà existante.

### Testing Standards

Aucun framework de test automatisé n'est imposé par l'Architecture (identique aux Stories 1.1 à 3.4). Vérification manuelle exhaustive en Task 7 : les 3 AC testées individuellement en navigateur (AC #1/#2) ou par lecture de code (AC #3, rien d'observable). Navigation clavier (Tab + Espace/Entrée sur de vrais `<button>`, pas de piège focus à gérer ici contrairement à `TaskDetail` dont le piège existant, Story 3.3, reste inchangé) et responsive vérifiés selon les mêmes standards que les contrôles interactifs précédents (Story 3.4).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3: Capture universelle & Tâches, Story 3.5 (texte exact des 3 AC)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md — FR-13 "Suivi du statut" ("Le changement de statut est manuel, à tout moment, sans ordre imposé"), FR-14 "Modification de la priorité après coup" ("La priorité assignée à la capture reste modifiable directement sur la tâche, à tout moment"), FR-11 "Apparition automatique dans le calendrier général" (base de l'AC #3, satisfaite par le schéma existant)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, 4.3 Tâches — FR-10 à FR-14 ("`domain/` (statut, priorité), `sync/` (conflit par champ sur status/priority)") ; AD-3 (résolution de conflit par champ — champs concernés listés explicitement : "Task.status, priority partagée Task/Note/Document" — confirme que `status`/`priority` sont bien les noms de `field` attendus dans l'enveloppe de synchronisation, périmètre de résolution réel = Story 3.6, pas celle-ci) ; Consistency Conventions (naming enums `status: 'todo' | 'in_progress' | 'done'`, `priority: 'low' | 'normal' | 'high'`, déjà respectés par `domain/task.ts`/`domain/capture.ts` existants)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Contrôle de statut | Carte de tâche | 3 segments (à faire / en cours / terminé), tap pour changer, aucun ordre imposé.", "Puce de priorité | Toute carte + étape 2 du flux \"+\" | ... toujours visible indépendamment du tri actif."), Interaction Primitives ("Contrôle de statut : tap sur un segment pour basculer directement dessus (pas de cycle forcé)."), Accessibility Floor ("cibles tactiles ≥44px... y compris les segments de statut")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter `components.status-row` (track-bg/track-bg-dark, track-radius md, active-bg primary, active-done-bg secondary), `components.stepper.step-done-text` (texte sur fond secondary, réutilisé pour le segment "terminé" actif), `components.priority-chip` (radius sm, 20px — inchangé, reste utilisée sur la carte en lecture seule), section Components ("Contrôle de statut (à faire / en cours / terminé) — piste à 3 segments dans un bloc neutre, segment actif en fond plein (primaire pour à faire/en cours, secondaire pour terminé)."), Do's and Don'ts ("Do garder le sélecteur segmenté en un seul bloc visuel — jamais trois boutons séparés" — s'applique au *rendu visuel* du track, pas à la structure DOM : le mockup lui-même implémente le contrôle de statut avec 3 `<div class="status-opt">` distincts dans un conteneur commun, ce que cette story reproduit avec de vrais `<button>` pour l'accessibilité)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-project-view.html — lignes 282-301 (`.status-row`/`.status-opt`/`.status-opt.active.done-state`, valeurs CSS exactes), lignes 349-366 (markup d'une carte avec statut "à faire" actif), lignes 243-246 (`.task-title.done`, barré/atténué)]
- [Source: app/capture-flow.tsx — `OptionButton` (lignes 573-605) et `PRIORITY_OPTIONS` (étape 2/3 de la capture) : précédent direct et le plus proche pour un sélecteur de priorité à 3 options exclusives, réutilisé à l'identique (visuel et sémantique `aria-pressed`) pour `PrioritySelector` dans le détail de tâche]
- [Source: app/capture-flow.module.css — `.optionList`/`.option`/`.option[data-priority="..."]`/`.optionSwatch` (lignes 142-198), valeurs dupliquées littéralement dans `project-view.module.css` pour `.prioritySelector`/`.priorityOption`]
- [Source: _bmad-output/implementation-artifacts/3-4-tri-combinable-dans-la-vue-projet.md — Dev Notes (précédent de duplication CSS par fichier plutôt que composant partagé ; précédent de dérogation documentée à une consigne littérale, ici réutilisé pour `min-height: 44px` sur `.statusOption` ; sous-composants internes non extraits sous `components/`) ; Review Findings (réinitialisation d'état au changement de projet — `sortFilters` réinitialisé dans le `useEffect` de chargement, `selectedTask`/`activeTab` aussi — inchangé par cette story, aucune nouvelle réinitialisation à ajouter puisqu'aucun nouvel état local persistant n'est introduit ici)]
- [Source: data/local/projects.ts — `archiveProject`/`unarchiveProject` (get-or-throw + transformation pure + `db.X.put` + `enqueueField` dans une même transaction `db.transaction("rw", ...)`), gabarit repris à l'identique pour `updateTaskStatus`/`updateTaskPriority`]
- [Source: data/local/tasks.ts — `markTaskOpened` (court-circuit idempotent avant écriture, gabarit repris pour le "déjà à cette valeur" de cette story) ; `getTaskOrThrow` existante, réutilisée telle quelle]
- [Source: domain/sync.ts — `SyncEntity = "project" | "task"` (inchangé), enveloppe `SyncQueueEntry` (les nouveaux appels `enqueueField` de cette story respectent la forme exacte déjà en vigueur, aucune extension nécessaire)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques).
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` déjà actif (Guillaume authentifié lui-même au préalable, mot de passe jamais saisi par l'agent — même règle de sécurité que les stories précédentes). Projet de test réutilisé ("Test Story 3.3", déjà présent, 4 tâches couvrant les 3 niveaux de priorité, une tâche en retard et une tâche "nouveau").
- Scénarios vérifiés en navigateur : AC#1 (chaque segment de statut change l'état immédiatement, visuellement — fond primary pour à faire/en cours, secondary pour terminé — et via `aria-pressed`/`data-active` ; le titre devient barré/atténué via `data-done` quand "terminé" est actif ; non-régression du tri Chronologique/Prioritaire — Story 3.4 — confirmée après changement de statut ; la puce "· en retard" disparaît immédiatement quand une tâche en retard passe à "terminé"). AC#2 (le sélecteur de priorité du détail reflète la sélection immédiatement — bordure `--color-primary` — et la carte correspondante dans la liste, y compris son tri sous le filtre "Prioritaire", reflète la nouvelle priorité sans rechargement après fermeture du détail). AC#3 : confirmée par lecture de code (`domain/task.ts`, `domain/project.ts`) — `Task.dueDate`/`Task.priority` et `Project.color` existent déjà depuis la Story 3.1/Epic 2, aucune vérification en navigateur possible ni nécessaire avant l'Epic 4 (calendrier).
- Structure DOM vérifiée par inspection directe (`outerHTML`) : le contrôle de statut (`role="group"`, 3 `<button aria-pressed>`) est bien un frère du bouton d'ouverture du détail à l'intérieur du même `<li>`, jamais imbriqué dedans — confirme l'absence de `<button>` dans `<button>`.
- Focus clavier par défaut du navigateur confirmé disponible sur `.statusOption`/`.priorityOption` par inspection CSS (`app/projects/[id]/project-view.module.css` : aucune règle `outline` sur ces classes, aucune règle `outline: none` globale dans `app/globals.css`) — cohérent avec `.tab` (Story 3.3), pas de `:focus-visible` custom nécessaire ici contrairement à `.checkboxInput` (Story 3.4, input visuellement masqué).
- Responsive vérifié : mobile (375px) — pas de débordement horizontal (`scrollWidth === clientWidth`), chaque segment de statut mesure 44px de hauteur (Accessibility Floor), chaque option de priorité du détail mesure 48px, la modale reste plein écran sans backdrop (inchangé). Desktop (1280px) — layout inchangé par rapport aux stories précédentes.
- Non-régression vérifiée : 3 onglets, tri combinable Chronologique/Prioritaire (Story 3.4), ouverture/fermeture du détail et badge "nouveau" (Story 3.3), onglets Documents/Notes toujours "Bientôt disponible.". Aucune erreur console sur l'ensemble du parcours (seuls des logs `[Fast Refresh]`/`HMR`/service worker bénins, et un avertissement préexistant sur le préchargement du logo, sans rapport avec cette story).
- Données de test modifiées temporairement pour la vérification (statut de 2 tâches, priorité d'1 tâche) puis explicitement remises à leur état d'origine dans l'UI avant la fin de la session (mêmes tâches, mêmes valeurs qu'avant vérification) — aucune tâche créée ni supprimée, contrairement aux Stories 3.3/3.4 qui avaient ajouté des tâches temporaires à nettoyer en base.

### Completion Notes List

- Toutes les tâches (1 à 7) complètes. Les 3 AC vérifiées en conditions réelles (AC#1/#2, navigateur) ou par lecture de code (AC#3, satisfaite par le schéma existant, rien à observer avant l'Epic 4).
- Aucune déviation de portée par rapport à la story : aucune nouvelle route, aucun nouveau fichier, aucune nouvelle table/version Dexie, aucune métadonnée de conflit ajoutée (hors périmètre, Story 3.6).
- `TaskCard` restructuré comme prévu (contrôle de statut sorti du bouton d'ouverture, frère dans le même `<li>`) — aucun bouton imbriqué dans un bouton, confirmé par inspection DOM.
- Aucun framework de test automatisé dans ce projet (`package.json` : ni Jest, ni Vitest, ni Playwright) — cohérent avec les Stories 1.1 à 3.4, vérification manuelle exhaustive en navigateur à la place, documentée ci-dessus.
- Aucune nouvelle dépendance ajoutée.
- Revue de code (contexte frais, 3 couches parallèles : Blind Hunter, Edge Case Hunter, Acceptance Auditor) : 0 decision-needed, 1 patch (corrigé), 6 defer (tous préexistants aux Stories 3.3/3.4, non causés par cette story), 7 écartés comme non pertinents (comportements délibérés déjà documentés dans les Dev Notes ou non atteignables en pratique). Voir "Review Findings" ci-dessus et `deferred-work.md`.

### File List

**Modifiés (par cette story) :**
- `domain/task.ts` (+ `setTaskStatus`, `setTaskPriority`)
- `domain/index.ts` (+ export `setTaskStatus`, `setTaskPriority`)
- `data/local/tasks.ts` (+ `updateTaskStatus`, `updateTaskPriority`)
- `data/local/index.ts` (+ export `updateTaskStatus`, `updateTaskPriority`)
- `app/projects/[id]/project-view.tsx` (`TaskCard` restructuré + `StatusRow`, `TaskDetail` + `PrioritySelector`, `handleStatusChange`, `handlePriorityChange` ; correctif revue de code : dépendance `useEffect` du piège à focus passée de `[task]` à `[task?.id]`)
- `app/projects/[id]/project-view.module.css` (+ `.statusRow`, `.statusOption` + variantes, `.taskTitle[data-done]`, `.prioritySelector`, `.priorityOption` + variantes)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-13 : Implémentation complète (Tasks 1 à 7). Mutations pures `setTaskStatus`/`setTaskPriority` (`domain/task.ts`) ; écriture Dexie + file de synchronisation `updateTaskStatus`/`updateTaskPriority` (`data/local/tasks.ts`, même gabarit transactionnel que `archiveProject`/`unarchiveProject`, court-circuit idempotent) ; contrôle de statut à 3 segments sur la carte (`StatusRow`, `TaskCard` restructuré pour éviter un bouton imbriqué) ; sélecteur de priorité interactif dans le détail (`PrioritySelector`, remplace la puce statique). AC#3 confirmée satisfaite par le schéma de données existant, aucun code nécessaire. `npm run build`/`npm run lint` propres. Vérification manuelle en navigateur : les 3 AC confirmées en conditions réelles, non-régression Stories 3.3/3.4 vérifiée, responsive et clavier vérifiés. Statut passé à `review`.
- 2026-08-13 : Revue de code (3 couches parallèles, contexte frais). 1 finding patch appliqué (piège à focus de `TaskDetail` re-déclenché à chaque changement de priorité — `useEffect` dépendait de la référence `task` plutôt que de `task?.id` ; `handlePriorityChange`, Story 3.5, met désormais à jour `selectedTask` pendant que le détail reste ouvert, ce qui rejouait le piège à focus à chaque sélection). 6 findings préexistants (Stories 3.3/3.4) déférés vers `deferred-work.md`, non causés par cette story. 7 findings écartés (comportements délibérés déjà documentés). `npm run build`/`npm run lint` propres après correctif ; re-vérifié en navigateur (le focus reste sur l'option de priorité cliquée, plus de ré-exécution du piège à focus). Statut passé à `done`.
