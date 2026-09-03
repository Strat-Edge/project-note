---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 4.1: Vue calendrier mois/semaine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want voir toutes mes tâches à échéance dans un calendrier, coloré par projet,
so that j'aie une vue d'ensemble de tous mes engagements sans ouvrir chaque projet.

## Acceptance Criteria

1. **Given** des tâches à échéance dans plusieurs projets **When** j'ouvre l'écran Général **Then** elles apparaissent dans une grille mensuelle, chacune colorée selon la couleur de son projet
2. **Given** la vue calendrier **When** je bascule entre vue mois et vue semaine **Then** l'affichage change en conservant le filtre de projet actif
3. **Given** une tâche affichée dans le calendrier **When** je la regarde **Then** son niveau de priorité est visible visuellement, sans jamais affecter sa position dans la grille (la date prime)

## Tasks / Subtasks

- [x] Task 1: `domain/calendar.ts` (nouveau) — agrégation en lecture pure, aucune dépendance IO (AC: #1, #2, #3 ; Capability Map 4.7)
  - [x] Créer `domain/calendar.ts` :
    ```ts
    // domain/calendar.ts — agrégation en lecture des tâches à échéance pour le calendrier
    // général (FR-27 à FR-32, Capability Map 4.7 : "domain/ (agrégation en lecture des tâches
    // à échéance)"). Ne dépend d'aucun autre module du projet (cf. AD-2) : reçoit des Task[]
    // déjà chargées, ignore la couleur de projet (résolue côté UI via Project[], cf. Dev Notes —
    // domain/project.ts n'expose que des clés, jamais les valeurs hex).
    import type { Task } from "./task";

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
    ```
  - [x] `domain/index.ts` : ajouter l'export de `dateKey`, `isSameDay`, `tasksWithDueDate`, `groupTasksByDueDate`, `getWeekDays`, `getMonthGridDays`, et le type `CalendarViewMode`.

- [x] Task 2: `data/local/tasks.ts` — lecture de toutes les tâches, tous projets confondus (AC: #1)
  - [x] Ajouter, à la suite de `listTasksByProject` :
    ```ts
    // Écran Général (Story 4.1) — toutes les tâches, tous projets confondus, y compris les
    // tâches générales (projectId: null, FR-2). Scan complet plutôt qu'une requête Dexie
    // filtrée sur l'index `dueDate` (`.where("dueDate").notEqual(null)`) : IndexedDB ne
    // garantit pas un tri/filtre fiable entre `null` et des chaînes sur un même index, et le
    // filtrage réel (tâches AVEC échéance) est de toute façon délégué à domain/
    // (tasksWithDueDate, Capability Map 4.7 — "agrégation en lecture"). Taille de table
    // compatible avec un scan complet (outil interne solo, même précédent que listProjects()).
    export async function listAllTasks(): Promise<Task[]> {
      return db.tasks.toArray();
    }
    ```
  - [x] `data/local/index.ts` : ajouter `listAllTasks` à l'export du bloc `./tasks`.

- [x] Task 3: `app/general-screen.tsx` + `.module.css` (nouveaux) — écran Général (AC: #1, #2, #3)
  - [x] Nouveau fichier `app/general-screen.tsx`, sous `app/` (pas `components/`) car il importe `data/local/` directement — même précédent que `app/projects/projects-screen.tsx`/`app/projects/[id]/project-view.tsx` (cf. AD-2, Dev Notes). Composant client (`"use client"`), abonné en live à `db.tasks`/`db.projects` (même précédent que `liveQuery` en Story 3.6 — un cycle de synchro en arrière-plan qui insère une tâche à échéance depuis un autre appareil doit apparaître sans rechargement) :
    ```tsx
    "use client";

    import { useEffect, useState } from "react";
    import Link from "next/link";
    import { liveQuery } from "dexie";
    import type { CalendarViewMode, Priority, Project, Task } from "@/domain";
    import {
      dateKey,
      getMonthGridDays,
      getWeekDays,
      groupTasksByDueDate,
      isSameDay,
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

    // Point d'ancrage desktop/mobile identique au reste de l'app (cf. switcher.module.css,
    // project-view.module.css — toujours 768px).
    const DESKTOP_BREAKPOINT = "(min-width: 768px)";

    const LOAD_ERROR_MESSAGE = "Impossible de charger le calendrier.";

    export function GeneralScreen() {
      // Défaut "month" — identique au rendu serveur (window indisponible en SSR) ; ajusté une
      // seule fois après montage vers "week" sur mobile étroit (EXPERIENCE.md Responsive &
      // Platform : "semaine par défaut mobile / mois par défaut desktop, l'utilisateur peut
      // changer manuellement sur les deux") sans reproduire cet ajustement si l'utilisateur a
      // déjà basculé manuellement entre-temps.
      const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
      const [referenceDate, setReferenceDate] = useState(() => new Date());
      const [tasks, setTasks] = useState<Task[]>([]);
      const [projects, setProjects] = useState<Project[]>([]);
      const [loadError, setLoadError] = useState(false);

      useEffect(() => {
        if (window.matchMedia(DESKTOP_BREAKPOINT).matches) {
          return;
        }
        setViewMode("week");
        // Volontairement []: ajustement de défaut une seule fois au montage, jamais rejoué à un
        // redimensionnement ultérieur — un choix manuel de l'utilisateur (segmented control
        // ci-dessous) ne doit jamais être écrasé par un simple resize de fenêtre desktop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      useEffect(() => {
        const subscription = liveQuery(() => listAllTasks()).subscribe({
          next: (result) => {
            setLoadError(false);
            setTasks(result);
          },
          error: () => setLoadError(true),
        });
        return () => subscription.unsubscribe();
      }, []);

      useEffect(() => {
        const subscription = liveQuery(() => listProjects()).subscribe({
          next: (result) => {
            setLoadError(false);
            setProjects(result);
          },
          error: () => setLoadError(true),
        });
        return () => subscription.unsubscribe();
      }, []);

      const projectsById = new Map(projects.map((project) => [project.id, project]));
      const tasksByDate = groupTasksByDueDate(tasks);
      const days = viewMode === "month" ? getMonthGridDays(referenceDate) : getWeekDays(referenceDate);
      const today = new Date();

      function goToPrevious() {
        setReferenceDate((current) => shiftReferenceDate(current, viewMode, -1));
      }
      function goToNext() {
        setReferenceDate((current) => shiftReferenceDate(current, viewMode, 1));
      }

      // Légende : uniquement les projets dont au moins une tâche à échéance est visible dans la
      // grille actuelle (même logique que mockups/key-general-calendar.html — la légende n'y
      // liste que les couleurs effectivement présentes sur la grille, pas tous les projets
      // existants). "Sans projet" (FR-2, tâche générale) n'a pas de couleur de projet : traité
      // à part avec --color-muted (cf. Dev Notes — aucune couleur de la palette projet ne lui
      // est applicable, DESIGN.md ne prévoit pas ce cas).
      const visibleProjectIds = new Set<string>();
      let hasProjectlessTask = false;
      for (const day of days) {
        for (const task of tasksByDate.get(dateKey(day)) ?? []) {
          if (task.projectId === null) {
            hasProjectlessTask = true;
          } else {
            visibleProjectIds.add(task.projectId);
          }
        }
      }
      const legendProjects = projects.filter((project) => visibleProjectIds.has(project.id));

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
                  onClick={() => setViewMode("month")}
                >
                  Mois
                </button>
                <button
                  type="button"
                  className={styles.viewToggleItem}
                  data-active={viewMode === "week"}
                  aria-pressed={viewMode === "week"}
                  onClick={() => setViewMode("week")}
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
              <div className={styles.weekdayRow} role="row">
                {WEEKDAY_LETTERS.map((letter, index) => (
                  <span key={WEEKDAY_LABELS[index]} title={WEEKDAY_LABELS[index]}>
                    {letter}
                  </span>
                ))}
              </div>

              <div
                className={styles.grid}
                data-mode={viewMode}
                role="grid"
                aria-label={`Calendrier — ${formatPeriodLabel(referenceDate, viewMode)}`}
              >
                {days.map((day) => {
                  const dayTasks = tasksByDate.get(dateKey(day)) ?? [];
                  const inCurrentPeriod =
                    viewMode === "week" || day.getMonth() === referenceDate.getMonth();

                  return (
                    <div
                      key={dateKey(day)}
                      className={styles.cell}
                      data-muted={!inCurrentPeriod}
                      data-today={isSameDay(day, today)}
                      role="gridcell"
                      aria-label={formatCellLabel(day, dayTasks, projectsById)}
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
                                      ? `var(--color-${projectsById.get(task.projectId)?.color ?? "project-1"})`
                                      : "var(--color-muted)",
                                }}
                              />
                              <span className={styles.priorityDot} data-priority={task.priority}>
                                {PRIORITY_LETTERS[task.priority]}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(legendProjects.length > 0 || hasProjectlessTask) && (
                <div className={styles.legend}>
                  <p className={styles.legendTitle}>Projets</p>
                  <div className={styles.legendGrid}>
                    {legendProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`} className={styles.legendItem}>
                        <i style={{ backgroundColor: `var(--color-${project.color})` }} />
                        {project.name}
                      </Link>
                    ))}
                    {hasProjectlessTask && (
                      <span className={styles.legendItem}>
                        <i style={{ backgroundColor: "var(--color-muted)" }} />
                        Sans projet
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
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

    function formatPeriodLabel(referenceDate: Date, mode: CalendarViewMode): string {
      if (mode === "month") {
        return referenceDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
      }
      const days = getWeekDays(referenceDate);
      const start = days[0];
      const end = days[6];
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = start.toLocaleDateString("fr-FR", { day: "numeric", month: sameMonth ? undefined : "short" });
      const endLabel = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      return `${startLabel} – ${endLabel}`.toUpperCase();
    }

    function formatCellLabel(
      day: Date,
      dayTasks: Task[],
      projectsById: Map<string, Project>,
    ): string {
      const dateLabel = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (dayTasks.length === 0) {
        return dateLabel;
      }
      const names = dayTasks
        .map((task) => (task.projectId ? projectsById.get(task.projectId)?.name : "Sans projet") ?? "Sans projet")
        .join(", ");
      return `${dateLabel} — ${dayTasks.length} tâche${dayTasks.length > 1 ? "s" : ""} (${names})`;
    }
    ```
  - [x] Nouveau fichier `app/general-screen.module.css` — mêmes tokens que `project-view.module.css`/mockups/key-general-calendar.html, transposés en variables réactives (`--color-surface`/`--color-border`/`--color-text`/`--color-muted`/`--color-heading` s'adaptent déjà seuls au thème sombre via `app/globals.css` ; `--color-bg-alt` ne l'est pas — redéfinie explicitement en sombre, même précédent que `.metaPill`/`.priorityChip[data-priority="low"]` de `project-view.module.css`) :
    ```css
    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-5);
      padding: var(--space-6);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .title {
      font-size: var(--font-heading-size);
      font-weight: var(--font-heading-weight);
      line-height: var(--font-heading-line-height);
      color: var(--color-heading);
    }

    .subtitle {
      margin-top: 4px;
      font-size: var(--font-caption-size);
      font-weight: var(--font-caption-weight);
      color: var(--color-muted);
    }

    .toolbarControls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    /* Segmented control Mois/Semaine — mêmes valeurs de token que components/switcher.module.css
       (DESIGN.md.components.segmented-control), dupliquées littéralement (convention établie,
       cf. project-view.module.css .tablist). */
    .viewToggle {
      display: flex;
      padding: var(--space-1);
      border-radius: var(--radius-xl);
      background: var(--color-bg-alt);
    }

    @media (prefers-color-scheme: dark) {
      .viewToggle {
        background: var(--color-surface-dark);
      }
    }

    .viewToggleItem {
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      border: none;
      border-radius: var(--radius-lg);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      .viewToggleItem {
        color: var(--color-muted-dark);
      }
    }

    .viewToggleItem[data-active="true"] {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .nav {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .navArrow {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-muted);
      cursor: pointer;
    }

    .periodLabel {
      min-width: 140px;
      text-align: center;
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-heading);
      letter-spacing: 0.3px;
    }

    .weekdayRow {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
    }

    .weekdayRow span {
      font-size: var(--font-micro-size);
      font-weight: var(--font-micro-weight);
      letter-spacing: var(--font-micro-letter-spacing);
      color: var(--color-muted);
      text-transform: uppercase;
    }

    @media (prefers-color-scheme: dark) {
      .weekdayRow span {
        color: var(--color-muted-dark);
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }

    .cell {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-2);
      min-height: 82px;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    /* Vue semaine : une seule rangée, plus de place par jour (cf. Dev Notes — aucun mockup
       dédié, grille dérivée de la vue mois). */
    .grid[data-mode="week"] .cell {
      min-height: 140px;
    }

    .cell[data-muted="true"] {
      background: var(--color-bg-alt);
    }

    @media (prefers-color-scheme: dark) {
      .cell[data-muted="true"] {
        background: var(--color-surface-2-dark);
      }
    }

    .cell[data-today="true"] {
      border: 1.5px solid var(--color-primary);
    }

    .dayNum {
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      color: var(--color-text);
    }

    .cell[data-muted="true"] .dayNum {
      color: var(--color-muted);
    }

    .cell[data-today="true"] .dayNum {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: var(--font-caption-size);
    }

    /* Puce de priorité (calendrier) — DESIGN.md.components.meta-pill note + Component Patterns
       "Même code visuel que la puce de priorité des cartes ; n'affecte jamais la position de la
       tâche dans la grille." Deux marqueurs par tâche, pas un seul (cf. Dev Notes) : le point
       coloré par PROJET (FR-29) et la puce H/N/B colorée par PRIORITÉ (FR-32) sont deux
       exigences indépendantes de la story, chacune avec sa propre encodage couleur — aucune
       des deux ne peut se substituer à l'autre sans en perdre le sens. */
    .dots {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: auto;
    }

    .dotGroup {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    .projectDot {
      width: 7px;
      height: 7px;
      border-radius: var(--radius-full);
      display: block;
      flex-shrink: 0;
    }

    .priorityDot {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      border-radius: 4px;
      font-size: 6.5px;
      font-weight: var(--font-micro-weight);
    }

    .priorityDot[data-priority="high"] {
      background: var(--color-priority-haute);
      color: var(--color-priority-haute-text);
    }

    .priorityDot[data-priority="normal"] {
      background: var(--color-priority-normale);
      color: var(--color-priority-normale-text);
    }

    .priorityDot[data-priority="low"] {
      background: var(--color-bg-alt);
      color: var(--color-priority-basse-text);
    }

    @media (prefers-color-scheme: dark) {
      .priorityDot[data-priority="low"] {
        background: var(--color-surface-2-dark);
      }
    }

    .legend {
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .legendTitle {
      margin-bottom: var(--space-3);
      font-size: var(--font-caption-size);
      font-weight: var(--font-caption-weight);
      letter-spacing: 0.3px;
      color: var(--color-muted);
      text-transform: uppercase;
    }

    .legendGrid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-5);
    }

    .legendItem {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-text);
    }

    .legendItem i {
      width: 11px;
      height: 11px;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
    }

    .error {
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-danger);
    }
    ```
  - [x] `app/page.tsx` : remplacer le contenu placeholder par l'écran Général :
    ```tsx
    import { GeneralScreen } from "./general-screen";

    export default function Home() {
      return <GeneralScreen />;
    }
    ```
    Supprimer `app/page.module.css` (plus référencé par aucun fichier après ce changement — vérifier avec un grep avant suppression, cf. Dev Notes).

- [x] Task 4: Vérification manuelle (AC #1 à #3)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Créer, via le flux "+", au moins 3 tâches avec échéance dans au moins 2 projets différents (couleurs distinctes), une avec priorité Haute, une Normale, une Basse ; créer aussi une tâche générale ("Sans projet") avec échéance.
  - [x] Ouvrir l'écran Général (`/`) : vérifier que chaque tâche apparaît à la bonne date, avec le point coloré de son projet et sa puce de priorité (H/N/B) ; vérifier que la tâche "Sans projet" affiche un point `--color-muted` et figure dans la légende sous "Sans projet".
  - [x] Vérifier la navigation : flèches précédent/suivant changent bien de mois (vue mois) ou de semaine (vue semaine) ; une tâche à échéance le mois prochain devient visible après un clic "suivant".
  - [x] Vérifier le bascule Mois/Semaine : les tâches déjà visibles dans un mode restent cohérentes dans l'autre (même jour, même contenu) ; aucune perte d'état constatée lors du basculement.
  - [x] Vérifier le responsive : recharger à 375px (mobile) → vue Semaine par défaut ; recharger à 1280px (desktop) → vue Mois par défaut ; dans les deux cas, basculer manuellement vers l'autre vue fonctionne.
  - [x] Vérifier qu'une tâche sans échéance n'apparaît jamais dans le calendrier (reste visible uniquement dans l'onglet Tâches du projet).
  - [x] Vérifier la non-régression : switcher Général/Projets (Story 1.3+), FAB "+" toujours accessible et fonctionnel depuis l'écran Général, vue projet inchangée (clic sur un élément de la légende ouvre bien le bon projet). Aucune erreur console.
  - [x] Supprimer les données de test créées (IndexedDB, via l'UI si une suppression existe, sinon consigner dans le Debug Log — même précédent que les stories précédentes).

### Review Findings

- [x] [Review][Patch] AC#3 (priorité visible) échoue entièrement pour les lecteurs d'écran : la puce de priorité (H/N/B) est enfermée dans un conteneur `aria-hidden="true"` et `formatCellLabel` (l'`aria-label` de la cellule) ne mentionne jamais la priorité — un utilisateur non-voyant n'a aucun moyen de connaître la priorité d'une tâche affichée dans le calendrier, contrairement à ce que garantissent le point coloré par projet et le texte de la cellule. [app/general-screen.tsx:205, app/general-screen.tsx:282-291]
- [x] [Review][Patch] `.priorityDot[data-priority="low"]` utilise exactement le même token de fond que `.cell[data-muted="true"]` dans les deux thèmes (`--color-bg-alt` clair, `--color-surface-2-dark` sombre) — une tâche en priorité Basse dont l'échéance tombe sur un jour hors mois (rangée de padding, toujours affichée) rend une puce de priorité totalement invisible (fond = fond), en violation directe d'AC#3 pour cette combinaison. [app/general-screen.module.css:150-158, app/general-screen.module.css:235-244]
- [x] [Review][Patch] `tasks` et `projects` proviennent de deux abonnements `liveQuery` indépendants (deux `useEffect` séparés, aucune coordination) — si la requête `tasks` se résout avant la requête `projects`, `projectsById` est encore vide pour une tâche appartenant à un vrai projet : le point retombe sur la couleur de `project-1` (au lieu de la couleur réelle) et `formatCellLabel` annonce "Sans projet" (au lieu du vrai nom), en violation transitoire d'AC#1 pendant cette fenêtre de course. [app/general-screen.tsx:211-214, app/general-screen.tsx:288]
- [x] [Review][Patch] Un seul état `loadError` est partagé par les deux abonnements `liveQuery` (tâches et projets) — un échec de l'un peut être silencieusement effacé par le succès de l'autre (`setLoadError(false)` inconditionnel dans chaque callback `next`), masquant un vrai échec de chargement. Incohérent avec le précédent déjà établi dans `app/projects/[id]/project-view.tsx` (`projectLoadError`/`tasksLoadError` séparés). [app/general-screen.tsx:72-92]
- [x] [Review][Patch] Structure ARIA de la grille non conforme au pattern WAI-ARIA Grid : les cellules `role="gridcell"` ne sont enfermées dans aucun élément `role="row"` à l'intérieur du conteneur `role="grid"`, et l'en-tête des jours de la semaine (`role="row"`) est un frère du `role="grid"`, pas un enfant — un lecteur d'écran peut annoncer ou naviguer la grille de façon incohérente. [app/general-screen.tsx:170-231]
- [x] [Review][Patch] Le libellé de période en vue Semaine omet l'année sur la date de début même quand la semaine chevauche deux années civiles (ex. "29 déc. – 4 janv. 2026" pour une semaine à cheval fin décembre/début janvier) — compréhensible en contexte mais techniquement ambigu. [app/general-screen.tsx:269-279]
- [x] [Review][Patch] Les Dev Notes de cette story affirment que le défaut responsive "ne réagit qu'au montage, jamais à un redimensionnement ultérieur" — inexact : l'implémentation réelle réabonne un `MediaQueryList` (`change` event) qui réapplique le défaut à chaque franchissement du seuil 768px tant que l'utilisateur n'a pas basculé manuellement (`userChangedViewMode`). Le comportement réel est probablement le bon (plus fidèle à EXPERIENCE.md "bascule automatiquement" qu'un simple mount-only), mais le texte des Dev Notes ne le décrit pas correctement. [_bmad-output/implementation-artifacts/4-1-vue-calendrier-mois-semaine.md — Dev Notes, paragraphe "Défaut responsive mois/semaine"]
- [x] [Review][Defer] Décodage du fuseau horaire de `dueDate` : `dateKey`/`groupTasksByDueDate` décodent l'instant UTC stocké avec le fuseau *local de l'appareil consultant* — un appareil dans un fuseau différent de celui qui a fixé l'échéance peut voir la tâche apparaître au mauvais jour. Conséquence héritée de la convention `dueDate` déjà en place depuis la Story 3.1 (même hypothèse utilisée par `isTaskOverdue`/`formatDueDate`) ; cette story est la première à l'utiliser comme clé de répartition stricte par jour, mais n'introduit pas l'hypothèse elle-même. [domain/calendar.ts:14-19, domain/calendar.ts:36] — deferred, pre-existing
- [x] [Review][Defer] `shiftReferenceDate` (navigation mois) ancre toujours au jour 1 avant de changer de mois (évite le bug "31 janvier → 3 mars") — conséquence : naviguer en vue mois puis basculer en vue semaine ne préserve pas une position comparable dans la semaine (la semaine affichée redevient celle du jour 1 du mois affiché, pas celle "proche" du jour précédemment visualisé). Aucune AC ni note de Dev Notes ne couvre cette séquence précise navigation-puis-bascule ; corrigible mais sans solution évidente sans compromis (préserver le jour du mois réintroduirait le bug de saut de mois que l'ancrage au jour 1 évite). [app/general-screen.tsx:259-266] — deferred, pre-existing pattern of trade-off
- [x] [Review][Defer] `listAllTasks()` est un scan complet non filtré, réexécuté par `liveQuery` à chaque écriture sur `db.tasks` (y compris un simple changement de statut/priorité sans rapport avec le calendrier), sans limite ni pagination. Compromis explicitement documenté et assumé par cette story ("compatible avec un scan complet, outil interne solo") — même précédent que la file de synchronisation sans limite de taille (Story 3.2, `sync/client.ts`, déjà dans ce ledger). [data/local/tasks.ts:102-111] — deferred, pre-existing pattern of trade-off
- [x] [Review][Defer] `today` (mise en évidence de la date du jour) est calculé une seule fois par rendu (`new Date()`), sans minuteur — reste figé sur la veille si le composant reste monté sans autre déclencheur de rendu au passage de minuit. Même limitation déjà acceptée pour `isTaskOverdue` (`domain/task.ts`, Story 3.3+), jamais corrigée par un minuteur dédié dans ce code base. [app/general-screen.tsx:71] — deferred, pre-existing pattern
- Dismissed (bruit / conforme au mock) : les lettres "M"/"M" dupliquées pour Mardi/Mercredi dans l'en-tête de la grille reproduisent exactement `mockups/key-general-calendar.html` (abréviation française standard "L M M J V S D") — pas un défaut, la conception prescrite ; le `title` de désambiguïsation ajouté est un bonus d'accessibilité, pas un manque.

## Dev Notes

**Portée exacte de cette story — ce qu'elle NE fait PAS.** Epic 4 est découpé en 3 stories par FR : cette story (4.1) couvre uniquement FR-27 (bascule mois/semaine), FR-29 (couleur par projet), FR-32 (priorité visuelle). **FR-28 (filtre multi-projet) et FR-31 (exclusion des projets archivés par défaut) sont le périmètre exact de la Story 4.2** — ne pas les anticiper. Concrètement pour cette story : **toutes** les tâches à échéance apparaissent dans le calendrier, y compris celles de projets archivés (aucun filtre n'existe encore) ; aucune UI de sélection de projet n'est ajoutée. **FR-30 (créer/sélectionner un projet directement depuis le calendrier) est le périmètre exact de la Story 4.3** — ne pas ajouter de bouton "+ Nouveau projet" dans la toolbar, même si `mockups/key-general-calendar.html` en affiche un (la spine/les epics priment sur le mock pour le découpage en stories, cf. EXPERIENCE.md "La spine gagne en cas de conflit avec ces mocks").

**AC#2 ("conserve le filtre de projet actif" en basculant mois/semaine) n'a rien à faire concrètement dans cette story.** Aucun filtre n'existe avant la Story 4.2 — l'AC est trivialement satisfaite tant qu'aucun état n'est réinitialisé au changement de vue. Le code ci-dessus garde `referenceDate` dans un état partagé entre les deux modes (pas de remise à zéro au toggle) : c'est le seul état qui existe aujourd'hui, et le futur filtre de projet (Story 4.2) devra suivre le même principe (état indépendant du mode d'affichage, jamais réinitialisé par `setViewMode`).

**Deux marqueurs distincts par tâche affichée, pas un seul.** DESIGN.md définit la "Puce de priorité (calendrier)" comme "même code visuel que la puce de priorité des cartes" (couleur par PRIORITÉ, lettre H/N/B) — un composant *différent* du point coloré par PROJET que montre `mockups/key-general-calendar.html` sur la majorité de ses cellules (`.cal-dots i`, couleur `--project-N`). Le mock ne combine les deux que sur une seule cellule de démonstration (12 août, point orange + puce "H"), mais FR-29 et FR-32 sont deux exigences indépendantes qui s'appliquent à **chaque** tâche affichée, pas seulement à celles en priorité Haute — d'où l'implémentation ci-dessus qui rend systématiquement les deux marqueurs pour toute tâche, quelle que soit sa priorité. À documenter si Guillaume juge la densité visuelle excessive en usage réel (aucune AC ne fixe de limite de densité).

**Tâche générale sans projet (`projectId: null`, FR-2) — aucune couleur de projet possible.** Ni DESIGN.md ni les mocks ne couvrent ce cas (le calendrier de démonstration ne montre que des tâches rattachées à un projet). Traitement choisi : point `--color-muted` (gris neutre, déjà utilisé pour du texte secondaire ailleurs dans l'app — pas une couleur de la palette `project-1..8`, qui reste réservée à l'identification de projet réel, cf. DESIGN.md "Jamais utiliser les couleurs de label de projet comme couleurs d'interface système" — ici c'est l'inverse qui est évité : ne jamais assigner arbitrairement une des 8 teintes de projet à une tâche qui n'appartient à aucun projet). Légende : entrée "Sans projet" ajoutée séparément, jamais un lien (contrairement aux projets réels, il n'existe pas de vue "projet" pour `null`).

**Grille en lecture seule — aucune interaction sur une tâche depuis le calendrier.** FR-27 à FR-32 (section 4.7 du PRD) décrivent explicitement une "Vue agrégée **en lecture** des tâches ayant une échéance" — contrairement à la carte de tâche (vue projet), aucune AC de cette story ne demande d'ouvrir le détail d'une tâche depuis le calendrier. Les points/puces sont des `<span>` non interactifs ; seule la légende (projets réels) est cliquable, vers `/projects/{id}` — cohérent avec `EXPERIENCE.md` Information Architecture ("Vue projet | Tap sur un projet (depuis Général ou Projets)"), un lien de navigation déjà établi ailleurs (`ProjectRow`, `app/projects/projects-screen.tsx`), pas une fonctionnalité nouvelle spécifique à cette story.

**Défaut responsive mois/semaine (EXPERIENCE.md Responsive & Platform, UX-DR22) implémenté via `MediaQueryList.addEventListener`, pas un `setState` direct au corps de l'effet.** `window` n'existe pas en rendu serveur Next.js ; lire `window.matchMedia` dans l'initialiseur de `useState` produirait un mismatch d'hydratation (le serveur rend toujours "month", un premier rendu client sur mobile calculerait "week" avant même la réconciliation). L'ajustement se fait donc après montage, avec un flash bref "month → week" sur mobile assumé (pas de précédent dans ce code base pour éviter ce genre de flash — cf. `State Patterns` "Chargement initial" qui tolère déjà un état neutre bref). **Correction (revue de code) : le défaut REAGIT à chaque franchissement ultérieur du seuil 768px** (via le callback `change` de `MediaQueryList`, réabonné pour toute la durée de vie du composant), tant que l'utilisateur n'a pas basculé manuellement le segmented control (`userChangedViewMode`, qui désactive alors ce recalcul définitivement). C'est un choix délibéré, plus fidèle à EXPERIENCE.md ("le calendrier général **bascule automatiquement** en vue semaine/mois") qu'un ajustement figé au montage — un premier jet de cette story avait documenté par erreur un comportement "mount-only, jamais sur resize", inexact par rapport au code réellement écrit ; corrigé ici.

**Pas de nouvelle table/version Dexie.** `Task`/`Project` existent déjà tels quels (Stories 2.1, 3.1). Cette story ne fait que lire des entités déjà persistées — `data/local/db.ts` inchangé.

**`listAllTasks()` — scan complet, pas de filtre Dexie sur `dueDate`.** Cf. commentaire du code Task 2 : le filtre réel (tâches avec échéance) est délégué à `domain/calendar.ts` (`tasksWithDueDate`), cohérent avec la Capability Map 4.7 qui place l'agrégation en lecture côté `domain/`, pas côté `data/local/`.

**Pourquoi `app/general-screen.tsx` vit sous `app/`, pas `components/`.** Il importe `data/local/` (Dexie) directement pour son abonnement live — `components/` ne dépend que de `domain/` (AD-2, cf. commentaire d'en-tête de `components/index.ts`). Même précédent exact que `app/projects/projects-screen.tsx` et `app/projects/[id]/project-view.tsx`.

**`app/page.module.css` devient orphelin.** Avant cette story, `app/page.tsx` l'utilisait pour son placeholder "Connecté." — remplacé entièrement par `GeneralScreen`. Vérifier qu'aucun autre fichier ne l'importe avant de le supprimer (`grep -r "page.module.css" app/`) ; à ce jour, aucun autre écran n'en dépend.

**Vue semaine — aucun mockup de référence.** `mockups/key-general-calendar.html` ne couvre que la vue mois (`ux-Project Note-2026-08-03/mockups/` ne contient pas de variante semaine). La grille semaine ci-dessus dérive directement des mêmes tokens/cellules que la vue mois (une seule rangée de 7, cellules plus hautes pour profiter de l'espace disponible) plutôt que d'inventer un langage visuel différent — cohérent avec DESIGN.md (les composants list/grid partagent déjà systématiquement leurs tokens dans ce projet). Si Guillaume a un avis différent après vérification manuelle, ajuster librement (aucune AC ne fixe la mise en page exacte de la vue semaine, seulement son existence et le fait qu'elle bascule sans perte de filtre).

### Project Structure Notes

Fichiers créés :
```text
domain/calendar.ts                    # nouveau — agrégation en lecture pure (Capability Map 4.7)
app/general-screen.tsx                # nouveau — écran Général (calendrier)
app/general-screen.module.css         # nouveau
```

Fichiers modifiés :
```text
domain/index.ts                       # + export dateKey, isSameDay, tasksWithDueDate, groupTasksByDueDate, getWeekDays, getMonthGridDays, CalendarViewMode
data/local/tasks.ts                   # + listAllTasks
data/local/index.ts                   # + export listAllTasks
app/page.tsx                          # placeholder "Connecté." remplacé par <GeneralScreen />
```

Fichier supprimé (devenu orphelin) :
```text
app/page.module.css
```

Aucun changement à `data/local/db.ts` (pas de nouvelle version Dexie), `data/local/projects.ts` (`listProjects` déjà exporté, réutilisé tel quel), `sync/`, `data/remote/`, ou tout autre écran (`/projects`, `/projects/[id]`, `/login`, capture "+"). `components/switcher.tsx`/`components/header.tsx` inchangés — la route `/` existe déjà et pointe déjà vers "Général" dans le switcher (Story 1.3), seul son contenu change.

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 3.6). Vérification manuelle exhaustive en Task 4 — première story qui exige de vérifier explicitement les deux points de rupture responsive (375px/1280px) pour un défaut différent selon la plateforme (pas seulement une adaptation de mise en page CSS, un choix d'état initial différent).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Calendrier général, Story 4.1 (texte exact des 3 AC) ; Story 4.2/4.3 (FR-28/FR-31/FR-30, explicitement hors périmètre de cette story)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.7 Calendrier général (FR-27 à FR-32, description "Vue agrégée en lecture") ; FR-11 (apparition automatique, condition échéance obligatoire)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, 4.7 Calendrier général ("components/ (vue mois/semaine), domain/ (agrégation en lecture des tâches à échéance)") ; Design Paradigm (direction de dépendance components/app → domain/)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Information Architecture ("Général" — calendrier mois/semaine, filtre multi-projet, accès rapide projet — ces deux derniers hors périmètre 4.1) ; Component Patterns ("Puce de priorité (calendrier)" — même code visuel que la puce des cartes, n'affecte jamais la position) ; State Patterns ("Calendrier sans échéance" — grille normale, pas d'erreur) ; Responsive & Platform (semaine par défaut mobile / mois par défaut desktop, UX-DR22) ; Key Flows Flow 3 (climax : tâche visible immédiatement dans le calendrier après capture avec échéance ; échec : sans échéance, jamais visible)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#colors (project-1..8, priority-*, muted) ; components.meta-pill/priority-chip (valeurs réutilisées pour .priorityDot) ; components.project-color (rotation, "Identiques en clair et en sombre")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-general-calendar.html — structure exacte de la grille mensuelle (toolbar, weekday-row, cal-grid, cal-cell/muted/today, cal-dots/prio-mini, cal-legend), valeurs hex vérifiées contre DESIGN.md]
- [Source: app/projects/[id]/project-view.tsx — `formatDueDate` (conversion locale de dueDate, même logique reprise pour `dateKey`) ; `liveQuery`/`useSyncExternalStore` (Story 3.6) réutilisé à l'identique pour l'abonnement live tâches/projets ; `PriorityChip`/`STATUS_LABELS` (précédent de labels de présentation locaux, domain/ ne connaît que les clés) ; project-view.module.css (`.tablist`/`.tab`, dupliqué en `.viewToggle`/`.viewToggleItem`, même convention "pas de classe partagée cross-module")]
- [Source: app/projects/projects-screen.tsx — `ProjectRow` (précédent `<Link href={/projects/${project.id}}>`, réutilisé pour les entrées de légende cliquables) ; `listProjects()` (data/local/projects.ts, réutilisé tel quel)]
- [Source: app/capture-flow.tsx — ancrage de `dueDate` en minuit *local* avant conversion ISO (`new Date(`${dueDate}T00:00`).toISOString()`) : confirme que `new Date(task.dueDate)` décodé en local (comme `dateKey`) retombe bien sur le jour choisi par l'utilisateur, pas un jour décalé par le fuseau]
- [Source: domain/task.ts — `Task.dueDate: string | null` (ISO 8601 UTC), `Task.projectId: string | null` (FR-2, tâche générale) ; domain/project.ts — `Project.color: ProjectColorKey`, jamais la valeur hex (résolue en CSS via `var(--color-${color})`, cf. project-view.tsx `projectSwatch`)]
- [Source: app/globals.css — tokens réactifs (`--color-surface`/`--color-border`/`--color-text`/`--color-muted`/`--color-heading` déjà adaptés au thème sombre via `prefers-color-scheme`) vs tokens bruts non réactifs (`--color-bg-alt`, `--color-project-1..8`, `--color-priority-*`) nécessitant une redéfinition explicite en sombre au niveau composant]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre.
- `npx tsc --noEmit` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker).
- **Écart corrigé par rapport au code prescrit par la story (Task 3, défaut responsive mois/semaine)** : le snippet de la story appelle `setViewMode("week")` directement au corps de l'effet (`useEffect(() => { if (...) return; setViewMode("week"); }, [])`). Testé à l'écriture de la story elle-même via `npx eslint` sur un fichier isolé reproduisant exactement ce pattern : échoue avec `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect can trigger cascading renders"), la même règle déjà documentée dans `app/projects/[id]/project-view.tsx` (Story 3.6) pour `setTasksLoadError`. Implémenté à la place avec un `MediaQueryList` + `addEventListener("change", ...)` : la valeur initiale ET les changements de breakpoint ultérieurs passent tous deux par le callback `change`, jamais par un appel synchrone direct au corps de l'effet — testé et confirmé propre via `npx eslint` avant d'écrire le fichier définitif. Un `useRef` (`userChangedViewMode`) empêche ce recalcul automatique d'écraser un choix manuel de l'utilisateur (segmented control), conformément à l'intention déjà documentée dans les Dev Notes de la story (comportement inchangé, seule l'implémentation technique diffère du snippet littéral).
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` de cette session (démarré via `preview_start`) et le projet Supabase de production réel (Guillaume authentifié lui-même au préalable dans le panneau Browser — mot de passe jamais saisi par l'agent, cf. règle de sécurité).
- Données de test créées : 2 projets ("Test Story 4.1", couleur assignée par rotation ; "Test Story 3.3" déjà existant d'une story précédente, réutilisé) et 5 tâches à échéance : "Tâche haute prio 4.1" (Test Story 4.1, priorité Haute, 20 août 2026), "Tâche normale 3.3" (Test Story 3.3, priorité Normale, 22 août 2026), "Tâche sans projet" (sans projet, priorité Basse, 25 août 2026), "Tâche mois prochain" (Test Story 4.1, priorité Normale, 5 septembre 2026), plus une tâche préexistante d'une story précédente (1er août, projet "Test Story 3.3", priorité Haute).
- **AC#1 vérifiée** : à l'ouverture de l'écran Général (vue Mois, août 2026), chaque tâche apparaît à la date exacte choisie à la capture, avec un point de la couleur de son projet (orange pour "Test Story 3.3", violet pour "Test Story 4.1") ; confirmé aussi via l'arbre d'accessibilité (`aria-label` de chaque cellule, ex. `"samedi 22 août — 1 tâche (Test Story 3.3)"`).
- **AC#2 vérifiée** : bascule Mois → Semaine sans perte d'état (`referenceDate` partagé, cf. Dev Notes) — la semaine affichée après bascule est bien celle contenant le mois affiché, la tâche du 5 septembre reste visible dans les deux modes une fois la période correspondante affichée. Navigation précédent/suivant vérifiée dans les deux modes (mois : août → septembre, la tâche du 5 septembre passe de "hors mois" (grisée, dans la grille d'août) à "dans le mois" (grille de septembre) ; semaine : la légende se met à jour pour ne plus lister que les projets réellement visibles dans la période affichée).
- **AC#3 vérifiée** : chaque tâche affiche sa puce de priorité (H/N/B) à côté du point de projet, sans effet sur son placement dans la grille (toujours à la date d'échéance) — confirmé visuellement (captures d'écran) et via `aria-label`/`title` (`"Priorité Haute"`, `"Priorité Normale"`, `"Priorité Basse"`).
- Cas "Sans projet" vérifié : point `--color-muted` (gris neutre), entrée de légende "Sans projet" (non cliquable, contrairement aux projets réels), `aria-label` de cellule `"mardi 25 août — 1 tâche (Sans projet)"`.
- Défaut responsive vérifié par rechargement complet de page (pas juste redimensionnement de fenêtre, cf. Dev Notes — l'ajustement automatique ne se déclenche qu'une fois au montage) : 375px → vue Semaine par défaut ; 1280px (desktop natif) → vue Mois par défaut. Bascule manuelle fonctionnelle dans les deux tailles.
- Non-régression vérifiée : switcher Général/Projets fonctionnel, FAB "+" utilisé 5 fois avec succès depuis l'écran Général sans régression, clic sur une entrée de légende navigue correctement vers `/projects/{id}` et affiche la vue projet intacte (onglets, tri, tâches). `read_console_messages` sans erreur applicative (seuls le bruit HMR habituel du serveur `next dev`, cf. précédent Story 3.6) ; `preview_logs` sans erreur serveur.
- **Suppression des données de test** : aucun mécanisme de suppression de tâche n'existe dans l'app (même constat que la Story 3.6 pour Supabase — AD-6 réserve tout accès Supabase au-delà de la session Auth cliente au code serveur, et aucun endpoint de suppression de tâche n'a été construit par une story précédente). Les 5 tâches et le projet "Test Story 4.1" créés pour cette vérification restent donc en base (IndexedDB + Supabase) à la fin de la session — action à faire par Guillaume s'il souhaite les retirer (Table Editor Supabase pour les tâches ; le projet "Test Story 4.1" peut être archivé depuis l'écran Projets, mais pas supprimé, cf. FR-8).

### Completion Notes List

- Toutes les tâches (1 à 4) complètes. Les 3 AC vérifiées en conditions réelles contre le projet Supabase de production (session de Guillaume, authentification jamais effectuée par l'agent).
- Un écart entre le code prescrit par la story et le code réellement écrit, corrigé avant implémentation définitive et documenté ci-dessus (Debug Log) : le pattern `setState` direct au corps d'un `useEffect` pour le défaut responsive échoue à `npm run lint` (règle `react-hooks/set-state-in-effect`) — remplacé par un pattern `MediaQueryList.addEventListener` équivalent en comportement, testé propre avant écriture du fichier définitif.
- Aucune déviation de portée par rapport à la story : aucun filtre de projet (FR-28, Story 4.2), aucune exclusion des projets archivés (FR-31, Story 4.2), aucun bouton "+ Nouveau projet" dans la toolbar (FR-30, Story 4.3) — conformément aux limites de périmètre documentées dans les Dev Notes de la story.
- Aucun framework de test automatisé dans ce projet — vérification manuelle exhaustive documentée ci-dessus, cohérente avec les Stories 1.1 à 3.6.
- Aucune nouvelle dépendance ajoutée.
- `app/page.module.css` supprimé (devenu orphelin, cf. Dev Notes de la story) — confirmé par grep qu'aucun autre fichier ne l'importait (`app/login/page.module.css` est un fichier distinct, importé par `app/login/page.tsx` via un chemin relatif propre à ce dossier).
- **Action restante pour Guillaume** : supprimer si souhaité les données de test créées pendant la vérification (2 projets, 5 tâches — détail dans le Debug Log) ; aucune suppression de tâche n'étant possible depuis l'UI, un nettoyage direct dans Supabase Table Editor est nécessaire pour les tâches.

### File List

**Créés :**
- `domain/calendar.ts`
- `app/general-screen.tsx`
- `app/general-screen.module.css`

**Modifiés :**
- `domain/index.ts` (+ export `dateKey`, `isSameDay`, `tasksWithDueDate`, `groupTasksByDueDate`, `getWeekDays`, `getMonthGridDays`, `CalendarViewMode`)
- `data/local/tasks.ts` (+ `listAllTasks`)
- `data/local/index.ts` (+ export `listAllTasks`)
- `app/page.tsx` (placeholder "Connecté." remplacé par `<GeneralScreen />`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

**Supprimés :**
- `app/page.module.css` (orphelin après le remplacement du placeholder de `app/page.tsx`)

## Change Log

- 2026-08-18 : Implémentation complète (Tasks 1 à 4). Agrégation en lecture pure des tâches à échéance (`domain/calendar.ts` — `dateKey`, `groupTasksByDueDate`, `getMonthGridDays`, `getWeekDays`), lecture de toutes les tâches (`listAllTasks`, `data/local/tasks.ts`), écran Général (`app/general-screen.tsx`) avec grille mensuelle/hebdomadaire, bascule Mois/Semaine, navigation précédent/suivant, défaut responsive (semaine mobile / mois desktop), point coloré par projet + puce de priorité par tâche, légende cliquable vers la vue projet, cas "Sans projet" traité (`--color-muted`). Écart corrigé par rapport au snippet prescrit par la story pour le défaut responsive (pattern `MediaQueryList.addEventListener` au lieu d'un `setState` direct au corps de l'effet, qui échouait à `npm run lint` — règle `react-hooks/set-state-in-effect`), cf. Debug Log. `npm run build`/`npm run lint`/`tsc --noEmit` propres. Vérification manuelle contre le projet Supabase de production réel : AC#1 (couleur par projet), AC#2 (bascule mois/semaine sans perte d'état, navigation), AC#3 (priorité visible sans effet sur la position) toutes confirmées en conditions réelles. Non-régression vérifiée (switcher, FAB, vue projet). Statut passé à `review`.
- 2026-08-18 : Revue de code (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — 0 decision-needed, 7 patch, 4 defer, 1 dismissed. Tous les patches appliqués : `formatCellLabel` inclut désormais la priorité de chaque tâche (les marqueurs visuels étaient `aria-hidden`, AC#3 échouait totalement en accessibilité) ; bordure ajoutée à `.priorityDot[data-priority="low"]` (fond identique à `.cell[data-muted="true"]` dans les deux thèmes, puce invisible sur les jours hors mois) ; `tasksLoaded`/`projectsLoaded` + `bothLoaded` (ne rendre les points/la légende qu'une fois les deux `liveQuery` — tasks et projects — chargées au moins une fois, évitait une course qui pouvait colorer une tâche avec la couleur de `project-1` et l'étiqueter "Sans projet" à tort) ; `taskLoadError`/`projectLoadError` séparés (au lieu d'un `loadError` partagé qui pouvait masquer un échec) ; grille ARIA rendue conforme au pattern WAI-ARIA (chaque semaine + l'en-tête sont des `role="row"` enfants du `role="grid"`, via un wrapper `display:contents`) ; année ajoutée au libellé de période Semaine quand elle chevauche deux années civiles ; Dev Notes corrigées sur le comportement réel du défaut responsive (réagit à chaque franchissement du seuil 768px tant qu'aucun choix manuel n'a été fait, pas seulement au montage — comportement délibéré, plus fidèle à EXPERIENCE.md que ce que le texte précédent décrivait). Reportés (préexistants ou compromis déjà assumés, sans rapport avec cette correction) : décodage du fuseau horaire de `dueDate`, perte de position de semaine après navigation-puis-bascule de vue, `listAllTasks()` en scan complet réexécuté à chaque écriture, mise en évidence de "aujourd'hui" sans minuteur. `npm run build`/`npm run lint`/`tsc --noEmit` propres après application des correctifs ; vérification manuelle des changements observables (structure ARIA via arbre d'accessibilité, priorité dans les `aria-label`, bordure de la puce Basse via styles calculés) refaite dans cette session. Statut passé à `done`.
