"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { liveQuery } from "dexie";
import type { CalendarFilters, CalendarViewMode, Priority, Project, Task } from "@/domain";
import {
  dateKey,
  filterTasksForCalendar,
  getMonthGridDays,
  getWeekDays,
  groupProjectsByStatus,
  groupTasksByDueDate,
  isSameDay,
  isTaskOverdue,
} from "@/domain";
import { listAllTasks, listProjects } from "@/data/local";
import styles from "./general-screen.module.css";

const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
};
const PRIORITY_LETTERS: Record<Priority, string> = {
  low: "B",
  normal: "N",
  high: "H",
};

// Mois en entier (pas "short") — colonne Délai du tableau du jour uniquement (retour
// Guillaume : "le délai il faut marquer le mois en entier"), Créé le garde le format court
// (non demandé).
function formatDueDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

// Copie conforme de formatDueDate (app/projects/[id]/project-view.tsx) — même convention de
// duplication cross-fichier déjà en place dans ce projet (cf. Dev Notes Story 5.3).
function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// Point d'ancrage desktop/mobile identique au reste de l'app (cf. switcher.module.css,
// project-view.module.css — toujours 768px).
const DESKTOP_BREAKPOINT = "(min-width: 768px)";

const LOAD_ERROR_MESSAGE = "Impossible de charger le calendrier.";

export function GeneralScreen() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  // Date sélectionnée dans la grille (retour Guillaume : cliquer sur un jour doit afficher
  // sa liste de tâches en dessous — les puces de la grille sont trop petites pour être
  // lisibles). Indépendante de `referenceDate`/`viewMode` : naviguer d'un mois/semaine à
  // l'autre ne doit pas effacer la sélection, cf. même principe déjà appliqué à
  // selectedProjectIds (Dev Notes Story 4.1/4.2).
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // Story 4.2 — état de filtre indépendant du mode d'affichage, jamais réinitialisé par
  // selectViewMode/goToPrevious/goToNext (même principe que referenceDate, cf. Dev Notes
  // de la Story 4.1 : "le futur filtre de projet devra suivre le même principe, état
  // indépendant du mode d'affichage, jamais réinitialisé par setViewMode").
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  // Erreurs et "chargé" séparés par source (revue de code) — un seul `loadError` partagé
  // par les deux abonnements liveQuery masquait un vrai échec de l'un derrière le succès de
  // l'autre (`setLoadError(false)` inconditionnel dans chaque callback `next`). Même précédent
  // que app/projects/[id]/project-view.tsx (projectLoadError/tasksLoadError séparés).
  const [taskLoadError, setTaskLoadError] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const loadError = taskLoadError || projectLoadError;
  // Tant que les deux abonnements n'ont pas émis au moins une fois, `projectsById` peut être
  // incomplet par rapport à `tasks` (deux liveQuery indépendants, aucun ordre garanti) — sans
  // cette garde, une tâche d'un vrai projet pouvait retomber transitoirement sur la couleur de
  // "project-1" et l'étiquette "Sans projet" (revue de code, violation transitoire d'AC#1).
  const bothLoaded = tasksLoaded && projectsLoaded;

  // Défaut responsive (EXPERIENCE.md Responsive & Platform : "semaine par défaut mobile /
  // mois par défaut desktop, l'utilisateur peut changer manuellement sur les deux") — jamais
  // un setState synchrone au corps de l'effet (règle react-hooks/set-state-in-effect, même
  // contrainte que project-view.tsx) : la valeur initiale ET les changements de breakpoint
  // ultérieurs passent tous deux par le callback `change` de MediaQueryList, qui réapplique
  // donc le défaut à chaque franchissement du seuil tant que l'utilisateur n'a pas basculé
  // manuellement (cohérent avec EXPERIENCE.md "bascule automatiquement", cf. Dev Notes). Un
  // choix manuel (segmented control ci-dessous) désactive définitivement ce recalcul
  // automatique via `userChangedViewMode`, pour ne jamais écraser un choix explicite.
  const userChangedViewMode = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT);

    function applyDefault(matchesDesktop: boolean) {
      if (userChangedViewMode.current) {
        return;
      }
      setViewMode(matchesDesktop ? "month" : "week");
    }

    applyDefault(mql.matches);

    function handleChange(event: MediaQueryListEvent) {
      applyDefault(event.matches);
    }

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const subscription = liveQuery(() => listAllTasks()).subscribe({
      next: (result) => {
        setTaskLoadError(false);
        setTasks(result);
        setTasksLoaded(true);
      },
      error: () => setTaskLoadError(true),
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = liveQuery(() => listProjects()).subscribe({
      next: (result) => {
        setProjectLoadError(false);
        setProjects(result);
        setProjectsLoaded(true);
      },
      error: () => setProjectLoadError(true),
    });
    return () => subscription.unsubscribe();
  }, []);

  function selectViewMode(mode: CalendarViewMode) {
    userChangedViewMode.current = true;
    setViewMode(mode);
  }

  // Story 4.2 — les projets archivés (archivedProjects) ne sont plus jamais montrés au
  // calendrier (retour Guillaume : "supprime le filtre afficher les projets archivés, je ne
  // veux pas de ce filtre inutile — si je veux que ça affiche, c'est à moi d'aller les
  // désarchiver"). Filtre projet multi-sélection restant limité aux seuls projets actifs.
  const { active: activeProjects } = groupProjectsByStatus(projects);
  // Revue de code (Story 4.2) — réconciliation contre activeProjects avant usage : si un
  // projet coché est archivé pendant que ce composant reste monté (scénario multi-appareil
  // plausible via liveQuery — le projet archivé côté sync réapparaît ici en temps réel),
  // hasProjectFilter (domain/calendar.ts) resterait sinon `true` sans qu'aucune case ne
  // l'affiche plus comme cochée, masquant silencieusement toutes les autres tâches actives et
  // "Sans projet" sans moyen de s'en sortir dans l'UI. Purement dérivé, aucun effet de bord ni
  // mutation de l'état `selectedProjectIds` lui-même — l'id périmé redevient actif de lui-même
  // si le projet est désarchivé (Story 2.3).
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const effectiveSelectedProjectIds = new Set(
    [...selectedProjectIds].filter((id) => activeProjectIds.has(id)),
  );
  const filters: CalendarFilters = {
    selectedProjectIds: effectiveSelectedProjectIds,
    showArchivedProjects: false,
  };
  const visibleTasks = filterTasksForCalendar(tasks, projects, filters);
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const tasksByDate = groupTasksByDueDate(visibleTasks);
  const days = viewMode === "month" ? getMonthGridDays(referenceDate) : getWeekDays(referenceDate);
  const weeks = chunkIntoWeeks(days);
  const today = new Date();

  function goToPrevious() {
    setReferenceDate((current) => shiftReferenceDate(current, viewMode, -1));
  }
  function goToNext() {
    setReferenceDate((current) => shiftReferenceDate(current, viewMode, 1));
  }

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

  return (
    <main className={styles.main}>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Calendrier général</h1>
          <p className={styles.subtitle}>Toutes les échéances, tous projets confondus</p>
        </div>
        <div className={styles.toolbarControls}>
          <div className={styles.viewToggle} role="group" aria-label="Vue calendrier">
            <button
              type="button"
              className={styles.viewToggleItem}
              data-active={viewMode === "month"}
              aria-pressed={viewMode === "month"}
              onClick={() => selectViewMode("month")}
            >
              Mois
            </button>
            <button
              type="button"
              className={styles.viewToggleItem}
              data-active={viewMode === "week"}
              aria-pressed={viewMode === "week"}
              onClick={() => selectViewMode("week")}
            >
              Semaine
            </button>
          </div>
          <div className={styles.nav}>
            <button type="button" className={styles.navArrow} aria-label="Période précédente" onClick={goToPrevious}>
              ‹
            </button>
            <span className={styles.periodLabel}>{formatPeriodLabel(referenceDate, viewMode)}</span>
            <button type="button" className={styles.navArrow} aria-label="Période suivante" onClick={goToNext}>
              ›
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <p className={styles.error} role="alert">
          {LOAD_ERROR_MESSAGE}
        </p>
      ) : (
        <>
          {activeProjects.length > 0 && (
            <ProjectFilterControls
              activeProjects={activeProjects}
              selectedProjectIds={selectedProjectIds}
              onToggleProject={toggleProjectFilter}
            />
          )}

          {/* Grille ARIA conforme au pattern WAI-ARIA Grid (revue de code) : l'en-tête des
              jours et chaque semaine de cellules sont désormais des `role="row"` enfants du
              même conteneur `role="grid"` — auparavant l'en-tête était un frère du grid et les
              `gridcell` n'étaient enfermées dans aucun `row`. `.week` (display:contents) garde
              chaque wrapper de ligne présent pour l'arbre d'accessibilité sans casser la mise
              en page CSS Grid à 7 colonnes (ses enfants restent des items directs du grid). */}
          <div
            className={styles.grid}
            data-mode={viewMode}
            role="grid"
            aria-label={`Calendrier — ${formatPeriodLabel(referenceDate, viewMode)}`}
          >
            <div className={styles.week} role="row">
              {WEEKDAY_LETTERS.map((letter, index) => (
                <span
                  key={WEEKDAY_LABELS[index]}
                  className={styles.weekdayHeader}
                  role="columnheader"
                  title={WEEKDAY_LABELS[index]}
                >
                  {letter}
                </span>
              ))}
            </div>

            {weeks.map((week) => (
              <div key={dateKey(week[0])} className={styles.week} role="row">
                {week.map((day) => {
                  // `bothLoaded` protège aussi le contenu de la cellule : tant que les deux
                  // sources n'ont pas chargé, on affiche des cellules vides plutôt qu'un
                  // état intermédiaire potentiellement incorrect (cf. Dev Notes).
                  const dayTasks = bothLoaded ? (tasksByDate.get(dateKey(day)) ?? []) : [];
                  const inCurrentPeriod = viewMode === "week" || day.getMonth() === referenceDate.getMonth();

                  return (
                    <div
                      key={dateKey(day)}
                      className={styles.cell}
                      data-muted={!inCurrentPeriod}
                      data-today={isSameDay(day, today)}
                      data-selected={selectedDate !== null && isSameDay(day, selectedDate)}
                      role="gridcell"
                    >
                      {/* Bouton plutôt que la cellule elle-même (retour Guillaume : "je ne
                          peux pas cliquer sur d'autres dates") — même pattern WAI-ARIA Grid
                          qu'un gridcell contenant un widget interactif, aria-label porté ici
                          plutôt que sur le gridcell parent puisque c'est lui l'élément
                          focalisable/actionnable. */}
                      <button
                        type="button"
                        className={styles.cellButton}
                        aria-label={formatCellLabel(day, dayTasks, projectsById)}
                        aria-pressed={selectedDate !== null && isSameDay(day, selectedDate)}
                        onClick={() => setSelectedDate(day)}
                      >
                        <span className={styles.dayNum}>{day.getDate()}</span>
                        {dayTasks.length > 0 && (
                          <div className={styles.dots} aria-hidden="true">
                            {dayTasks.map((task) => (
                              <span key={task.id} className={styles.dotGroup}>
                                <i
                                  className={styles.projectDot}
                                  style={{
                                    backgroundColor:
                                      task.projectId !== null
                                        ? `var(--color-${projectsById.get(task.projectId)?.color ?? "muted"})`
                                        : "var(--color-muted)",
                                  }}
                                />
                                <span
                                  className={styles.priorityDot}
                                  data-priority={task.priority}
                                  title={`Priorité ${PRIORITY_LABELS[task.priority]}`}
                                >
                                  {PRIORITY_LETTERS[task.priority]}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Ancienne légende "Projets" retirée (retour Guillaume : "n'a pas lieu d'être") —
              chaque ligne du tableau du jour (DayDetailPanel ci-dessous) affiche déjà le nom
              et la couleur du projet directement, la légende séparée faisait doublon. */}
          {selectedDate && (
            <DayDetailPanel
              date={selectedDate}
              tasks={bothLoaded ? (tasksByDate.get(dateKey(selectedDate)) ?? []) : []}
              projectsById={projectsById}
              today={today}
            />
          )}
        </>
      )}
    </main>
  );
}

// FR-28 (Story 4.2). Case à cocher dupliquée littéralement du pattern
// .filter/.checkboxInput/.checkboxBox de project-view.module.css (DESIGN.md.components.
// checkbox) — même convention déjà établie dans ce fichier pour .viewToggle (dupliqué de
// switcher.module.css). Sous-composant interne non extrait sous components/ — aucun
// composant Checkbox partagé n'existe encore dans ce projet (cf. Dev Notes de la story).
function ProjectFilterControls({
  activeProjects,
  selectedProjectIds,
  onToggleProject,
}: {
  activeProjects: Project[];
  selectedProjectIds: ReadonlySet<string>;
  onToggleProject: (id: string) => void;
}) {
  return (
    <div
      className={styles.projectFilters}
      role="group"
      aria-label="Filtrer le calendrier"
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
    </div>
  );
}

// Liste des tâches du jour cliqué (retour Guillaume : "on clique sur un jour et sa liste en
// bas les tâches et les projets") — les puces de la grille (7px/11px) restent trop petites
// pour être lisibles ; ce panneau affiche le même jour en clair, sous forme de tableau à 4
// colonnes alignées : Projet, Tâche (priorité + titre), Créé le, Délai (rouge si en retard) —
// retour manuel : "Projet / tâche / créé le / délai", colonnes de largeur fixe (pas de 1fr,
// cf. .dayPanelTable ci-dessous) pour qu'elles restent groupées à gauche plutôt que la
// dernière ne se retrouve plaquée à l'extrémité droite de l'écran ("un décalage de fou").
// Cf. .dayPanelTable/.dayPanelRow (display:contents) dans general-screen.module.css pour le
// mécanisme d'alignement.
function DayDetailPanel({
  date,
  tasks,
  projectsById,
  today,
}: {
  date: Date;
  tasks: Task[];
  projectsById: Map<string, Project>;
  today: Date;
}) {
  const dateLabel = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className={styles.dayPanel}>
      <p className={styles.dayPanelTitle}>{dateLabel}</p>
      {tasks.length === 0 ? (
        <p className={styles.empty}>Aucune tâche à cette date.</p>
      ) : (
        // Vrai tableau à 3 colonnes alignées (retour Guillaume : "une sorte de tableau
        // (colonne) avec première colonne le projet, nom de la tâche et priorité, et
        // délai") — un seul CSS grid partagé par l'en-tête ET les lignes (chaque wrapper de
        // ligne est display:contents, cf. general-screen.module.css) : les 3 colonnes
        // s'alignent verticalement d'une ligne à l'autre, ce qu'un simple flex row par ligne
        // (version précédente) ne garantissait pas.
        <div className={styles.dayPanelTable} role="table" aria-label={`Tâches du ${dateLabel}`}>
          <div className={styles.dayPanelRow} role="row">
            <span className={styles.dayPanelHeaderCell} role="columnheader">
              Projet
            </span>
            <span className={styles.dayPanelHeaderCell} role="columnheader">
              Tâche
            </span>
            <span
              className={`${styles.dayPanelHeaderCell} ${styles.dayPanelOptionalColumn}`}
              role="columnheader"
            >
              Créé le
            </span>
            <span
              className={`${styles.dayPanelHeaderCell} ${styles.dayPanelOptionalColumn}`}
              role="columnheader"
            >
              Délai
            </span>
          </div>

          {tasks.map((task) => {
            const project = task.projectId ? projectsById.get(task.projectId) : undefined;
            const overdue = isTaskOverdue(task, today);
            const cells = (
              <>
                <span className={styles.dayPanelCellProject} role="cell">
                  <i
                    style={{
                      backgroundColor: project ? `var(--color-${project.color})` : "var(--color-muted)",
                    }}
                    aria-hidden="true"
                  />
                  {project ? project.name : "Sans projet"}
                </span>
                <span className={styles.dayPanelCellTask} role="cell">
                  <span
                    className={styles.dayPanelPriority}
                    data-priority={task.priority}
                    title={`Priorité ${PRIORITY_LABELS[task.priority]}`}
                  >
                    {PRIORITY_LETTERS[task.priority]}
                  </span>
                  <span className={styles.dayPanelItemTitle}>{task.title}</span>
                </span>
                <span
                  className={`${styles.dayPanelCellCreated} ${styles.dayPanelOptionalColumn}`}
                  role="cell"
                >
                  {formatDueDate(task.createdAt)}
                </span>
                <span
                  className={`${styles.dayPanelCellDelay} ${styles.dayPanelOptionalColumn}`}
                  role="cell"
                  data-overdue={overdue}
                >
                  {task.dueDate ? formatDueDateLong(task.dueDate) : "—"}
                  {overdue ? " · en retard" : ""}
                </span>
              </>
            );

            // Ligne entière cliquable (retour Guillaume, tour précédent : "qu'on puisse
            // directement faire des liens pour gagner du temps") — pas seulement le nom du
            // projet. Sans projet, la tâche n'existe nulle part ailleurs que le calendrier :
            // aucune destination possible, la ligne reste statique.
            return project ? (
              <Link
                key={task.id}
                href={`/projects/${project.id}`}
                className={styles.dayPanelRow}
                role="row"
              >
                {cells}
              </Link>
            ) : (
              <span key={task.id} className={styles.dayPanelRow} role="row" data-static="true">
                {cells}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shiftReferenceDate(current: Date, mode: CalendarViewMode, direction: 1 | -1): Date {
  const next = new Date(current);
  if (mode === "month") {
    next.setDate(1); // évite qu'un 31 janvier -> 3 mars en sautant février (jour inexistant)
    next.setMonth(next.getMonth() + direction);
  } else {
    next.setDate(next.getDate() + direction * 7);
  }
  return next;
}

// Découpe la grille (35 ou 42 jours en vue mois, 7 en vue semaine — toujours un multiple de
// 7) en semaines de 7 jours, pour porter chacune un `role="row"` distinct (revue de code,
// conformité WAI-ARIA Grid).
function chunkIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function formatPeriodLabel(referenceDate: Date, mode: CalendarViewMode): string {
  if (mode === "month") {
    return referenceDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
  }
  const days = getWeekDays(referenceDate);
  const start = days[0];
  const end = days[6];
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: sameYear ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`.toUpperCase();
}

// Inclut désormais la priorité de chaque tâche (revue de code, AC#3) : les marqueurs visuels
// (point de projet + puce H/N/B) sont `aria-hidden` (purement décoratifs, dupliqués ici en
// texte) — sans cet ajout, un lecteur d'écran n'avait aucun moyen de connaître la priorité
// d'une tâche affichée dans le calendrier.
function formatCellLabel(day: Date, dayTasks: Task[], projectsById: Map<string, Project>): string {
  const dateLabel = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  if (dayTasks.length === 0) {
    return dateLabel;
  }
  const details = dayTasks
    .map((task) => {
      const projectName = task.projectId ? (projectsById.get(task.projectId)?.name ?? "Sans projet") : "Sans projet";
      return `${projectName}, priorité ${PRIORITY_LABELS[task.priority]}`;
    })
    .join(" ; ");
  return `${dateLabel} — ${dayTasks.length} tâche${dayTasks.length > 1 ? "s" : ""} (${details})`;
}
