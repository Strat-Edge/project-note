// domain/calendar.ts — agrégation en lecture des tâches à échéance pour le calendrier
// général (FR-27 à FR-32, Capability Map 4.7 : "domain/ (agrégation en lecture des tâches
// à échéance)"). Ne dépend d'aucun module HORS domain/ (cf. AD-2 : ni data/*, ni sync/, ni
// app/, ni components/) — l'import de ./project ci-dessous (Story 4.2) reste interne à
// domain/, donc autorisé par AD-2. Reçoit des Task[]/Project[] déjà chargées, ignore la
// couleur de projet (résolue côté UI via Project[], cf. Dev Notes — domain/project.ts
// n'expose que des clés, jamais les valeurs hex).
import type { Task } from "./task";
import type { Project } from "./project";

export type CalendarViewMode = "month" | "week";

// Clé de regroupement en jour LOCAL (pas UTC) — cohérent avec formatDueDate
// (app/projects/[id]/project-view.tsx) qui affiche déjà dueDate converti en local.
// Format YYYY-MM-DD, triable lexicographiquement (même convention que le reste du domaine
// pour les horodatages ISO).
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

// FR-11 : sans échéance, une tâche n'apparaît jamais dans le calendrier.
export function tasksWithDueDate(tasks: readonly Task[]): (Task & { dueDate: string })[] {
  return tasks.filter((task): task is Task & { dueDate: string } => task.dueDate !== null);
}

// Regroupe par jour local d'échéance (FR-27 à FR-32 : le calendrier n'affiche jamais rien
// d'autre que des tâches ayant une échéance). Une Map plutôt qu'un Record : les clés sont
// générées dynamiquement, pas un ensemble fini connu à l'avance.
export function groupTasksByDueDate(tasks: readonly Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasksWithDueDate(tasks)) {
    const key = dateKey(new Date(task.dueDate));
    const existing = groups.get(key);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(key, [task]);
    }
  }
  return groups;
}

// ISO 8601 : la semaine commence le lundi (jour 1) ; getDay() renvoie 0 pour dimanche,
// d'où le décalage de 6 dans ce cas précis (cf. mockups/key-general-calendar.html,
// en-tête L M M J V S D).
function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  return result;
}

// Semaine (7 jours) contenant `weekDate`, lundi en premier.
export function getWeekDays(weekDate: Date): Date[] {
  const start = startOfWeek(weekDate);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

// Grille mensuelle rectangulaire (7 colonnes, 5 ou 6 rangées selon le mois — jamais un
// nombre de rangées fixe imposé arbitrairement) : du lundi de la semaine contenant le 1er
// du mois, au dimanche de la semaine contenant le dernier jour du mois. Les jours hors mois
// (padding) sont inclus tels quels — cf. mockups/key-general-calendar.html, cellules
// ".muted" (27-31 juillet, 1-6 septembre) qui bornent la grille d'août.
export function getMonthGridDays(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const start = startOfWeek(firstOfMonth);
  const end = startOfWeek(lastOfMonth);
  end.setDate(end.getDate() + 6);

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

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
