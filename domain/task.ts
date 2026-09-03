// domain/task.ts — entité Task et validations pures associées (FR-10 à FR-14, capture du type "Tâche").
// Ne dépend d'aucun autre module du projet (cf. AD-2). Métadonnées de conflit par champ
// (statusUpdatedAt/statusSyncedAt/statusConflict, priorité idem) ajoutées en Story 3.6 —
// AD-3, périmètre exact : Task.status et Task.priority, cf. Capability Map 4.3.
import type { Priority } from "./capture";
import type { FieldConflict } from "./sync";

export type TaskStatus = "todo" | "in_progress" | "done";
export type Provenance = "phone" | "computer";

// Tri combinable de la vue projet (FR-23, Story 3.4).
export interface SortFilters {
  chronological: boolean;
  priority: boolean;
}

export interface Task {
  id: string;
  projectId: string | null; // null = tâche générale (FR-2)
  title: string;
  description: string;
  dueDate: string | null; // ISO 8601 UTC, optionnelle (FR-10)
  reminderAt: string | null; // ISO 8601 UTC, nécessite dueDate (FR-10)
  priority: Priority;
  status: TaskStatus;
  provenance: Provenance;
  isNew: boolean;
  createdAt: string;
  statusUpdatedAt: string; // ISO 8601 UTC — dernière modification LOCALE de `status`
  statusSyncedAt: string | null; // ISO 8601 UTC — valeur de status_updated_at au dernier sync réussi ; null si jamais synchronisé
  statusConflict: FieldConflict<TaskStatus> | null; // non-null = conflit réel non résolu
  priorityUpdatedAt: string;
  prioritySyncedAt: string | null;
  priorityConflict: FieldConflict<Priority> | null;
}

// Un titre composé uniquement d'espaces est traité comme vide (même règle que validateProjectName).
export function validateTaskTitle(title: string): boolean {
  return title.trim().length > 0;
}

// FR-10 : un rappel ne peut être défini que si une échéance existe.
export function canSetReminder(dueDate: string | null): boolean {
  return dueDate !== null && dueDate.trim().length > 0;
}

// FR-25 : le badge "nouveau" disparaît à l'ouverture, quel que soit l'appareil.
export function openTask(task: Task): Task {
  return { ...task, isNew: false };
}

// FR-13 : changement de statut manuel, à tout moment, sans ordre imposé (Story 3.5).
// `updatedAt` en paramètre (pas de `new Date()` interne) : garde la fonction pure/déterministe
// (Story 3.6). Efface tout conflit en attente sur ce champ — une écriture explicite vaut
// arbitrage implicite (cf. Dev Notes Story 3.6), qu'elle vienne du contrôle normal ou de la
// résolution d'un conflit dans le détail (ConflictBanner réutilise cette même fonction via
// updateTaskStatus).
export function setTaskStatus(task: Task, status: TaskStatus, updatedAt: string): Task {
  return { ...task, status, statusUpdatedAt: updatedAt, statusConflict: null };
}

// FR-14 : la priorité reste modifiable après coup, directement sur la tâche (Story 3.5).
// Même rationale que setTaskStatus ci-dessus.
export function setTaskPriority(task: Task, priority: Priority, updatedAt: string): Task {
  return { ...task, priority, priorityUpdatedAt: updatedAt, priorityConflict: null };
}

// Puce de métadonnée "· en retard" (EXPERIENCE.md State Patterns) — une tâche terminée
// n'est jamais en retard, quelle que soit son échéance. `dueDate` est toujours ancrée à
// minuit local du jour choisi (cf. app/capture-flow.tsx) : comparer directement à `now`
// marquerait une tâche "en retard" dès le début de son propre jour d'échéance, avant même
// qu'elle ait pu être traitée — on compare donc à la fin du jour d'échéance (+24h), pas
// à son début (cf. finding de revue Story 3.3).
export function isTaskOverdue(
  task: Pick<Task, "dueDate" | "status">,
  now: Date,
): boolean {
  if (!task.dueDate || task.status === "done") {
    return false;
  }
  const endOfDueDate = new Date(task.dueDate).getTime() + 24 * 60 * 60 * 1000;
  return endOfDueDate <= now.getTime();
}

// Ordre par défaut de la vue projet (le plus récent en tête, même convention que
// groupProjectsByStatus).
export function sortTasksChronologically(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Haute en tête (0), Basse en dernier (2) : une case "Prioritaire" cochée fait
// remonter les tâches les plus urgentes en premier.
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

// Tri combinable de la vue projet (FR-23, Story 3.4). Le paramètre chronological
// n'a pas d'effet observable indépendant tant que priority est coché : le repli
// chronologique au sein d'un même niveau de priorité s'applique dans tous les cas
// (aucune AC ne demande un ordre différent selon l'état de chronological dans ce cas).
export function sortTasks(tasks: readonly Task[], filters: SortFilters): Task[] {
  if (!filters.priority) {
    return sortTasksChronologically(tasks);
  }
  return [...tasks].sort((a, b) => {
    const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
  });
}
