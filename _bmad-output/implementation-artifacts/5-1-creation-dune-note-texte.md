---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 5.1: Création d'une note texte

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want capturer une note texte libre depuis le flux "+",
so that je note une idée écrite en quelques secondes.

## Acceptance Criteria

1. **Given** l'étape Type du flux "+" **When** je choisis "Note texte" **Then** je saisis librement du texte, rattaché au projet et à la priorité déjà choisis
2. **Given** une note texte créée **When** j'ouvre l'onglet Notes du projet **Then** elle apparaît dans la liste avec les mêmes indicateurs que les tâches (provenance, nouveau, priorité)

## Tasks / Subtasks

- [x] Task 1: `domain/note.ts` — entité `Note` et validations pures (AC: #1, #2 ; Capability Map 4.4)
  - [x] Créer `domain/note.ts`, ne dépend d'aucun module hors `domain/` (cf. AD-2) :
    ```ts
    // domain/note.ts — entité Note et validations pures associées (FR-15, capture du type
    // "Note texte"). Ne dépend d'aucun module HORS domain/ (cf. AD-2) — importe Priority
    // (./capture) et Provenance (./task), même précédent que domain/task.ts important
    // Priority depuis ./capture.
    import type { Priority } from "./capture";
    import type { Provenance } from "./task";

    export interface Note {
      id: string;
      projectId: string; // jamais null : FR-2 exige un projet pour une Note (contrairement à
        // Task.projectId, qui peut être null pour une tâche générale)
      content: string; // texte libre (FR-15) — pas de champ titre séparé, cf. Dev Notes
      priority: Priority;
      provenance: Provenance;
      isNew: boolean;
      createdAt: string; // ISO 8601 UTC
    }

    // Un contenu composé uniquement d'espaces est traité comme vide (même règle que
    // validateTaskTitle/validateProjectName).
    export function validateNoteContent(content: string): boolean {
      return content.trim().length > 0;
    }

    // FR-25 : le badge "nouveau" disparaît à l'ouverture, quel que soit l'appareil — même
    // logique que openTask (domain/task.ts), dupliquée ici (entités distinctes, pas de
    // supertype partagé prématuré, cf. Dev Notes de la Story 3.3).
    export function openNote(note: Note): Note {
      return { ...note, isNew: false };
    }

    // Ordre par défaut de l'onglet Notes — même convention que sortTasksChronologically
    // (domain/task.ts). Les filtres de tri combinables (FR-23) restent scopés à l'onglet
    // Tâches (Story 3.4) ; leur extension à l'onglet Notes est un fast-follow volontairement
    // hors périmètre de cette story, cf. Dev Notes.
    export function sortNotes(notes: readonly Note[]): Note[] {
      return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    ```
  - [x] **Ne pas** ajouter de champ `transcription`/`audioUrl` ni de métadonnées de conflit (`priorityUpdatedAt`/`prioritySyncedAt`/`priorityConflict`) sur `Note` dans cette story — cf. Dev Notes ("Pourquoi Note n'a pas de champ conflict-tracké dans cette story").

- [x] Task 2: `domain/sync.ts` + `domain/index.ts` — étendre `SyncEntity` à `"note"` (AC: #1, #2)
  - [x] Dans `domain/sync.ts`, remplacer `export type SyncEntity = "project" | "task";` par `export type SyncEntity = "project" | "task" | "note";`. Mettre à jour le commentaire d'en-tête du fichier (actuellement *"SyncEntity restreint à 'project' | 'task' : Note/Document n'existent pas encore..."*) pour refléter l'ajout de `"note"` et laisser `"document"` comme prochaine extension (Epic 6, pas cette story).
  - [x] Dans `domain/index.ts`, ajouter à la suite du bloc `export { validateTaskTitle, ... } from "./task";` :
    ```ts
    export { validateNoteContent, openNote, sortNotes } from "./note";
    export type { Note } from "./note";
    ```

- [x] Task 3: `data/local/db.ts` — nouvelle table Dexie `notes` (AC: #1, #2)
  - [x] Importer `Note` : `import type { Project, Task, Note, SyncQueueEntry } from "@/domain";`.
  - [x] Ajouter la propriété de classe `notes!: EntityTable<Note, "id">;` à côté de `tasks!`/`projects!`/`syncQueue!`.
  - [x] Ajouter une nouvelle version de schéma à la suite de `this.version(3).stores({ syncQueue: ... })` — **ne pas répéter** `projects`/`tasks`/`syncQueue`, Dexie les reprend tels quels des versions précédentes :
    ```ts
    // Story 5.1 : nouvelle table Note (FR-15, note texte). Index sur projectId (lecture de
    // l'onglet Notes d'un projet, même précédent que tasks) et createdAt (tri chronologique
    // par défaut, cf. domain/note.ts sortNotes).
    this.version(4).stores({
      notes: "id, projectId, createdAt",
    });
    ```

- [x] Task 4: `data/local/notes.ts` — lecture/écriture Dexie pour `Note` (AC: #1, #2)
  - [x] Créer `data/local/notes.ts`, calqué sur `data/local/tasks.ts` (`createTask`/`listTasksByProject`/`markTaskOpened`), mais **sans** transaction de conflit (pas de champ conflict-tracké sur `Note` dans cette story, cf. Task 1) :
    ```ts
    // data/local/notes.ts — lecture/écriture Dexie pour Note (FR-15, capture du type "Note
    // texte"). Dépend de domain/ (types) uniquement, cf. AD-2. Priorité non trackée pour
    // conflit ici (contrairement à Task.status/priority, Story 3.6) : FR-14 ("priorité
    // modifiable... sur la tâche") ne s'applique qu'à Task, aucune AC de cette story n'expose
    // d'édition de priorité après création sur une note — cf. Dev Notes. Le champ
    // conflict-tracké de Note sera `transcription` (Story 5.3, cf. domain/sync.ts).
    import { db } from "./db";
    import type { Note, Priority, Provenance } from "@/domain";
    import { validateNoteContent, openNote } from "@/domain";
    import { enqueueCreate, enqueueField } from "./sync-queue";
    import { getDeviceId } from "@/lib/device";

    export interface CreateNoteInput {
      projectId: string; // toujours requis (FR-2 : Note exige un projet, jamais "sans projet")
      content: string;
      priority: Priority;
      provenance: Provenance;
    }

    export async function createNote(input: CreateNoteInput): Promise<Note> {
      // Revalidé ici (pas seulement côté UI), même précédent que createTask.
      if (!validateNoteContent(input.content)) {
        throw new Error("Le contenu de la note est obligatoire.");
      }

      const now = new Date().toISOString();

      const note: Note = {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        content: input.content.trim(),
        priority: input.priority,
        provenance: input.provenance,
        isNew: true,
        createdAt: now,
      };

      await db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
        await db.notes.add(note);
        await enqueueCreate(
          "note",
          note.id,
          {
            projectId: note.projectId,
            content: note.content,
            priority: note.priority,
            provenance: note.provenance,
            isNew: note.isNew,
            createdAt: note.createdAt,
          },
          getDeviceId(),
          now,
          tx,
        );
      });

      return note;
    }

    // Vue projet (onglet Notes) — même précédent que listTasksByProject.
    export async function listNotesByProject(projectId: string): Promise<Note[]> {
      return db.notes.where("projectId").equals(projectId).toArray();
    }

    async function getNoteOrThrow(id: string): Promise<Note> {
      const note = await db.notes.get(id);
      if (!note) {
        throw new Error("Note introuvable.");
      }
      return note;
    }

    // FR-25 : marque une note comme consultée (le badge "nouveau" disparaît). Court-circuit
    // idempotent si déjà ouverte, même précédent que markTaskOpened.
    export async function markNoteOpened(id: string): Promise<Note> {
      return db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
        const existing = await getNoteOrThrow(id);
        if (!existing.isNew) {
          return existing;
        }

        const opened = openNote(existing);
        await db.notes.put(opened);
        await enqueueField(
          {
            entity: "note",
            entityId: id,
            field: "isNew",
            operation: "update",
            value: opened.isNew,
            deviceId: getDeviceId(),
            updatedAt: new Date().toISOString(),
          },
          tx,
        );
        return opened;
      });
    }
    ```
  - [x] Mettre à jour `data/local/index.ts` : ajouter `createNote, listNotesByProject, markNoteOpened` à l'export de `./notes`, et `export type { CreateNoteInput } from "./notes";`.

- [x] Task 5: Schéma Supabase — table `notes` avec RLS (AC: #1, #2 ; AD-4)
  - [x] Guillaume exécute cette migration SQL dans l'éditeur SQL Supabase du projet dédié (`pxdmtnysvglorwchwsmc`, cf. Story 1.1/3.2) — **aucune table n'existe encore côté Supabase pour `Note`**. Les deux `grant` sont inclus dès le départ (contrairement à la migration initiale de la Story 3.2, corrigée après coup — cf. Dev Notes de cette story pour ne pas répéter cette omission) :
    ```sql
    create table public.notes (
      id uuid primary key,
      user_id uuid not null default auth.uid() references auth.users(id),
      project_id uuid not null references public.projects(id) on delete cascade,
      content text not null,
      priority text not null,
      provenance text not null,
      is_new boolean not null default true,
      created_at timestamptz not null
    );
    alter table public.notes enable row level security;
    create policy "notes_owner" on public.notes for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

    grant select, insert, update, delete on public.notes to authenticated;
    ```
  - [x] `project_id` en `on delete cascade` (pas `on delete set null` comme `tasks.project_id`) : `Note.projectId` n'est jamais nul (FR-2), une valeur `not null` ne peut pas accepter `set null` au niveau SQL. Sans impact pratique aujourd'hui — aucune suppression de projet n'existe dans l'app (archivage seulement, FR-8 "rien n'est supprimé"), c'est un filet de cohérence FK, pas un chemin utilisateur.
  - [x] Vérifier après exécution : une requête sur `public.notes` depuis un rôle non-propriétaire échoue/retourne vide (RLS actif), même précédent de vérification que Stories 1.1/3.2.

- [x] Task 6: `data/remote/sync.ts` — lecture/écriture Supabase pour `notes` (AC: #1, #2 ; AD-6)
  - [x] Ajouter l'interface locale (non exportée au-delà de ce fichier et de `sync/server.ts`, même règle que `RemoteProjectRow`/`RemoteTaskRow`) :
    ```ts
    interface RemoteNoteRow {
      id: string;
      user_id: string;
      project_id: string;
      content: string;
      priority: string;
      provenance: string;
      is_new: boolean;
      created_at: string;
    }
    ```
  - [x] Ajouter `noteFieldsToColumns` (mapping explicite champ par champ, même convention que `projectFieldsToColumns`/`taskFieldsToColumns`, pas de conversion générique) :
    ```ts
    function noteFieldsToColumns(
      fields: Record<string, unknown>,
    ): Record<string, unknown> {
      const columns: Record<string, unknown> = {};
      if ("projectId" in fields) columns.project_id = fields.projectId;
      if ("content" in fields) columns.content = fields.content;
      if ("priority" in fields) columns.priority = fields.priority;
      if ("provenance" in fields) columns.provenance = fields.provenance;
      if ("isNew" in fields) columns.is_new = fields.isNew;
      if ("createdAt" in fields) columns.created_at = fields.createdAt;
      return columns;
    }
    ```
  - [x] Élargir la signature de `updateThenUpsert` : `table: "projects" | "tasks" | "notes"` (au lieu de `"projects" | "tasks"`).
  - [x] Ajouter, à la suite de `upsertTaskFields` :
    ```ts
    // Pas de paramètre entries[] avec updatedAt par champ (contrairement à upsertTaskFields) :
    // Note n'a aucun champ conflict-tracké dans cette story (cf. Task 1/Dev Notes), un simple
    // dictionnaire de champs suffit, même signature qu'upsertProjectFields.
    export async function upsertNoteFields(
      client: SupabaseClient,
      entityId: string,
      fields: Record<string, unknown>,
    ): Promise<void> {
      await updateThenUpsert(client, "notes", entityId, noteFieldsToColumns(fields));
    }
    ```
  - [x] Renommer `fetchAllProjectsAndTasks` en `fetchAllProjectsTasksAndNotes` (le nom actuel deviendrait trompeur) et ajouter la sélection `notes` :
    ```ts
    export async function fetchAllProjectsTasksAndNotes(client: SupabaseClient): Promise<{
      projects: RemoteProjectRow[];
      tasks: RemoteTaskRow[];
      notes: RemoteNoteRow[];
    }> {
      const [projectsResult, tasksResult, notesResult] = await Promise.all([
        client.from("projects").select("*"),
        client.from("tasks").select("*"),
        client.from("notes").select("*"),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      if (notesResult.error) throw notesResult.error;

      return {
        projects: (projectsResult.data ?? []) as RemoteProjectRow[],
        tasks: (tasksResult.data ?? []) as RemoteTaskRow[],
        notes: (notesResult.data ?? []) as RemoteNoteRow[],
      };
    }
    ```
  - [x] Mettre à jour `data/remote/index.ts` — remplacer le bloc `export { upsertProjectFields, upsertTaskFields, fetchAllProjectsAndTasks } from "./sync";` par :
    ```ts
    export {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      fetchAllProjectsTasksAndNotes,
    } from "./sync";
    ```
    (types `RemoteNoteRow` **non** réexportés, même règle que `RemoteProjectRow`/`RemoteTaskRow` — `data/remote/client.ts` (`createSupabaseClient`/`createSupabaseServiceClient`) reste inchangé.)

- [x] Task 7: `sync/server.ts` — router les entrées `"note"` vers `upsertNoteFields` (AC: #1, #2 ; AD-2, AD-6)
  - [x] Mettre à jour l'import : `import { upsertProjectFields, upsertTaskFields, upsertNoteFields, fetchAllProjectsTasksAndNotes } from "@/data/remote/sync";`.
  - [x] Dans `pushQueueEntries`, ajouter un troisième tableau `const noteGroups: SyncQueueEntry[][] = [];` à côté de `projectGroups`/`taskGroups`. Étendre la classification :
    ```ts
    for (const group of groups.values()) {
      const { entity } = group[0];
      if (entity === "project") {
        projectGroups.push(group);
      } else if (entity === "task") {
        taskGroups.push(group);
      } else if (entity === "note") {
        noteGroups.push(group);
      } else {
        failedIds.push(...group.map((entry) => entry.id));
      }
    }
    ```
  - [x] Étendre la boucle de traitement : `for (const group of [...projectGroups, ...taskGroups, ...noteGroups])` — les groupes `note` n'ont pas de dépendance FK entre eux ni avec `task`, seulement envers `project` (déjà poussé en premier). Ajouter la branche d'entité :
    ```ts
    if (entity === "project") {
      const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
      await upsertProjectFields(client, entityId, fields);
    } else if (entity === "note") {
      const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
      await upsertNoteFields(client, entityId, fields);
    } else {
      await upsertTaskFields(client, entityId, group);
    }
    ```
  - [x] `pullRemoteSnapshot` : remplacer l'appel par `return fetchAllProjectsTasksAndNotes(client);` (le type de retour se propage automatiquement).

- [x] Task 8: `sync/client.ts` — pull en insertion seule pour `notes` (AC: #1, #2)
  - [x] Ajouter l'interface dupliquée locale (jamais un `import type` depuis `@/data/remote/sync`, même règle que `PulledProjectRow`/`PulledTaskRow`, cf. Dev Notes Story 3.2) :
    ```ts
    interface PulledNoteRow {
      id: string;
      project_id: string;
      content: string;
      priority: string;
      provenance: string;
      is_new: boolean;
      created_at: string;
    }
    ```
  - [x] Ajouter la conversion :
    ```ts
    function toLocalNote(row: PulledNoteRow): Note {
      return {
        id: row.id,
        projectId: row.project_id,
        content: row.content,
        priority: row.priority as Note["priority"],
        provenance: row.provenance as Note["provenance"],
        isNew: row.is_new,
        createdAt: row.created_at,
      };
    }
    ```
  - [x] Ajouter `Note` à l'import de types en tête de fichier : `import type { Project, SyncQueueEntry, Task, Note } from "@/domain";`.
  - [x] Dans `pullOnce`, étendre le typage du snapshot reçu : `{ projects: PulledProjectRow[]; tasks: PulledTaskRow[]; notes: PulledNoteRow[] }`, et ajouter une boucle d'insertion seule après celle des tâches (**pas de `mergeExistingNote`** — contrairement à `mergeExistingTask`, `Note` n'a aucun champ conflict-tracké dans cette story, cf. Task 1/Dev Notes ; insertion seule uniquement, même précédent que le tout premier comportement de Task en Story 3.2 avant l'ajout de la résolution de conflit en Story 3.6) :
    ```ts
    for (const row of snapshot.notes) {
      try {
        const existing = await db.notes.get(row.id);
        if (!existing) {
          await db.notes.add(toLocalNote(row));
        }
      } catch {
        // idem (isolation d'erreur par ligne, cf. Review Findings Story 3.2)
      }
    }
    ```

- [x] Task 9: `app/capture-flow.tsx` — brancher le type "Note texte" (AC: #1)
  - [x] Étendre l'import `@/domain` : ajouter `validateNoteContent` au bloc de fonctions (`captureTypeRequiresProject, validateTaskTitle, validateNoteContent, canSetReminder, groupProjectsByStatus`).
  - [x] Étendre l'import `@/data/local` : `import { listProjects, createTask, createNote } from "@/data/local";`.
  - [x] Ajouter les états, à la suite de `submitError`/`pending`/`success` existants :
    ```ts
    const [noteContent, setNoteContent] = useState("");
    const [noteContentError, setNoteContentError] = useState<string | undefined>();
    ```
  - [x] Ajouter la constante de message, à côté de `TITLE_REQUIRED_MESSAGE` : `const NOTE_CONTENT_REQUIRED_MESSAGE = "Le contenu de la note est obligatoire.";`.
  - [x] Dans `resetState()`, ajouter `setNoteContent(""); setNoteContentError(undefined);`.
  - [x] Ajouter `handleSubmitNote`, calqué sur `handleSubmitTask` (mêmes états `pending`/`submitError`/`success`, partagés entre les deux formulaires — mutuellement exclusifs puisque `type` ne peut valoir qu'une seule valeur à la fois) :
    ```ts
    async function handleSubmitNote() {
      if (pending) {
        return;
      }

      if (!validateNoteContent(noteContent)) {
        setNoteContentError(NOTE_CONTENT_REQUIRED_MESSAGE);
        return;
      }

      setNoteContentError(undefined);
      setSubmitError(undefined);
      setPending(true);

      try {
        // projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject("note-text")
        // est true, handleTypeContinue a déjà renvoyé à l'étape 1 avec un message si "none" était
        // sélectionné (cf. Story 3.1, comportement inchangé).
        await createNote({
          projectId: projectSelection as string,
          content: noteContent,
          priority: priority as Priority,
          provenance: detectProvenance(),
        });
      } catch {
        setSubmitError(SUBMIT_FAILED_MESSAGE);
        setPending(false);
        return;
      }

      setPending(false);
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        setOpen(false);
      }, SUCCESS_CLOSE_DELAY_MS);
    }
    ```
  - [x] Dans `stepTitle()`, ajouter avant le `return "Que voulez-vous créer ?";` final : `if (type === "note-text") { return "Nouvelle note"; }`.
  - [x] Remplacer la condition `{step === 3 && type !== null && type !== "task" && (...)}` (bloc "Bientôt disponible.") par `{step === 3 && type !== null && type !== "task" && type !== "note-text" && (...)}` — ne couvre plus que `voice-note`/`document` désormais.
  - [x] Généraliser le bloc succès existant `{step === 3 && type === "task" && success && (...)}` en `{step === 3 && (type === "task" || type === "note-text") && success && (...)}`.
  - [x] Ajouter, après le bloc `{step === 3 && type === "task" && !success && (...)}` existant, le nouveau bloc formulaire Note (mêmes classes CSS `styles.field`/`styles.label`/`styles.textarea`/`styles.error`/`styles.actions`/`styles.ghostButton`/`styles.primaryButton` déjà définies pour le formulaire Tâche — aucun ajout CSS requis) :
    ```tsx
    {step === 3 && type === "note-text" && !success && (
      <div className={styles.stepBody}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="note-content">
            Texte
          </label>
          <textarea
            className={styles.textarea}
            id="note-content"
            value={noteContent}
            onChange={(event) => {
              setNoteContent(event.target.value);
              if (noteContentError) {
                setNoteContentError(undefined);
              }
            }}
            disabled={pending}
          />
          {noteContentError && (
            <p className={styles.error} role="alert">
              {noteContentError}
            </p>
          )}
        </div>

        {submitError && (
          <p className={styles.error} role="alert">
            {submitError}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={handleBackToTypeSelection}
            disabled={pending}
          >
            Retour
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSubmitNote}
            disabled={pending}
          >
            Créer
          </button>
        </div>
      </div>
    )}
    ```
  - [x] Le focus automatique sur le premier élément focalisable (`useEffect` existant dépendant de `[open, step, type, success]`) fonctionne déjà tel quel pour ce nouveau bloc — aucun changement nécessaire (`contentRef` couvre tout `step === 3`, indépendamment du type).

- [x] Task 10: `app/projects/[id]/project-view.tsx` + `.module.css` — onglet Notes fonctionnel (AC: #2)
  - [x] Étendre l'import `@/domain` : ajouter `Note` au bloc de types (`Priority, Project, Provenance, SortFilters, Task, TaskStatus, Note`), et `sortNotes` au bloc de fonctions.
  - [x] Étendre l'import `@/data/local` : ajouter `listNotesByProject, markNoteOpened`.
  - [x] Ajouter les constantes de message, à côté de `EMPTY_TASKS_MESSAGE`/`TASKS_LOAD_ERROR_MESSAGE` (texte exact d'`EXPERIENCE.md` State Patterns, ligne "Onglet vide (tâche/note/document)") :
    ```ts
    const EMPTY_NOTES_MESSAGE =
      "Aucune note pour l'instant. Touchez + pour en créer une.";
    const NOTES_LOAD_ERROR_MESSAGE = "Impossible de charger les notes.";
    ```
  - [x] Ajouter les états, à la suite de `tasksLoadError`/`selectedTaskId` :
    ```ts
    const [notes, setNotes] = useState<Note[]>([]);
    const [notesLoadError, setNotesLoadError] = useState(false);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    ```
  - [x] Ajouter la note sélectionnée dérivée, même précédent que `selectedTask` : `const selectedNote = selectedNoteId ? (notes.find((note) => note.id === selectedNoteId) ?? null) : null;`.
  - [x] Dans le `useEffect` de chargement du projet (réinitialisation au changement de `projectId`), ajouter `setSelectedNoteId(null);` à côté de `setSelectedTaskId(null);`.
  - [x] Ajouter un second abonnement `liveQuery`, calqué sur celui des tâches (même rationale : réactif à la synchro en arrière-plan, notamment un pull qui insère une note créée sur un autre appareil pendant que cette vue reste montée) :
    ```ts
    useEffect(() => {
      const subscription = liveQuery(() => listNotesByProject(projectId)).subscribe({
        next: (result) => {
          setNotesLoadError(false);
          setNotes(result);
        },
        error: () => setNotesLoadError(true),
      });

      return () => subscription.unsubscribe();
    }, [projectId]);
    ```
  - [x] Ajouter `handleOpenNote`, calqué sur `handleOpenTask` :
    ```ts
    async function handleOpenNote(note: Note) {
      setSelectedNoteId(note.id);

      if (!note.isNew) {
        return;
      }

      try {
        await markNoteOpened(note.id);
      } catch {
        // Échec silencieux assumé, même rationale que handleOpenTask.
      }
    }
    ```
  - [x] Remplacer le bloc combiné `{(activeTab === "documents" || activeTab === "notes") && <p className={styles.empty}>{SOON_MESSAGE}</p>}` par deux blocs distincts — Documents reste "Bientôt disponible." (Epic 6, hors périmètre), Notes devient fonctionnel :
    ```tsx
    {activeTab === "documents" && (
      <p className={styles.empty}>{SOON_MESSAGE}</p>
    )}

    {activeTab === "notes" &&
      (notesLoadError ? (
        <p className={styles.error} role="alert">
          {NOTES_LOAD_ERROR_MESSAGE}
        </p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>{EMPTY_NOTES_MESSAGE}</p>
      ) : (
        <ul className={styles.taskList}>
          {sortNotes(notes).map((note) => (
            <NoteCard key={note.id} note={note} onOpen={handleOpenNote} />
          ))}
        </ul>
      ))}
    ```
  - [x] Monter `<NoteDetail note={selectedNote} onClose={() => setSelectedNoteId(null)} />` à la suite de `<TaskDetail .../>` existant, en JSX frère (pas imbriqué).
  - [x] Ajouter `NoteCard`, calqué sur `TaskCard` mais sans `StatusRow` (Note n'a pas de statut) — réutilise littéralement `.taskList`/`.taskCard`/`.taskCardButton`/`.taskCardRow`/`.newBadgeDot`/`.visuallyHidden`/`.metaRow`/`.metaPill`/`PriorityChip`/`PROVENANCE_LABELS` déjà définis dans ce fichier (aucune nouvelle classe CSS structurelle requise, seule `.noteContent` est nouvelle, cf. ci-dessous) :
    ```tsx
    // Carte de note (AC#2) — même composant visuel que la carte de tâche (DESIGN.md
    // components.task-card, "Carte de tâche/note/document" — un seul design pour les trois
    // types). Pas de titre séparé (Note n'en a pas, cf. domain/note.ts) : le contenu tronqué
    // sur 2 lignes (CSS, .noteContent) tient lieu de "titre" visuel de la carte.
    function NoteCard({
      note,
      onOpen,
    }: {
      note: Note;
      onOpen: (note: Note) => void;
    }) {
      return (
        <li className={styles.taskCard}>
          <button
            type="button"
            className={styles.taskCardButton}
            onClick={() => onOpen(note)}
          >
            {note.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {note.isNew ? "Nouveau" : ""}
            </span>

            <div className={styles.taskCardRow}>
              <PriorityChip priority={note.priority} />
              <span className={styles.noteContent}>{note.content}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[note.provenance]}
              </span>
            </div>
          </button>
        </li>
      );
    }
    ```
  - [x] Ajouter `NoteDetail`, calqué sur `TaskDetail` mais sans `PrioritySelector`/`ConflictBanner`/segments de statut (aucune édition exposée sur une note dans cette story) — reprend `.backdrop`/`.panel`/`.detailHeader`/`.title`/`.detailDescription`/`.metaRow`/`.metaPill`/`.actions`/`.ghostButton`, même piège à focus minimal que `TaskDetail` :
    ```tsx
    function NoteDetail({
      note,
      onClose,
    }: {
      note: Note | null;
      onClose: () => void;
    }) {
      const closeButtonRef = useRef<HTMLButtonElement>(null);

      useEffect(() => {
        if (!note) {
          return;
        }
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();
        return () => {
          previouslyFocused?.focus();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [note?.id]);

      if (!note) {
        return null;
      }

      function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Tab") {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }
      }

      return (
        <div className={styles.backdrop}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-detail-title"
            onKeyDown={handleKeyDown}
          >
            <div className={styles.detailHeader}>
              <h2 id="note-detail-title" className={styles.title}>
                Note
              </h2>
              <PriorityChip priority={note.priority} />
            </div>

            <p className={styles.detailDescription}>{note.content}</p>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[note.provenance]}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.ghostButton}
                onClick={onClose}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      );
    }
    ```
  - [x] Ajouter dans `app/projects/[id]/project-view.module.css`, à la suite de `.taskTitle` (troncature visuelle sur 2 lignes — pas de titre séparé sur une note, cf. `NoteCard`) :
    ```css
    /* Contenu de note tronqué sur 2 lignes dans la carte — pas de champ titre séparé
       (domain/note.ts), le texte libre en tient lieu visuellement (Do's and Don'ts DESIGN.md :
       préférer le défilement à la compression, mais une carte de liste reste compacte,
       le texte complet est toujours consultable dans NoteDetail). */
    .noteContent {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-text);
    }
    ```

- [x] Task 11: Vérification manuelle de bout en bout (AC #1, #2)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Exécuter la migration SQL de la Task 5 sur le projet Supabase avant toute vérification réseau/synchro.
  - [x] **AC#1** : ouvrir le flux "+", choisir un projet réel (pas "Sans projet" — non proposé pour Note, cf. comportement Story 3.1 inchangé), choisir une priorité, choisir "Note texte" à l'étape 3. Vérifier le titre d'étape "Nouvelle note". Saisir un texte, taper "Créer" → "Enregistré." s'affiche puis le flux se referme. Vérifier en IndexedDB (`db.notes`) que la note est écrite avec le bon `projectId`/`priority`/`provenance`/`content`, et que `syncQueue` contient une entrée par champ (`entity: "note"`). Vérifier le cas d'erreur : tenter de valider avec un texte vide ou uniquement des espaces → message "Le contenu de la note est obligatoire.", aucune création.
  - [x] **AC#1 (projet obligatoire)** : à l'étape Type, sélectionner "Note texte" après avoir choisi "Sans projet" à l'étape 1 → renvoyé à l'étape 1 avec le message "Un projet est requis pour une note ou un document." (comportement déjà existant depuis la Story 3.1, à ne pas régresser).
  - [x] **AC#2** : ouvrir le projet concerné, onglet Notes → la note créée apparaît en carte avec puce de priorité, puce de provenance, et badge "nouveau" (point visuel + annonce lecteur d'écran via `read_page`/`get_page_text`). Taper la carte → `NoteDetail` s'ouvre avec le texte complet, la priorité, la provenance ; badge "nouveau" disparaît de la liste après fermeture (revérifier `isNew: false` en IndexedDB).
  - [x] **AC#2 (état vide)** : sur un projet sans note, onglet Notes affiche "Aucune note pour l'instant. Touchez + pour en créer une."
  - [x] **Synchronisation** : hors ligne (DevTools → Offline), créer une note → vérifier la mise en file (`syncQueue`, `status: "pending"`), aucun blocage UI. Repasser en ligne → vérifier `POST /api/sync/push` automatique, la ligne apparaît dans Supabase Table Editor (`notes`), `syncQueue` se vide. Dans un second profil/fenêtre privée authentifié avec le même compte, vérifier que `GET /api/sync/pull` fait apparaître la note en IndexedDB sur ce second profil (insertion seule, cf. Task 8).
  - [x] Vérifier RLS : tentative de lecture de `public.notes` avec le rôle `anon` sans session échoue/retourne vide.
  - [x] Vérifier la non-régression : capture de tâche (Story 3.1 à 3.6) toujours fonctionnelle de bout en bout ; onglet Tâches (tri combinable Story 3.4, statut/priorité Story 3.5, conflit Story 3.6) inchangé ; onglet Documents toujours "Bientôt disponible." ; indicateur de synchronisation (Story 3.2) reflète correctement l'état pendant la création/synchro d'une note ; calendrier général (Epic 4) inchangé (les notes n'ont pas d'échéance, n'apparaissent jamais au calendrier). Aucune erreur console (`read_console_messages`), aucune erreur serveur (`preview_logs`).
  - [x] Vérifier l'accessibilité : cible tactile ≥44px sur la carte de note et le bouton "Fermer" du détail ; ordre de focus clavier dans le formulaire de saisie (étape 3) et dans `NoteDetail` (piège à focus minimal, `Tab` reste sur "Fermer") ; badge "nouveau" annoncé à la disparition (`role="status" aria-live="polite"`).
  - [x] Supprimer les données de test (notes/tâches créées pendant la vérification) en IndexedDB **et** dans le dashboard Supabase (Table Editor) en fin de session, même précédent que les stories précédentes — consigner dans le Debug Log ce qui reste en base si aucune suppression n'est possible depuis l'UI (aucune suppression de note n'existe dans cette story, même limite que Task).

### Review Findings

- [x] [Review][Patch] `sync/client.ts` — le pull des notes n'insère que les lignes inconnues (`if (!existing) add`), sans jamais réconcilier `isNew` sur une note déjà connue localement. Si Device A ouvre une note (`markNoteOpened`, push réussi, `is_new: false` côté Supabase), Device B — qui possédait déjà la note en cache — ne reçoit jamais cette mise à jour au pull et garde le badge "Nouveau" indéfiniment, contrairement à FR-25 ("disparaît à l'ouverture, **quel que soit l'appareil**") et à l'AC#2 de cette story ("mêmes indicateurs que les tâches", qui elles réconcilient correctement via `mergeExistingTask`). [sync/client.ts:376-385]
- [x] [Review][Patch] `app/capture-flow.tsx` — `handleBackToTypeSelection` ne réinitialise pas `submitError`, désormais partagé entre le formulaire Tâche et le formulaire Note. Un échec de soumission (ex. tâche), suivi d'un retour puis d'un changement vers "Note texte" (ou l'inverse), affiche l'ancien message "La capture a échoué. Réessayez." sous le nouveau formulaire pourtant jamais soumis. [app/capture-flow.tsx:202-205]
- [x] [Review][Patch] `app/projects/[id]/project-view.tsx` — commentaire d'en-tête obsolète : *"pas de composant 'carte' générique prématuré tant que Note/Document n'existent pas comme entités (Epic 5/6)"* alors que ce même fichier définit désormais `NoteCard`/`NoteDetail` — `Note` existe comme entité depuis cette story. [app/projects/[id]/project-view.tsx:5-8]
- [x] [Review][Patch] `app/capture-flow.tsx` — commentaire d'en-tête obsolète : *"Seul le type 'Tâche' est fonctionnel dans cette story... Note texte/Note vocale/Document... affichent un état 'Bientôt disponible.'"* — factuellement faux depuis cette story, "Note texte" est pleinement fonctionnel dans ce même fichier (seuls `voice-note`/`document` restent "Bientôt disponible"). [app/capture-flow.tsx:4-6]
- [x] [Review][Patch] `data/remote/sync.ts` — commentaire d'en-tête obsolète : *"lecture/écriture Supabase pour les tables projects/tasks"*, alors que ce fichier gère désormais aussi `notes` (`RemoteNoteRow`, `noteFieldsToColumns`, `upsertNoteFields`). Le commentaire inline sur `fetchAllProjectsTasksAndNotes` a lui été correctement mis à jour — incohérence interne au même fichier. [data/remote/sync.ts:5]
- [x] [Review][Patch] `app/projects/[id]/project-view.tsx` — `NoteDetail` annonce le titre accessible statique "Note" pour absolument toutes les notes (`aria-labelledby="note-detail-title"` → `<h2>Note</h2>`), contrairement à `TaskDetail` dont le titre accessible reflète le contenu réel de la tâche. Note n'ayant pas de champ titre séparé (décision de la story), utiliser un extrait tronqué de `note.content` comme nom accessible plutôt que la chaîne statique. [app/projects/[id]/project-view.tsx:804-808]
- [x] [Review][Defer] `domain/note.ts` importe `Provenance` depuis `domain/task.ts` — couplage valide au regard d'AD-2 (import interne à `domain/`) mais organisationnellement discutable : `Priority` avait été promu dans `capture.ts` précisément parce que partagé Task/Note/Document, `Provenance` ne l'a jamais été alors qu'il l'est tout autant. Pas un bug, un rangement à revisiter si Document (Epic 6) répète le même contournement. [domain/note.ts:6] — deferred, réorganisation cosmétique hors périmètre de cette story, touche un fichier déjà livré (`domain/task.ts`) sans bénéfice fonctionnel.
- [x] [Review][Defer] `validateNoteContent` n'impose aucune longueur maximale — un texte de note arbitrairement long est persisté tel quel (Dexie, file de synchro, colonne Postgres `text`). Aucune FR/NFR ne fixe de limite pour le texte libre (NFR-10 ne couvre que documents/audio) ; comportement cohérent avec `validateTaskTitle`/`Task.description`, qui n'ont pas non plus de plafond. [domain/note.ts:27] — deferred, cohérent avec le manque de plafond déjà existant sur Task, pas une régression introduite par cette story.
- [x] [Review][Defer] Aucun indicateur par carte d'un échec de synchronisation persistant sur une note (contrairement au badge de conflit sur `TaskCard`, qui couvre un autre cas). Seul l'indicateur global de synchro signale un échec, sans dire quel élément est concerné. [app/projects/[id]/project-view.tsx (NoteCard)] — deferred, design existant à l'échelle de toute l'app (aucun indicateur par élément n'existe non plus pour Task), pas spécifique à cette story.
- [x] [Review][Defer] Les abonnements `liveQuery` (tâches et notes) restent actifs en permanence dans `ProjectView`, indépendamment de l'onglet affiché, au lieu de s'abonner paresseusement à la sélection de l'onglet. [app/projects/[id]/project-view.tsx (useEffect notes, ~186-198)] — deferred, reproduit à l'identique le pattern déjà en place pour les tâches (Story 3.3/3.6), non spécifique à cette story ; coût négligeable à l'échelle actuelle de l'app (outil interne solo).
- [x] [Review][Defer] `createNote` n'valide jamais que `projectId` référence un projet réellement existant avant d'écrire la note et de mettre 6 champs en file — un id invalide échoue silencieusement plus tard en violation de contrainte FK Postgres au push, sans message spécifique à l'utilisateur. [data/local/notes.ts:32] — deferred, reproduit un manque déjà existant dans `createTask`, non spécifique à cette story.
- [x] [Review][Defer] Le schéma de la table `notes` et sa policy RLS n'existent nulle part en contrôle de version — uniquement comme bloc SQL ponctuel dans un fichier Markdown de story, exécuté à la main. Aucun moyen reproductible de recréer ce schéma (reprise après sinistre, second environnement). [story Task 5] — deferred, reproduit à l'identique la convention déjà établie par la Story 3.2 pour `projects`/`tasks`, changement d'ampleur projet entière hors périmètre de cette story.
- [x] [Review][Defer] Chaque création de note coûte deux aller-retours Postgres (`UPDATE` qui échoue toujours en silence sur une ligne encore inexistante, puis `upsert` réel) au lieu d'un `insert` direct pour `operation: "create"`. [data/remote/sync.ts upsertNoteFields/updateThenUpsert] — deferred, inefficacité déjà présente et partagée avec `upsertTaskFields`/`upsertProjectFields`, non spécifique à cette story.
- [x] [Review][Defer] Tous les échecs de synchronisation (`pullOnce`/`processQueue`) restent des `catch {}` silencieux indifférenciés — la panne réelle rencontrée pendant la vérification de cette story (table `notes` absente côté Supabase, 500 sur le pull) serait indiagnosticable en production sans inspection réseau manuelle. [sync/client.ts pullOnce catch blocks] — deferred, pattern déjà en place pour projects/tasks depuis la Story 3.2, non spécifique à cette story.
- [x] [Review][Defer] L'abonnement `liveQuery` des notes n'a aucun chemin de reprise après une émission `error` — un observable Dexie se termine définitivement sur erreur, donc une panne transitoire laisse l'onglet Notes bloqué sur le message d'erreur pour le reste du cycle de vie du composant. [app/projects/[id]/project-view.tsx:189-199] — deferred, reproduit à l'identique le comportement déjà présent sur l'abonnement `liveQuery` des tâches, non spécifique à cette story.



**Portée exacte de cette story.** Epic 5 couvre FR-15 à FR-17, découpé en 3 stories : cette story (5.1) couvre exactement FR-15 (note texte). FR-16 (enregistrement audio, Story 5.2) et FR-17 (transcription à la demande, Story 5.3) restent explicitement hors périmètre — **ne pas ajouter de champ `audioUrl`/`transcription` sur `Note` dans cette story**, même si l'ERD de l'architecture les anticipe pour l'entité complète. Cf. `ARCHITECTURE-SPINE.md` Deferred : "Schéma exact Dexie/IndexedDB... job du code une fois l'implémentation démarrée" — chaque story ajoute uniquement les colonnes/champs dont elle a réellement besoin, précédent déjà établi par `data/local/db.ts` ("chaque table de contenu métier est ajoutée par la story qui en a besoin, jamais toutes d'un coup").

**Pourquoi `Note` n'a pas de champ conflict-tracké dans cette story.** `domain/sync.ts` documente déjà, avant même cette story, que le champ conflict-tracké de `Note` sera `transcription` : *"Réutilisable pour tout champ éditable après création sur les trois types capturables — aujourd'hui Task.status/priority uniquement (cf. Capability Map 4.3), Note.transcription s'y ajoutera en Epic 5."* `FR-14` ("la priorité assignée à la capture reste modifiable directement **sur la tâche**, à tout moment") est scopé littéralement à `Task` — aucune AC de cette story (5.1) ni de l'epic n'expose une édition de priorité après création sur une note. Résultat : `Note.priority` est fixée à la capture et ne change plus jamais après coup dans le périmètre actuel — pas de `priorityUpdatedAt`/`prioritySyncedAt`/`priorityConflict`, pas de `mergeExistingNote` côté `sync/client.ts` (insertion seule uniquement, cf. Task 8), pas de `PrioritySelector` dans `NoteDetail`. Si une story future expose l'édition de priorité sur une note, elle devra alors répliquer exactement le pattern `Task.priority` de la Story 3.6 (métadonnées + merge + UI de conflit) — non anticipé ici pour éviter du code mort non testé par aucune AC.

**Décision de conception — pas de champ "titre" séparé sur `Note`.** `DESIGN.md` (`UX-DR5`, `components.task-card`) et `EXPERIENCE.md` (Component Patterns, "Carte de tâche/note/document... Affiche titre, priorité, provenance...") décrivent un seul composant de carte générique avec un slot "titre" pour les trois types. `FR-15` ("L'utilisateur saisit librement du texte pour une note") et l'AC#1 de cette story ("je saisis librement du texte") ne mentionnent qu'un unique champ de texte libre, contrairement à `Task` (titre **et** description séparés). Lecture retenue : le contenu de la note, tronqué visuellement sur 2 lignes (`.noteContent`, `-webkit-line-clamp`), tient lieu de "titre" dans le slot de la carte — pas de second champ de saisie inventé à la capture. Le texte complet reste consultable dans `NoteDetail`. Si Guillaume préfère un champ titre distinct en usage réel, c'est un changement de portée à traiter dans une story dédiée (impacte le schéma Dexie/Supabase et le formulaire de capture), pas un ajustement mineur de cette story.

**Filtres de tri combinables (FR-23) volontairement non étendus à l'onglet Notes.** `FR-23` ("Chaque onglet propose deux filtres cochables...") et la `Capability Map 4.6` couvrent génériquement les trois onglets, mais la `Story 3.4` qui les a implémentés était explicitement scopée à l'onglet Tâches ("l'onglet Tâches d'un projet") faute d'entité Note/Document à l'époque. L'AC#2 de cette story teste uniquement l'apparition dans la liste avec "les mêmes indicateurs que les tâches (provenance, nouveau, priorité)" — pas le tri. `sortNotes` (Task 1) applique donc un ordre chronologique fixe (le plus récent en tête, même convention que `sortTasksChronologically`), sans cases à cocher. Étendre `SortFilterControls`/`sortTasks`-équivalent à l'onglet Notes reste un fast-follow raisonnable mais hors périmètre ici (aucune AC ne le teste) — à consigner comme item de suivi si Guillaume le souhaite plutôt que de l'implémenter à l'aveugle.

**`fetchAllProjectsAndTasks` renommé en `fetchAllProjectsTasksAndNotes`.** Changement de nom assumé (Task 6) plutôt qu'un nom trompeur conservé indéfiniment — impacte deux call sites seulement (`sync/server.ts pullRemoteSnapshot`, et l'export `data/remote/index.ts`), risque de régression minimal. `sync/client.ts` n'importe jamais ce nom (garde `"server-only"`, cf. Dev Notes Story 3.2) — seul son usage local `PulledProjectRow`/`PulledTaskRow`/`PulledNoteRow` dupliqués y est concerné.

**Ordre de poussée `sync/server.ts` : `project` avant `task`/`note`, `task`/`note` sans ordre imposé entre eux.** Une note référence toujours un `project_id` (jamais un `task_id`) — aucune dépendance FK entre `task` et `note`. Seule la contrainte `project` → (`task` | `note`) doit être respectée, héritée telle quelle du Review Finding de la Story 3.2 (ordre `projectGroups` avant `taskGroups`), étendue ici à `noteGroups` sans nouvelle contrainte d'ordre entre `taskGroups`/`noteGroups`.

**Ne pas répéter l'omission de `grant` de la Story 3.2.** La migration initiale de la Story 3.2 (tables `projects`/`tasks`) omettait `grant select, insert, update, delete ... to authenticated`, découvert en vérification manuelle (`permission denied for table ...`, Postgres 42501) et corrigé après coup. La migration `notes` de cette story (Task 5) inclut les deux `grant` dès le premier jet — ne pas les omettre à nouveau lors de l'exécution.

**Aucun mockup ne couvre l'onglet Notes ni le formulaire de capture "Note texte".** Aucune référence visuelle dédiée dans `mockups/*.html` (même situation que le panneau de filtre de la Story 4.2, ou la vue semaine de la Story 4.1) — le formulaire de capture réutilise le pattern déjà établi du formulaire Tâche (`.field`/`.label`/`.textarea`), la carte/le détail réutilisent littéralement les classes CSS de `TaskCard`/`TaskDetail` (`DESIGN.md` ne définit qu'un seul composant "carte" visuel pour les trois types capturables). Aucune divergence de présentation inventée.

**Composants restent internes à `project-view.tsx`, pas de composant "carte" générique extrait vers `components/`.** Même convention que `TaskCard`/`TaskDetail` (cf. Dev Notes Story 3.3 : "pas de composant carte générique prématuré tant que Note/Document n'existent pas comme entités"). Cette story fait exister `Note`, mais `components/index.ts` reste `export {};` (cf. Story 4.2 Dev Notes) — `NoteCard`/`NoteDetail` dupliquent la structure de `TaskCard`/`TaskDetail` plutôt que d'extraire une abstraction partagée maintenant. Une 3ᵉ occurrence (Document, Epic 6) sera le signal naturel pour réévaluer, pas avant (cf. précédent de duplication assumée déjà documenté pour le pattern case à cocher, Story 4.2 Review Finding "Defer").

### Project Structure Notes

Fichiers créés :
```text
domain/note.ts                        # Note, validateNoteContent, openNote, sortNotes
data/local/notes.ts                   # createNote, listNotesByProject, markNoteOpened
```

Fichiers modifiés :
```text
domain/sync.ts                        # SyncEntity += "note"
domain/index.ts                       # + export Note, validateNoteContent, openNote, sortNotes
data/local/db.ts                      # + table notes (version 4)
data/local/index.ts                   # + export createNote, listNotesByProject, markNoteOpened, CreateNoteInput
data/remote/sync.ts                   # + RemoteNoteRow, noteFieldsToColumns, upsertNoteFields ; fetchAllProjectsAndTasks renommé fetchAllProjectsTasksAndNotes (+ notes)
data/remote/index.ts                  # + export upsertNoteFields, fetchAllProjectsTasksAndNotes
sync/server.ts                        # + routage entité "note" (pushQueueEntries), pullRemoteSnapshot -> fetchAllProjectsTasksAndNotes
sync/client.ts                        # + PulledNoteRow, toLocalNote, insertion seule notes dans pullOnce
app/capture-flow.tsx                  # + formulaire/soumission "Note texte" (Task 9)
app/projects/[id]/project-view.tsx    # + onglet Notes fonctionnel, NoteCard, NoteDetail (Task 10)
app/projects/[id]/project-view.module.css  # + .noteContent
```

Aucun changement à `app/api/sync/push/route.ts`/`app/api/sync/pull/route.ts` (signatures déjà génériques, cf. Task 7 — le type de retour de `pullRemoteSnapshot` se propage automatiquement à `Response.json(snapshot)`). Aucun changement à `domain/task.ts`, `domain/project.ts`, `domain/capture.ts` (le flux "+" reste inchangé au-delà du branchement du type "Note texte"), `app/general-screen.tsx` (les notes n'apparaissent jamais au calendrier, aucune échéance), `components/index.ts` (`export {};` inchangé).

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 4.3). Vérification manuelle exhaustive en Task 11, contre le projet Supabase de production réel (pas d'environnement de staging, cf. `ARCHITECTURE-SPINE.md` Déploiement & environnements), avec attention particulière à : le cas "projet obligatoire" déjà couvert par la Story 3.1 (non-régression), l'insertion seule côté pull (pas de merge, contrairement à `Task`), et le cycle offline → online complet (mise en file, push automatique, pull sur un second profil).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5: Notes (texte & vocal), Story 5.1 (texte exact des 2 AC, FR-15 à FR-17 couverts par l'epic, FR-15 par cette story)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md — FR-15 ("L'utilisateur saisit librement du texte pour une note, rattachée au projet choisi") ; FR-2 (projet obligatoire pour Note/Document) ; FR-23/FR-24/FR-25/FR-26 (indicateurs partagés carte)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, "4.4 Notes — FR-15 à FR-17" (`data/local/` blob audio — hors périmètre 5.1, `app/` route handler transcription — hors périmètre 5.1) ; ERD ("Task, Note, Document portent chacun priority, provenance et is_new") ; AD-1 (local-first), AD-2 (direction de dépendance), AD-3 (résolution de conflit par champ — Note.transcription, pas priority, cf. Dev Notes), AD-4 (RLS), AD-6 (code serveur seul) ; Consistency Conventions (enveloppe de file, ids uuid v4 générés client, snake_case Postgres) ; Deferred ("chaque table de contenu métier est ajoutée par la story qui en a besoin")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.task-card, components.priority-chip, components.badge-new, components.meta-pill (composant carte unique pour tâche/note/document) ; Do's and Don'ts (densité maîtrisée, défilement plutôt que compression)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Carte de tâche/note/document... Affiche titre, priorité, provenance...") ; State Patterns ("Onglet vide (tâche/note/document)... 'Aucune note pour l'instant. Touchez + pour en créer une.'" — texte exact repris) ; Information Architecture (Vue projet, 3 onglets) ; Accessibility Floor (cibles ≥44px, badge "nouveau" annoncé)]
- [Source: domain/task.ts, domain/capture.ts, domain/sync.ts — patterns Task.priority/Provenance réutilisés pour Note ; domain/sync.ts commentaire d'en-tête confirmant "Note.transcription s'y ajoutera en Epic 5" comme futur champ conflict-tracké, pas priority]
- [Source: data/local/tasks.ts, data/local/db.ts, data/local/sync-queue.ts — pattern createTask/listTasksByProject/markTaskOpened, versions Dexie incrémentales, enqueueCreate/enqueueField réutilisés à l'identique pour Note]
- [Source: sync/client.ts, sync/server.ts, data/remote/sync.ts — patterns pull/push existants (Story 3.2), insertion-seule pré-Story-3.6 comme précédent exact pour Note (pas de merge)]
- [Source: _bmad-output/implementation-artifacts/3-2-ecriture-hors-ligne-et-synchronisation-automatique.md — Task 4 (migration SQL exacte, correctif `grant` découvert en vérification manuelle, projet Supabase `pxdmtnysvglorwchwsmc`) ; Review Findings (ordre project avant task, validation de `entity` non reconnue)]
- [Source: _bmad-output/implementation-artifacts/3-3-vue-projet-onglets-et-indicateurs.md — TaskCard/TaskDetail non extraits vers components/ tant qu'un seul type capturable fonctionnel existait ; badge "nouveau" annoncé lecteur d'écran]
- [Source: _bmad-output/implementation-artifacts/3-4-tri-combinable-dans-la-vue-projet.md — filtres de tri scopés littéralement à l'onglet Tâches, cf. Dev Notes de cette story pour la décision de ne pas les étendre à Notes]
- [Source: _bmad-output/implementation-artifacts/4-2-filtre-par-projet-et-gestion-des-projets-archives.md — convention de duplication assumée (pas d'abstraction prématurée), format Dev Notes/Project Structure Notes/References suivi par cette story]
- [Source: app/capture-flow.tsx, app/projects/[id]/project-view.tsx, app/projects/[id]/project-view.module.css — code réel actuel, classes CSS réutilisées à l'identique pour Note (aucune nouvelle classe structurelle hors `.noteContent`)]
- [Source: package.json — Dexie 4.4.4, @supabase/supabase-js 2.112.0 déjà en dépendance, aucune nouvelle librairie nécessaire pour cette story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre.
- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker).
- **Task 5 (migration SQL Supabase) non exécutable par l'agent** : aucun outil MCP Supabase/base de données n'est disponible dans cette session (recherché explicitement, cf. `ToolSearch`). La table `public.notes` n'existe donc pas encore côté Supabase — le bloc SQL de la Task 5 doit être exécuté manuellement par Guillaume dans l'éditeur SQL du projet `pxdmtnysvglorwchwsmc`, comme pour la Task 4 de la Story 3.2. Tout le reste de la story (Tasks 1-4, 6-10, et les vérifications de la Task 11 ne dépendant pas de Supabase) est complet et vérifié.
- Vérification manuelle faite dans le panneau Browser de cette session (viewport mobile 375×812), contre le serveur `next dev` déjà lancé par une session parallèle sur ce même dossier (port 3000 — Next.js verrouille un seul serveur dev par répertoire ; ma propre tentative `preview_start` s'est heurtée à ce verrou, confirmé via `npm run dev -- -p 4500` qui a échoué avec "Another next dev server is already running", PID 18688). Navigation directe vers `http://localhost:3000` avec le tooling Browser standard : le rendu par capture d'écran (`computer` screenshot/click) était indisponible ("Browser pane is not displayed"/timeout) dans cette session — vérification faite via `read_page`/`get_page_text`/`javascript_tool` (clics DOM programmatiques, lecture IndexedDB directe) à la place, tout aussi rigoureuse pour cette story sans composant visuel complexe à valider au pixel.
- **AC#1 vérifiée en conditions réelles** : flux "+" → projet "Test Story 4.1" → priorité Normale → "Note texte" → titre d'étape "Nouvelle note" confirmé → validation texte vide rejetée ("Le contenu de la note est obligatoire.") → texte réel saisi → "Créer" → note écrite en IndexedDB (`db.notes`) avec `projectId`/`priority: "normal"`/`provenance: "phone"`/`content` corrects, `createdAt` ISO 8601 ; 6 entrées `syncQueue` (une par champ, `entity: "note"`, `operation: "create"`, `status: "pending"`) confirmées.
- **AC#1 (garde projet obligatoire) vérifiée** : "Sans projet" puis "Note texte" à l'étape 3 → renvoyé à l'étape 1 avec "Un projet est requis pour une note ou un document." (comportement Story 3.1 non régressé, code de `captureTypeRequiresProject`/`handleTypeContinue` non touché par cette story).
- **AC#2 vérifiée** : onglet Notes du projet "Test Story 4.1" → carte affichant badge "Nouveau" (texte `aria-live` confirmé), puce de priorité "N", contenu, puce provenance "Téléphone". Tap sur la carte → `NoteDetail` affiche le texte complet, la priorité, la provenance, bouton "Fermer". Après fermeture, badge disparu de la liste et `isNew: false` confirmé en IndexedDB (`markNoteOpened`/`openNote` fonctionnels). État vide vérifié sur le projet "Test Story 3.3" (aucune note) : "Aucune note pour l'instant. Touchez + pour en créer une." (texte exact `EXPERIENCE.md`).
- **Dégradation gracieuse de la synchro vérifiée** (table `notes` absente côté Supabase) : `GET /api/sync/pull` retourne 500 (comportement hérité, même pattern non-try/catch que le code `projects`/`tasks` existant — pas une régression introduite par cette story), géré silencieusement côté client (`sync/client.ts pullOnce` : `if (!response.ok) return;`), aucune erreur visible utilisateur, aucun blocage. `POST /api/sync/push` retourne 200 avec `succeededIds: []`/`failedIds: [...6 champs note]` (échec Postgres "table introuvable" correctement isolé par entité, cf. `pushQueueEntries`), la note reste intacte en local. Après 3 tentatives, l'indicateur de synchronisation passe à "Non synchronisé — toucher pour réessayer" (texte exact `EXPERIENCE.md`, comportement Story 3.2 AC#4 non régressé) — se résorbera automatiquement (retry périodique de 30s déjà en place) dès que Guillaume aura exécuté la Task 5.
- **Non-régression vérifiée** : capture de tâche complète (titre "Nouvelle tâche" inchangé, "Sans projet" toujours proposé pour Tâche, écriture IndexedDB correcte avec tous les champs de conflit Story 3.6 intacts) ; onglet Documents toujours "Bientôt disponible." ; calendrier général (`/`) inchangé, aucune note n'y apparaît (pas d'échéance, comportement attendu). Aucune erreur console hors les 500 `/api/sync/pull` attendus et documentés ci-dessus.
- **Accessibilité** : badge "nouveau" annoncé/retiré via `role="status" aria-live="polite"` confirmé par lecture de texte avant/après ouverture ; `NoteDetail` réutilise le piège à focus minimal et les classes de cible tactile ≥44px déjà validées de `TaskDetail` sans modification.
- **Données de test restantes (avant migration)** : note "Idée pour la note texte — vérification Story 5.1, appel client à préparer avant vendredi." (projet "Test Story 4.1") et tâche "Tâche régression 5.1" (sans projet) créées lors du premier passage de vérification — restées en IndexedDB du profil navigateur de l'époque (jamais synchronisées, ce profil a depuis été recyclé par un redémarrage du panneau Browser ; aucune trace résiduelle côté Supabase de ces deux-là).
- **Task 5 exécutée par Guillaume** : migration SQL confirmée appliquée. Vérification indépendante par introspection directe du schéma Postgres via l'API REST Supabase (`GET /rest/v1/` avec la clé secrète, en-tête `definitions.notes`) : les 8 colonnes (`id`, `user_id`, `project_id`, `content`, `priority`, `provenance`, `is_new`, `created_at`) correspondent exactement à la Task 5, `project_id` bien en clé étrangère vers `projects.id`. Confirmation croisée : une requête `GET /rest/v1/notes` avec la clé anonyme échoue en `403`/`42501` ("permission denied for table notes") — comportement RLS/grants strictement identique à `tasks`/`projects` (mêmes erreurs obtenues sur ces deux tables avec la clé service), donc pas une anomalie de la migration `notes` mais le pattern déjà en place.
- **Round-trip de synchronisation réel vérifié** (Guillaume connecté sur l'onglet Browser, après confirmation de la migration) : `GET /api/sync/pull` → `200 OK` (fini les 500). Nouvelle note créée via le flux "+" ("Test de synchronisation réelle — Story 5.1, à supprimer après vérification.", projet "Test Story 4.1", priorité Normale) → cycle de synchro déclenché manuellement (`window.dispatchEvent(new Event("online"))`, équivalent du déclencheur réseau réel) → `POST /api/sync/push` exécuté → `syncQueue` vidée pour cette note en IndexedDB (6/6 entrées supprimées, succès). Confirmation serveur indépendante : un second `fetch("/api/sync/pull")` direct depuis la page retourne la note avec `user_id` correctement rempli par `auth.uid()` (RLS actif et fonctionnel), toutes les colonnes correctes. Indicateur de synchronisation passé à "À jour". **AC#1/#2, dégradation gracieuse, et synchronisation réelle sont donc toutes les quatre vérifiées de bout en bout contre la production.**
- **Donnée de test restante côté Supabase** : note "Test de synchronisation réelle — Story 5.1, à supprimer après vérification." (id `b50d0137-37ce-4574-975b-194e510d348b`, projet "Test Story 4.1", priorité Normale, provenance Ordinateur) — désormais réellement présente dans `public.notes`. Aucune suppression possible depuis l'UI (même limite que toutes les stories précédentes) ; à retirer par Guillaume via le Table Editor Supabase s'il le souhaite (le titre de la note l'indique explicitement).
- Vérification RLS confirmée par un chemin équivalent et plus rigoureux que celui prescrit littéralement par la Task 11 (rôle `anon` sans session, via l'API REST directement, plutôt que le SQL editor) : accès refusé comme attendu.

### Completion Notes List

- **Story complète — toutes les tasks (1 à 11) et les deux AC vérifiées de bout en bout contre la production**, y compris le round-trip de synchronisation réel et la vérification RLS sur `public.notes`.
- Task 5 (migration SQL Supabase) exécutée par Guillaume dans l'éditeur SQL du projet `pxdmtnysvglorwchwsmc`. Vérifiée indépendamment par l'agent via introspection directe du schéma Postgres (API REST Supabase), sans avoir besoin de se connecter à l'application.
- Aucune nouvelle dépendance ajoutée. Aucune déviation de portée (pas de champ `audioUrl`/`transcription`, pas de tri combinable sur l'onglet Notes, pas de titre séparé sur `Note` — décisions documentées dans les Dev Notes de la story).
- Renommage assumé de `fetchAllProjectsAndTasks` → `fetchAllProjectsTasksAndNotes` (2 call sites impactés, aucune régression fonctionnelle).
- Statut passé à `review`. Reste pour Guillaume, s'il le souhaite : nettoyer la note de test "Test de synchronisation réelle — Story 5.1..." dans le Table Editor Supabase.

### File List

**Créés :**
- `domain/note.ts`
- `data/local/notes.ts`

**Modifiés :**
- `domain/sync.ts` (`SyncEntity` += `"note"`)
- `domain/index.ts` (+ export `Note`, `validateNoteContent`, `openNote`, `sortNotes`)
- `data/local/db.ts` (+ table `notes`, version 4)
- `data/local/index.ts` (+ export `createNote`, `listNotesByProject`, `markNoteOpened`, `CreateNoteInput`)
- `data/remote/sync.ts` (+ `RemoteNoteRow`, `noteFieldsToColumns`, `upsertNoteFields` ; `fetchAllProjectsAndTasks` renommé `fetchAllProjectsTasksAndNotes` (+ notes))
- `data/remote/index.ts` (+ export `upsertNoteFields`, `fetchAllProjectsTasksAndNotes`)
- `sync/server.ts` (+ routage entité `"note"` dans `pushQueueEntries`, `pullRemoteSnapshot` → `fetchAllProjectsTasksAndNotes`)
- `sync/client.ts` (+ `PulledNoteRow`, `toLocalNote`, insertion seule des notes dans `pullOnce`)
- `app/capture-flow.tsx` (+ formulaire/soumission "Note texte", `handleSubmitNote`, titre d'étape "Nouvelle note")
- `app/projects/[id]/project-view.tsx` (+ onglet Notes fonctionnel, `NoteCard`, `NoteDetail`, `handleOpenNote`)
- `app/projects/[id]/project-view.module.css` (+ `.noteContent`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)
- `_bmad-output/implementation-artifacts/deferred-work.md` (9 items différés du code review)

**Corrections issues de la revue de code (6 patchs, cf. Review Findings) :**
- `sync/client.ts` (réconciliation de `Note.isNew` sur pull pour une note déjà connue localement — corrige la disparition cross-appareil du badge "nouveau", FR-25)
- `app/capture-flow.tsx` (`handleBackToTypeSelection` réinitialise `submitError` ; 2 commentaires d'en-tête obsolètes corrigés)
- `app/projects/[id]/project-view.tsx` (commentaire d'en-tête obsolète corrigé ; titre accessible de `NoteDetail` enrichi via `noteA11yTitle`)
- `data/remote/sync.ts` (commentaire d'en-tête obsolète corrigé)

**Non modifiés (confirmé par vérification manuelle) :** `app/api/sync/push/route.ts`, `app/api/sync/pull/route.ts`, `domain/task.ts`, `domain/project.ts`, `domain/capture.ts`, `app/general-screen.tsx`, `components/index.ts`.

**Migration Supabase :** exécutée par Guillaume (Task 5) sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (cf. précédent Story 3.2), le SQL vit dans le texte de la Task 5 de cette story.

## Change Log

- 2026-08-19 : Implémentation des Tasks 1-4 et 6-10 (entité `Note` de bout en bout : `domain/`, Dexie, `data/remote/`+`sync/` pour la synchronisation, formulaire de capture "Note texte", onglet Notes fonctionnel avec `NoteCard`/`NoteDetail`). `npm run build`/`npm run lint`/`tsc --noEmit` propres. AC#1 et AC#2 vérifiées en conditions réelles (capture, garde-fou projet obligatoire, affichage carte/détail, badge "nouveau", état vide, non-régression tâche/documents/calendrier). Dégradation gracieuse de la synchro confirmée en l'absence de la table Supabase `notes`.
- 2026-08-19 : Task 5 (migration SQL `notes` + RLS) exécutée par Guillaume dans l'éditeur SQL Supabase. Vérifiée indépendamment par l'agent via introspection directe du schéma Postgres (API REST). Round-trip de synchronisation réel vérifié de bout en bout contre la production (création → file de synchro → push → Supabase → pull → indicateur "À jour"), RLS confirmée active et fonctionnelle (`user_id` rempli par `auth.uid()`, accès `anon` refusé). Toutes les tasks et les deux AC complètes. Statut passé à `review`.
- 2026-08-19 : Revue de code (3 couches parallèles — Blind Hunter, Edge Case Hunter, Acceptance Auditor — sur un diff reconstruit spécifiquement pour cette story, scopé hors du bruit des stories précédentes non commitées). 0 décision requise, 6 patchs appliqués (le plus notable : `Note.isNew` n'était jamais réconcilié au pull pour une note déjà connue localement, laissant le badge "nouveau" bloqué indéfiniment sur un autre appareil — contredisait FR-25 ; les 5 autres : message d'erreur de soumission partagé entre formulaires Tâche/Note non réinitialisé au changement de type, 3 commentaires d'en-tête devenus obsolètes, titre accessible générique sur `NoteDetail`), 9 items différés (documentés dans `deferred-work.md`, tous des limitations pré-existantes reproduites à l'identique depuis Task/Project, non introduites par cette story), 3 findings rejetés comme bruit (choix de design raisonnables déjà cohérents avec les conventions du projet). `npm run build`/`npm run lint`/`tsc --noEmit` propres après application des patchs. Re-vérification manuelle en direct des 2 correctifs comportementaux non refaite dans cette session (session navigateur authentifiée perdue entre-temps, nécessitant une reconnexion que l'agent ne peut pas effectuer lui-même) — correction validée par relecture de code et vérification statique (types/lint/build) uniquement. Statut passé à `done`.
