"use client";

// app/projects/[id]/project-view.tsx — vue projet (FR-22 à FR-26). Vit sous app/ (pas
// components/) car il importe data/local/ directement (AD-2, même précédent que
// app/projects/projects-screen.tsx / app/capture-flow.tsx). TaskCard/TaskDetail/NoteCard/
// NoteDetail/DocumentCard/DocumentDetail/Tabs restent des sous-composants internes à ce
// fichier — duplication assumée, cf. Dev Notes des Stories 4.2/5.1/6.2. Document est
// désormais complet (ajout Story 6.1, liste/consultation Story 6.2, téléchargement/
// suppression Story 6.3, FR-20/FR-21) — Epic 6 clos.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { liveQuery } from "dexie";
import type {
  Document,
  Note,
  Priority,
  Project,
  Provenance,
  SortFilters,
  Task,
  TaskStatus,
} from "@/domain";
import { isTaskOverdue, sortDocuments, sortNotes, sortTasks } from "@/domain";
import {
  getProject,
  getNoteAudio,
  listDocumentsByProject,
  listNotesByProject,
  listTasksByProject,
  markDocumentOpened,
  markNoteOpened,
  markTaskOpened,
  updateTaskStatus,
  updateTaskPriority,
  updateNoteTranscription,
  isTranscriptionPending,
  markTranscriptionPending,
  clearTranscriptionPending,
  deleteDocument,
} from "@/data/local";
import { ConfirmDialog } from "@/components/confirm-dialog";
import styles from "./project-view.module.css";

// Labels de présentation locaux — même précédent que STATUS_LABELS/COLOR_LABELS de
// projects-screen.tsx, domain/ ne connaît que les clés.
const STATUS_LABELS: Record<Project["status"], string> = {
  active: "Actif",
  archived: "Archivé",
};

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

const PROVENANCE_LABELS: Record<Provenance, string> = {
  phone: "Téléphone",
  computer: "Ordinateur",
};

// FR-13 (Story 3.5) — 3 segments à choix exclusif, tap pour basculer directement dessus.
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "à faire" },
  { value: "in_progress", label: "en cours" },
  { value: "done", label: "terminé" },
];

// FR-14 (Story 3.5) — mêmes valeurs que PRIORITY_OPTIONS de app/capture-flow.tsx (étape 2/3).
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
];

const EMPTY_TASKS_MESSAGE =
  "Aucune tâche pour l'instant. Touchez + pour en créer une.";
const EMPTY_NOTES_MESSAGE =
  "Aucune note pour l'instant. Touchez + pour en créer une.";
const EMPTY_DOCUMENTS_MESSAGE =
  "Aucun document pour l'instant. Touchez + pour en créer un.";
const PROJECT_NOT_FOUND_MESSAGE = "Projet introuvable.";
const PROJECT_LOAD_ERROR_MESSAGE = "Impossible de charger le projet.";
const TASKS_LOAD_ERROR_MESSAGE = "Impossible de charger les tâches.";
const NOTES_LOAD_ERROR_MESSAGE = "Impossible de charger les notes.";
const DOCUMENTS_LOAD_ERROR_MESSAGE = "Impossible de charger les documents.";
const DOCUMENT_DELETE_ERROR_MESSAGE = "La suppression a échoué. Réessayez.";
const PREVIEW_LOAD_ERROR_MESSAGE = "Aperçu indisponible.";
const AUDIO_NOT_YET_AVAILABLE_MESSAGE = "Audio en cours de synchronisation.";
const AUDIO_ONLY_LABEL = "Audio seul — aucune transcription.";
const GENERATE_TRANSCRIPTION_LABEL = "Générer la transcription";
const TRANSCRIBING_LABEL = "Transcription en cours…";
const TRANSCRIPTION_FAILED_MESSAGE = "La transcription a échoué. Réessayez.";
const TRANSCRIPTION_EMPTY_LABEL = "Transcription vide — aucune parole détectée.";
const NO_TRANSCRIPTION_LABEL = "Audio seul (pas de transcription)";
const TRANSCRIBE_AUDIO_ENDPOINT = "/api/sync/transcribe-audio";

// POST le blob brut vers la route de transcription et retourne le texte — même fonction
// qu'app/capture-flow.tsx, dupliquée (cf. Dev Notes Story 5.3 : duplication assumée pour une
// poignée de lignes utilisées par exactement deux call sites).
async function requestTranscription(blob: Blob): Promise<string> {
  const response = await fetch(TRANSCRIBE_AUDIO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error("transcription request failed");
  }
  const result = (await response.json()) as { text: string };
  return result.text;
}
const AUDIO_LOAD_ERROR_MESSAGE = "Impossible de charger l'audio. Réessayez.";

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// Formatage taille de fichier — copie conforme de formatFileSize (app/capture-flow.tsx,
// Story 6.1) : Ko sous 1 Mo (lisible pour un fichier de quelques Ko), Mo à 1 décimale
// au-delà, virgule française (cohérent avec formatDueDate ci-dessus).
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1).replace(".", ",")} Mo`;
}

const NOTE_A11Y_TITLE_MAX_LENGTH = 60;

// Note n'a pas de titre séparé (domain/note.ts) — un extrait de son contenu tient lieu de
// nom accessible distinctif pour NoteDetail, plutôt que la chaîne statique "Note" répétée
// identiquement pour toutes les notes (trouvé en revue de code, Story 5.1).
function noteA11yTitle(content: string): string {
  return content.length > NOTE_A11Y_TITLE_MAX_LENGTH
    ? `${content.slice(0, NOTE_A11Y_TITLE_MAX_LENGTH).trimEnd()}…`
    : content;
}

// Réponds uniquement à "a-t-on de l'audio à proposer pour cette note" (local ou distant) —
// séparé de la sélection du `src` effectif (`localAudioUrl ?? /api/notes/[id]/audio`, qui reste
// inline au point d'usage) pour ne pas mélanger les deux questions dans une seule expression
// (revue de code : simplification).
function hasVoiceAudio(localAudioUrl: string | null, audioPath: string | null): boolean {
  return localAudioUrl !== null || audioPath !== null;
}

// Aperçu inline d'un document (DocumentDetail) — borné aux deux types attendus en usage
// courant (FR-18 : "photos et PDF") ; tout autre mimeType retombe sur "none" (aucun rendu
// inline, seules les métadonnées existantes restent affichées). Cf. Dev Notes
// data/remote/document-storage.ts createDocumentPreviewUrl pour le rationale sécurité de
// cette liste fermée.
type DocumentPreviewKind = "image" | "pdf" | "none";

function documentPreviewKind(mimeType: string): DocumentPreviewKind {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  return "none";
}

export function ProjectView({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoadError, setTasksLoadError] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoadError, setNotesLoadError] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoadError, setDocumentsLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [confirmDeleteDocument, setConfirmDeleteDocument] = useState<Document | null>(null);
  const [documentActionPendingId, setDocumentActionPendingId] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState<string | undefined>();
  const [sortFilters, setSortFilters] = useState<SortFilters>({
    chronological: true,
    priority: false,
  });

  // Tâche affichée dans le détail, dérivée de `tasks` plutôt que dupliquée dans un état
  // séparé (revue de code, Story 3.6) — reste automatiquement à jour lorsqu'un cycle de
  // synchro en arrière-plan modifie la tâche pendant que son détail est déjà ouvert,
  // nécessaire pour que la puce/le bandeau de conflit restent réactifs (AC#1/#2).
  const selectedTask = selectedTaskId
    ? (tasks.find((task) => task.id === selectedTaskId) ?? null)
    : null;
  const selectedNote = selectedNoteId
    ? (notes.find((note) => note.id === selectedNoteId) ?? null)
    : null;
  const selectedDocument = selectedDocumentId
    ? (documents.find((document) => document.id === selectedDocumentId) ?? null)
    : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setProjectNotFound(false);
      setProjectLoadError(false);
      // Réinitialisation explicite au changement de projet — sans elle, la tâche
      // sélectionnée et le tri actif d'un projet précédent survivraient à la navigation vers
      // un nouveau projet (cf. finding de revue Story 3.3 pour selectedTask, étendu à
      // sortFilters par la revue Story 3.4 ; inatteignable aujourd'hui faute de lien direct
      // projet-à-projet dans l'app, mais un coût nul à corriger dès maintenant).
      setSelectedTaskId(null);
      setSelectedNoteId(null);
      setSelectedDocumentId(null);
      setSortFilters({ chronological: true, priority: false });

      const projectResult = await getProject(projectId).catch(() => "error" as const);
      if (cancelled) return;

      if (projectResult === "error") {
        setProjectLoadError(true);
      } else if (!projectResult) {
        setProjectNotFound(true);
      } else {
        setProject(projectResult);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Abonnement live aux tâches du projet (revue de code, Story 3.6) — remplace un chargement
  // ponctuel : un cycle de synchro en arrière-plan (pull périodique/événement online) peut
  // désormais écrire un conflit directement en IndexedDB pendant que cette vue reste montée,
  // et la liste/le détail doivent le refléter sans remontage (AC#1 exige un état "visible",
  // pas "visible après rechargement"). Même précédent que app/sync-indicator.tsx (liveQuery).
  // Lancé indépendamment du chargement du projet ci-dessus, pas en série (même rationale
  // qu'avant cette story) — l'affichage reste conditionné à `loading`/`projectNotFound`/
  // `projectLoadError` au rendu.
  useEffect(() => {
    const subscription = liveQuery(() => listTasksByProject(projectId)).subscribe({
      // `setTasksLoadError(false)` ici (pas au corps de l'effet) : un `setState` synchrone
      // au corps d'un effet déclenche des rendus en cascade évitables (règle
      // react-hooks/set-state-in-effect) — la première émission de `next` (immédiate à
      // l'abonnement) suffit à effacer une erreur laissée par un projet précédent.
      next: (result) => {
        setTasksLoadError(false);
        setTasks(result);
      },
      error: () => setTasksLoadError(true),
    });

    return () => subscription.unsubscribe();
  }, [projectId]);

  // Même rationale que l'abonnement tasks ci-dessus (Story 3.6) — réactif à un pull en
  // arrière-plan qui insère une note créée sur un autre appareil pendant que cette vue
  // reste montée.
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

  // Même rationale que les abonnements tasks/notes ci-dessus (Story 3.6) — réactif à un pull
  // en arrière-plan qui insère un document créé sur un autre appareil pendant que cette vue
  // reste montée.
  useEffect(() => {
    const subscription = liveQuery(() => listDocumentsByProject(projectId)).subscribe({
      next: (result) => {
        setDocumentsLoadError(false);
        setDocuments(result);
      },
      error: () => setDocumentsLoadError(true),
    });

    return () => subscription.unsubscribe();
  }, [projectId]);

  async function handleOpenTask(task: Task) {
    // Affiche le détail immédiatement — le contenu vient déjà de l'objet en mémoire,
    // aucun rechargement nécessaire pour l'affichage (cf. Dev Notes de la story).
    setSelectedTaskId(task.id);

    if (!task.isNew) {
      return;
    }

    try {
      await markTaskOpened(task.id);
      // `tasks` (et `selectedTask`, dérivée) se mettent à jour seules via l'abonnement live
      // ci-dessus en cas de succès (revue de code, Story 3.6).
    } catch {
      // Échec silencieux assumé (cf. Dev Notes) — ne doit jamais bloquer/fermer la
      // consultation du détail déjà ouvert pour une simple mise à jour de lecture.
    }
  }

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

  async function handleOpenDocument(documentItem: Document) {
    setSelectedDocumentId(documentItem.id);

    if (!documentItem.isNew) {
      return;
    }

    try {
      await markDocumentOpened(documentItem.id);
    } catch {
      // Échec silencieux assumé, même rationale que handleOpenTask/handleOpenNote.
    }
  }

  function handleRequestDeleteDocument(documentItem: Document) {
    if (documentActionPendingId) {
      return;
    }
    setDocumentActionError(undefined);
    setConfirmDeleteDocument(documentItem);
  }

  function handleCancelDeleteDocument() {
    setConfirmDeleteDocument(null);
  }

  async function handleConfirmDeleteDocument() {
    const target = confirmDeleteDocument;
    if (!target || documentActionPendingId) {
      return;
    }

    setDocumentActionPendingId(target.id);
    try {
      await deleteDocument(target.id);
    } catch {
      // deleteDocument() est une écriture Dexie locale pure (AD-1) — un échec ici est rare
      // (ex. IndexedDB indisponible) mais doit rester visible, contrairement à
      // handleStatusChange/handlePriorityChange (écritures de champ non destructives où
      // l'UI retombe simplement sur l'état précédent) : une suppression manquée sans retour
      // laisserait Guillaume croire à tort que le document a disparu.
      setDocumentActionError(DOCUMENT_DELETE_ERROR_MESSAGE);
      setDocumentActionPendingId(null);
      setConfirmDeleteDocument(null);
      return;
    }

    setDocumentActionPendingId(null);
    setConfirmDeleteDocument(null);
    // `documents` se met à jour seule via l'abonnement liveQuery existant (deleteDocument()
    // écrit directement dans Dexie) — referme aussi le détail si le document supprimé y
    // était affiché (sinon DocumentDetail resterait ouvert sur un documentItem qui vient de
    // disparaître de `documents`, cf. selectedDocument dérivée).
    setSelectedDocumentId((current) => (current === target.id ? null : current));
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    try {
      await updateTaskStatus(task.id, status);
    } catch {
      // Échec silencieux assumé (cf. Dev Notes) — écriture Dexie locale, pas réseau
      // (AD-1) ; aucune mise à jour optimiste ici, l'UI retombe sur l'état précédent.
    }
  }

  async function handlePriorityChange(task: Task, priority: Priority) {
    try {
      await updateTaskPriority(task.id, priority);
    } catch {
      // Même rationale que handleStatusChange.
    }
  }

  async function handleTranscriptionChange(note: Note, transcription: string | null) {
    try {
      await updateNoteTranscription(note.id, transcription);
    } catch {
      // Échec silencieux assumé — écriture Dexie locale, pas réseau (AD-1), même rationale
      // que handleStatusChange/handlePriorityChange.
    }
  }

  if (projectNotFound) {
    return (
      <main className={styles.main}>
        <p className={styles.error} role="alert">
          {PROJECT_NOT_FOUND_MESSAGE}
        </p>
      </main>
    );
  }

  if (projectLoadError) {
    return (
      <main className={styles.main}>
        <p className={styles.error} role="alert">
          {PROJECT_LOAD_ERROR_MESSAGE}
        </p>
      </main>
    );
  }

  if (loading || !project) {
    return <main className={styles.main} />;
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <span
          className={styles.projectSwatch}
          style={{ backgroundColor: `var(--color-${project.color})` }}
          aria-hidden="true"
        />
        <h1 className={styles.title}>{project.name}</h1>
        {project.status === "archived" && (
          <span className={styles.statusPill}>
            {STATUS_LABELS[project.status]}
          </span>
        )}
      </div>

      {/* Fiche projet unifiée (retour Guillaume, remplace les 3 gros onglets Tâches/
          Documents/Notes — "ça fait des boutons qui font limite un tiers de la page") : les
          3 sections restent toutes visibles en permanence, chacune scrollable en interne
          (cf. .sectionScroll ci-dessous) plutôt que de masquer les 2/3 du contenu derrière un
          clic d'onglet. */}
      <div className={styles.contentGrid}>
        <section
          className={`${styles.moduleSection} ${styles.tasksSection}`}
          aria-labelledby="section-tasks-title"
        >
          <h2 id="section-tasks-title" className={styles.sectionTitle}>
            Tâches
          </h2>
          <div className={styles.sectionScroll}>
            {tasksLoadError ? (
              <p className={styles.error} role="alert">
                {TASKS_LOAD_ERROR_MESSAGE}
              </p>
            ) : (
              <>
                <SortFilterControls
                  filters={sortFilters}
                  onChange={setSortFilters}
                />
                {tasks.length === 0 ? (
                  <p className={styles.empty}>{EMPTY_TASKS_MESSAGE}</p>
                ) : (
                  <ul className={styles.taskList}>
                    {sortTasks(tasks, sortFilters).map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onOpen={handleOpenTask}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>

        <section
          className={`${styles.moduleSection} ${styles.notesSection}`}
          aria-labelledby="section-notes-title"
        >
          <h2 id="section-notes-title" className={styles.sectionTitle}>
            Notes
          </h2>
          <div className={styles.sectionScroll}>
            {notesLoadError ? (
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
            )}
          </div>
        </section>

        <section
          className={`${styles.moduleSection} ${styles.documentsSection}`}
          aria-labelledby="section-documents-title"
        >
          <h2 id="section-documents-title" className={styles.sectionTitle}>
            Documents
          </h2>
          <div className={styles.sectionScroll}>
            {documentsLoadError ? (
              <p className={styles.error} role="alert">
                {DOCUMENTS_LOAD_ERROR_MESSAGE}
              </p>
            ) : (
              <>
                {documentActionError && (
                  <p className={styles.error} role="alert">
                    {documentActionError}
                  </p>
                )}
                {documents.length === 0 ? (
                  <p className={styles.empty}>{EMPTY_DOCUMENTS_MESSAGE}</p>
                ) : (
                  <ul className={styles.taskList}>
                    {sortDocuments(documents).map((documentItem) => (
                      <DocumentCard
                        key={documentItem.id}
                        documentItem={documentItem}
                        onOpen={handleOpenDocument}
                        onDelete={handleRequestDeleteDocument}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <TaskDetail
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />

      <NoteDetail
        note={selectedNote}
        onClose={() => setSelectedNoteId(null)}
        onTranscriptionChange={handleTranscriptionChange}
      />

      <DocumentDetail
        documentItem={selectedDocument}
        onClose={() => setSelectedDocumentId(null)}
        onDelete={handleRequestDeleteDocument}
      />

      <ConfirmDialog
        open={confirmDeleteDocument !== null}
        title="Supprimer ce document ?"
        description={`${confirmDeleteDocument?.fileName || "Document"} sera définitivement supprimé et ne pourra pas être récupéré.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="destructive"
        onConfirm={handleConfirmDeleteDocument}
        onCancel={handleCancelDeleteDocument}
        pending={
          confirmDeleteDocument !== null && documentActionPendingId === confirmDeleteDocument.id
        }
      />
    </main>
  );
}

function SortFilterControls({
  filters,
  onChange,
}: {
  filters: SortFilters;
  onChange: (filters: SortFilters) => void;
}) {
  return (
    <div className={styles.filters} role="group" aria-label="Trier les tâches">
      <label className={styles.filter}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={filters.chronological}
          onChange={(event) =>
            onChange({ ...filters, chronological: event.target.checked })
          }
        />
        <span className={styles.checkboxBox} aria-hidden="true" />
        Chronologique
      </label>
      <label className={styles.filter}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={filters.priority}
          onChange={(event) =>
            onChange({ ...filters, priority: event.target.checked })
          }
        />
        <span className={styles.checkboxBox} aria-hidden="true" />
        Prioritaire
      </label>
    </div>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={styles.priorityChip}
      data-priority={priority}
      role="img"
      aria-label={`Priorité ${PRIORITY_LABELS[priority]}`}
    >
      {PRIORITY_LETTERS[priority]}
    </span>
  );
}

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
        {/* Élément toujours monté (contrairement au point visuel ci-dessus) : faire
            varier son texte, plutôt que le monter/démonter, est ce qui permet une
            annonce fiable lecteur d'écran de la disparition du badge (cf. Dev Notes). */}
        <span
          className={styles.visuallyHidden}
          role="status"
          aria-live="polite"
        >
          {task.isNew ? "Nouveau" : ""}
        </span>
        {/* Même précédent que le badge "nouveau" ci-dessus (revue de code) : un conflit
            détecté pendant un cycle de synchro en arrière-plan doit être annoncé, pas
            seulement visible pour qui regarde déjà l'écran. */}
        <span
          className={styles.visuallyHidden}
          role="status"
          aria-live="polite"
        >
          {task.statusConflict || task.priorityConflict
            ? "Conflit de synchronisation détecté"
            : ""}
        </span>

        <div className={styles.taskCardRow}>
          <PriorityChip priority={task.priority} />
          <span className={styles.taskTitle} data-done={task.status === "done"}>
            {task.title}
          </span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>
            {PROVENANCE_LABELS[task.provenance]}
          </span>
          {task.dueDate && (
            <span className={styles.metaPill} data-overdue={overdue}>
              {formatDueDate(task.dueDate)}
              {overdue ? " · en retard" : ""}
            </span>
          )}
          {(task.statusConflict || task.priorityConflict) && (
            <span className={styles.metaPill} data-conflict="true">
              Conflit de synchronisation — à vérifier
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

// Carte de note (AC#2, Story 5.1) — même composant visuel que la carte de tâche (DESIGN.md
// components.task-card, "Carte de tâche/note/document" — un seul design pour les trois
// types). Pas de titre séparé (Note n'en a pas, cf. domain/note.ts) : le contenu tronqué
// sur 2 lignes (CSS, .noteContent) tient lieu de "titre" visuel de la carte. Pas de
// StatusRow (Note n'a pas de statut).
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
        <span className={styles.visuallyHidden} role="status" aria-live="polite">
          {note.transcriptionConflict ? "Conflit de synchronisation détecté" : ""}
        </span>

        <div className={styles.taskCardRow}>
          <PriorityChip priority={note.priority} />
          {note.type === "voice" ? (
            /* `||` (pas `??`) : une transcription vide ("") doit aussi retomber sur
               "Note vocale" sur la carte — un titre de carte vide serait déroutant, le détail
               reste l'endroit approprié pour signaler explicitement "transcription vide". */
            <span className={styles.noteContent}>{note.transcription || "Note vocale"}</span>
          ) : (
            <span className={styles.noteContent}>{note.content}</span>
          )}
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>
            {PROVENANCE_LABELS[note.provenance]}
          </span>
          {note.transcriptionConflict && (
            <span className={styles.metaPill} data-conflict="true">
              Conflit de synchronisation — à vérifier
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

// Carte de document (AC#1, Story 6.2) — même composant visuel que TaskCard/NoteCard
// (DESIGN.md components.task-card, "Carte de tâche/note/document" — un seul design pour les
// trois types). Nom de fichier en position "titre" (comme .taskTitle), méta-puces type +
// taille + date + provenance (EXPERIENCE.md Component Patterns : "Pour un document : nom de
// fichier, type, taille, date d'ajout."). Pas de StatusRow (Document n'a pas de statut).
function DocumentCard({
  documentItem,
  onOpen,
  onDelete,
}: {
  documentItem: Document;
  onOpen: (documentItem: Document) => void;
  onDelete: (documentItem: Document) => void;
}) {
  return (
    <li className={styles.taskCard}>
      <button
        type="button"
        className={styles.taskCardButton}
        onClick={() => onOpen(documentItem)}
      >
        {documentItem.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
        <span className={styles.visuallyHidden} role="status" aria-live="polite">
          {documentItem.isNew ? "Nouveau" : ""}
        </span>

        <div className={styles.taskCardRow}>
          <PriorityChip priority={documentItem.priority} />
          <span className={styles.documentFileName}>{documentItem.fileName || "Document"}</span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>{documentItem.mimeType}</span>
          <span className={styles.metaPill}>{formatFileSize(documentItem.sizeBytes)}</span>
          <span className={styles.metaPill}>{formatDueDate(documentItem.createdAt)}</span>
          <span className={styles.metaPill}>
            {PROVENANCE_LABELS[documentItem.provenance]}
          </span>
        </div>
      </button>

      <div className={styles.documentActions}>
        {documentItem.storagePath ? (
          <a
            className={styles.ghostButton}
            href={`/api/documents/${documentItem.id}/download`}
            aria-label={`Télécharger ${documentItem.fileName || "le document"}`}
          >
            Télécharger
          </a>
        ) : (
          <button
            type="button"
            className={styles.ghostButton}
            disabled
            aria-label={`Télécharger ${documentItem.fileName || "le document"} (indisponible, synchronisation en cours)`}
          >
            Télécharger
          </button>
        )}
        <button
          type="button"
          className={styles.destructiveGhostButton}
          onClick={() => onDelete(documentItem)}
          aria-label={`Supprimer ${documentItem.fileName || "le document"}`}
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}

// Contrôle de statut de la carte (FR-13, Story 3.5) — 3 vrais boutons indépendants, pas un
// bouton unique en cycle (EXPERIENCE.md : "tap sur un segment pour basculer directement
// dessus, pas de cycle forcé"). Frère du bouton d'ouverture, jamais imbriqué dedans (cf. Dev
// Notes de la story — bouton dans un bouton = HTML invalide).
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

function TaskDetail({
  task,
  onClose,
  onStatusChange,
  onPriorityChange,
}: {
  task: Task | null;
  onClose: () => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onPriorityChange: (task: Task, priority: Priority) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!task) {
      return;
    }

    // Focus initial sur "Fermer", restauré au déclencheur à la fermeture — même
    // pattern que components/confirm-dialog.tsx.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    return () => {
      previouslyFocused?.focus();
    };
    // Dépendance sur task?.id, pas sur task (référence) : handlePriorityChange (Story 3.5)
    // remplace selectedTask par un nouvel objet à chaque changement de priorité pendant que
    // le détail reste ouvert — dépendre de la référence rejouerait ce piège à focus (et donc
    // le sortirait brièvement du dialogue) à chaque sélection, alors que la tâche affichée
    // n'a pas changé (cf. Review Findings de cette story).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) {
    return null;
  }

  // Piège à focus minimal : "Fermer" est le seul élément focalisable de cette modale
  // (contrairement à ConfirmDialog, qui en a deux et boucle entre eux) — sans ce
  // gestionnaire, Tab/Maj+Tab fait sortir le focus clavier vers le contenu de la page
  // derrière, qui reste pleinement interactif malgré aria-modal="true" (cf. finding de
  // revue Story 3.3).
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
        aria-labelledby="task-detail-title"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.detailHeader}>
          <h2 id="task-detail-title" className={styles.title}>
            {task.title}
          </h2>
        </div>

        {task.statusConflict && (
          <ConflictBanner
            label="Statut"
            // Repli sur la valeur brute plutôt qu'une assertion non-null sans garde (revue de
            // code) : une valeur distante inattendue ne doit jamais faire planter le rendu du
            // détail (aucune autre voie ne permet de fermer la fiche dans ce cas).
            localLabel={STATUS_OPTIONS.find((o) => o.value === task.statusConflict!.local)?.label ?? task.statusConflict!.local}
            remoteLabel={STATUS_OPTIONS.find((o) => o.value === task.statusConflict!.remote)?.label ?? task.statusConflict!.remote}
            onChoose={(choice) =>
              onStatusChange(task, choice === "local" ? task.statusConflict!.local : task.statusConflict!.remote)
            }
          />
        )}
        {task.priorityConflict && (
          <ConflictBanner
            label="Priorité"
            localLabel={PRIORITY_LABELS[task.priorityConflict.local] ?? task.priorityConflict.local}
            remoteLabel={PRIORITY_LABELS[task.priorityConflict.remote] ?? task.priorityConflict.remote}
            onChoose={(choice) =>
              onPriorityChange(task, choice === "local" ? task.priorityConflict!.local : task.priorityConflict!.remote)
            }
          />
        )}

        <PrioritySelector
          priority={task.priority}
          onChange={(priority) => onPriorityChange(task, priority)}
        />

        {task.description && (
          <p className={styles.detailDescription}>{task.description}</p>
        )}

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>
            {PROVENANCE_LABELS[task.provenance]}
          </span>
          {task.dueDate && (
            <span className={styles.metaPill}>
              {formatDueDate(task.dueDate)}
            </span>
          )}
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

// Sélecteur de priorité interactif du détail (FR-14, Story 3.5) — même précédent visuel et
// sémantique que OptionButton (app/capture-flow.tsx, étape 2/3 de la capture) : boutons
// indépendants aria-pressed, pas de rôle radio/radiogroup. Distinct de PriorityChip, qui
// reste la puce compacte en lecture seule utilisée sur la carte (cf. Dev Notes de la story).
function PrioritySelector({
  priority,
  onChange,
}: {
  priority: Priority;
  onChange: (priority: Priority) => void;
}) {
  return (
    <div
      className={styles.prioritySelector}
      role="group"
      aria-label="Priorité de la tâche"
    >
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

// Bandeau de résolution de conflit (AC #2, Story 3.6) — même précédent de sous-composant
// interne non extrait sous components/ que StatusRow/PrioritySelector (spécifique à Task).
// Pas de bouton "annuler" : il n'y a rien à annuler, le conflit reste affiché tant qu'aucun
// choix n'est fait (AD-3, "jamais d'écrasement automatique"). Un tap sur l'un des deux
// boutons appelle onStatusChange/onPriorityChange (réutilisés tels quels, cf. Dev Notes de
// la story) avec la valeur choisie — efface déjà le conflit et repousse la valeur.
function ConflictBanner({
  label,
  localLabel,
  remoteLabel,
  onChoose,
}: {
  label: string;
  localLabel: string;
  remoteLabel: string;
  onChoose: (choice: "local" | "remote") => void;
}) {
  return (
    <div className={styles.conflictBanner} role="group" aria-label={`Conflit de synchronisation — ${label}`}>
      <p className={styles.conflictBannerLabel}>
        Conflit de synchronisation — {label} — à vérifier
      </p>
      <button type="button" className={styles.conflictOption} onClick={() => onChoose("local")}>
        Sur cet appareil : {localLabel}
      </button>
      <button type="button" className={styles.conflictOption} onClick={() => onChoose("remote")}>
        Synchronisé depuis l&apos;autre appareil : {remoteLabel}
      </button>
    </div>
  );
}

// Détail d'une note (AC#2, Story 5.1) — même piège à focus minimal que TaskDetail, sans
// PrioritySelector/ConflictBanner/segments de statut (aucune édition exposée sur une note
// dans cette story, cf. Dev Notes).
function NoteDetail({
  note,
  onClose,
  onTranscriptionChange,
}: {
  note: Note | null;
  onClose: () => void;
  onTranscriptionChange: (note: Note, transcription: string | null) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  // Blob brut conservé à côté de l'URL objet dérivée (localAudioUrl) — réutilisé par
  // handleGenerateTranscription pour éviter une seconde lecture IndexedDB du même blob,
  // potentiellement volumineux (jusqu'à 20 Mo, NFR-10) (revue de code : re-lecture inutile).
  const [localAudioBlob, setLocalAudioBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | undefined>();
  // Mis à jour de façon synchrone à chaque rendu (pas dans un effet) — permet à
  // handleGenerateTranscription de savoir, quand sa continuation asynchrone reprend la main,
  // si l'utilisateur regarde encore la MÊME note qu'au moment du clic. Sans ce garde, un
  // callback résolu après un changement de note applique son résultat/erreur à la note
  // affichée à ce moment-là plutôt qu'à celle pour laquelle il a été déclenché (revue de code :
  // état de transcription qui fuit d'une note à l'autre) — NoteDetail n'est jamais démonté
  // entre deux notes (pas de `key`), donc son état local persiste au changement de `note`.
  const currentNoteIdRef = useRef<string | null>(null);
  // Effet sans dépendances (pas une écriture directe pendant le rendu, interdite par
  // react-hooks/refs) : s'exécute après CHAQUE commit, gardant le ref aligné sur le rendu le
  // plus récent avant qu'aucune interaction utilisateur ne puisse survenir.
  useEffect(() => {
    currentNoteIdRef.current = note?.id ?? null;
  });
  // Distinct de AUDIO_NOT_YET_AVAILABLE_MESSAGE (audioPath encore null, upload en cours) —
  // ici l'upload a réussi (audioPath non null) mais la lecture via l'URL signée serveur a
  // concrètement échoué (chemin Storage disparu, session expirée, réseau) : sans ce retour,
  // le lecteur <audio> restait silencieusement cassé sans aucune explication (trouvé en revue
  // de code, Story 5.2).
  const [audioLoadError, setAudioLoadError] = useState(false);

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

  useEffect(() => {
    // Reset dans le nettoyage plutôt que dans le corps de l'effet (react-hooks/set-state-in-effect,
    // même précédent que l'effet recordedAudioUrl de app/capture-flow.tsx) : se déclenche à la
    // transition vers une autre note (ou au démontage), avant que le prochain rendu n'affiche
    // quoi que ce soit pour cette nouvelle note.
    return () => {
      setAudioLoadError(false);
    };
  }, [note?.id]);

  // Réinitialise l'état de la requête de transcription à chaque changement de note affichée
  // (effet indépendant, même précédent que le reset d'audioLoadError ci-dessus : setState
  // dans le nettoyage, pas dans le corps de l'effet, cf. react-hooks/set-state-in-effect) —
  // sans lui, une erreur ou un état "en cours" laissé par une note précédente survivrait à
  // la navigation vers une autre note.
  useEffect(() => {
    return () => {
      setTranscribeError(undefined);
      setTranscribing(false);
    };
  }, [note?.id]);

  // Lecture locale prioritaire (Story 5.2) : le blob a été enregistré sur cet appareil, la
  // lecture fonctionne hors ligne sans dépendre de l'upload. Un appareil qui n'a jamais eu le
  // blob localement (note créée ailleurs) retombe sur app/api/notes/[id]/audio (cf. Dev Notes).
  useEffect(() => {
    if (!note || note.type !== "voice") {
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    getNoteAudio(note.id).then((blob) => {
      if (cancelled || !blob) {
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setLocalAudioUrl(objectUrl);
      setLocalAudioBlob(blob);
    });
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setLocalAudioUrl(null);
      setLocalAudioBlob(null);
    };
    // Dépendance sur note?.id/note?.type, pas sur note (référence) : même précédent que
    // l'effet de focus de TaskDetail ci-dessus — `selectedNote` (app/projects/[id]/
    // project-view.tsx) est dérivée de `notes` et devient une nouvelle référence à chaque
    // cycle de synchro en arrière-plan (ex. markNoteAudioUploaded qui renseigne audioPath),
    // sans que l'identité de la note affichée ait changé ; dépendre de la référence
    // relancerait inutilement cet effet (et redemanderait le blob local) à chaque pull.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, note?.type]);

  if (!note) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  // Fonction expression (pas une déclaration) : nécessaire pour que TypeScript propage le
  // rétrécissement de type de `note` (non-null, garanti par le `if (!note) return null;`
  // ci-dessus) à l'intérieur de cette fonction — une déclaration hoistée perd ce
  // rétrécissement (limitation connue de TypeScript sur les function declarations capturant
  // un paramètre narrowé).
  const handleGenerateTranscription = async () => {
    if (transcribing) {
      return;
    }
    const noteId = note.id;

    // Une transcription est peut-être déjà en cours pour CETTE note ailleurs (déclenchée à la
    // création, cf. app/capture-flow.tsx) — le marqueur durable est la seule source de vérité
    // partagée entre les deux points de déclenchement (revue de code : évite deux requêtes
    // OpenAI concurrentes et payées deux fois pour le même audio). N'en démarre pas une
    // seconde ; affiche quand même "en cours" — le rendu bascule sur le texte transcrit dès
    // que l'écriture Dexie de l'appel déjà en vol aboutit (note.transcription !== null).
    if (await isTranscriptionPending(noteId)) {
      setTranscribing(true);
      return;
    }

    setTranscribeError(undefined);
    setTranscribing(true);
    await markTranscriptionPending(noteId);
    try {
      // Blob local en priorité, déjà résolu par l'effet ci-dessus dans l'immense majorité des
      // cas (le bouton n'est rendu que lorsque localAudioUrl ou note.audioPath est déjà vrai) —
      // réutilisé tel quel plutôt que relu depuis IndexedDB (revue de code : re-lecture
      // inutile d'un blob potentiellement volumineux, jusqu'à 20 Mo, NFR-10). Sur un autre
      // appareil (aucun blob local), retombe sur la même route déjà utilisée pour la lecture
      // (app/api/notes/[id]/audio) : elle suit déjà la redirection signée vers Supabase
      // Storage et retourne les octets audio.
      let blob = localAudioBlob ?? (await getNoteAudio(noteId));
      if (!blob) {
        const response = await fetch(`/api/notes/${noteId}/audio`);
        if (!response.ok) {
          throw new Error("audio fetch failed");
        }
        blob = await response.blob();
      }
      const text = await requestTranscription(blob);
      onTranscriptionChange(note, text);
      await clearTranscriptionPending(noteId);
    } catch {
      // Marqueur laissé en place — retenté par sync/client.ts au prochain cycle. L'état
      // d'erreur local, lui, ne s'applique qu'à la note encore affichée au moment où cette
      // continuation reprend la main (revue de code : sinon l'erreur d'une requête pour la
      // note A peut s'afficher sous la note B si l'utilisateur a changé de note entre-temps —
      // NoteDetail n'est jamais démonté entre deux notes).
      if (currentNoteIdRef.current === noteId) {
        setTranscribeError(TRANSCRIPTION_FAILED_MESSAGE);
      }
    } finally {
      if (currentNoteIdRef.current === noteId) {
        setTranscribing(false);
      }
    }
  };

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
            <span className={styles.visuallyHidden}>
              {" "}
              {note.type === "voice" ? "vocale" : noteA11yTitle(note.content)}
            </span>
          </h2>
          <PriorityChip priority={note.priority} />
        </div>

        {note.transcriptionConflict && (
          <ConflictBanner
            label="Transcription"
            // `!== null` + `||` (pas `??`) : chaque côté du conflit distingue "jamais
            // transcrite" (null) de "transcrite mais vide" ("", même sémantique que
            // l'affichage non-conflictuel ci-dessous) — `??` seul laissait passer une chaîne
            // vide telle quelle, affichant un bouton de choix sans aucun texte après les deux
            // points (revue de code).
            localLabel={
              note.transcriptionConflict.local !== null
                ? note.transcriptionConflict.local || TRANSCRIPTION_EMPTY_LABEL
                : NO_TRANSCRIPTION_LABEL
            }
            remoteLabel={
              note.transcriptionConflict.remote !== null
                ? note.transcriptionConflict.remote || TRANSCRIPTION_EMPTY_LABEL
                : NO_TRANSCRIPTION_LABEL
            }
            onChoose={(choice) =>
              onTranscriptionChange(
                note,
                choice === "local"
                  ? note.transcriptionConflict!.local
                  : note.transcriptionConflict!.remote,
              )
            }
          />
        )}

        {note.type === "voice" ? (
          hasVoiceAudio(localAudioUrl, note.audioPath) ? (
            <>
              {/* L'échec de chargement de l'audio (audioLoadError, Story 5.2) ne masque plus
                  que le lecteur lui-même — la transcription (bloc indépendant ci-dessous) reste
                  visible même si l'audio ne joue plus, conforme à AC#2 "reste pleinement valide
                  et consultable" (revue de code : l'audio et la transcription n'ont aucun lien
                  de dépendance fonctionnelle entre eux). */}
              {audioLoadError ? (
                <p className={styles.error} role="alert">
                  {AUDIO_LOAD_ERROR_MESSAGE}
                </p>
              ) : (
                <audio
                  className={styles.audioPreview}
                  controls
                  src={localAudioUrl ?? `/api/notes/${note.id}/audio`}
                  onError={() => setAudioLoadError(true)}
                />
              )}
              {note.transcription !== null ? (
                // `!== null` (pas une vérification de véracité) : une transcription réussie
                // mais vide ("", audio trop court/silencieux pour que le modèle y détecte de
                // la parole) doit rester affichée comme "transcrite", jamais retomber
                // silencieusement sur l'état "audio seul" (trouvé en vérification manuelle —
                // `note.transcription ? ... : ...` traitait "" comme faux au même titre que
                // `null`, ce qui redonnait le bouton "Générer la transcription" après un appel
                // pourtant réussi).
                <p className={styles.detailDescription} data-transcribed="true">
                  {note.transcription || TRANSCRIPTION_EMPTY_LABEL}
                </p>
              ) : (
                <>
                  {/* État "audio seul" visuellement distinct de "transcrit" (AC#2,
                      EXPERIENCE.md State Patterns) — présence/absence du bloc texte + bouton
                      ci-dessous, pas une couleur ou un badge supplémentaire (cohérent avec le
                      principe déjà appliqué à la puce de conflit, Story 3.6). */}
                  <p className={styles.empty}>{AUDIO_ONLY_LABEL}</p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={handleGenerateTranscription}
                      disabled={transcribing}
                    >
                      {transcribing ? TRANSCRIBING_LABEL : GENERATE_TRANSCRIPTION_LABEL}
                    </button>
                  </div>
                  {transcribeError && (
                    <p className={styles.error} role="alert">
                      {transcribeError}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <p className={styles.detailDescription}>{AUDIO_NOT_YET_AVAILABLE_MESSAGE}</p>
          )
        ) : (
          <p className={styles.detailDescription}>{note.content}</p>
        )}

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

// Détail d'un document (AC#1, Story 6.2 ; Télécharger/Supprimer, Story 6.3). Paramètre
// `documentItem` (pas `document`) : évite de masquer l'objet global `window.document` utilisé
// par `document.activeElement` ci-dessous.
function DocumentDetail({
  documentItem,
  onClose,
  onDelete,
}: {
  documentItem: Document | null;
  onClose: () => void;
  onDelete: (documentItem: Document) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  // Distingue un aperçu réellement cassé (mimeType déclaré "image/*" mais contenu non
  // décodable, ou URL d'aperçu expirée/erreur réseau) d'une simple absence d'aperçu (PDF,
  // autre type) — même rationale qu'audioLoadError (NoteDetail) : sans cet état, une image
  // cassée resterait une icône brisée silencieuse plutôt qu'un message explicite.
  const [previewLoadError, setPreviewLoadError] = useState(false);

  useEffect(() => {
    if (!documentItem) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentItem?.id]);

  useEffect(() => {
    // Reset dans le nettoyage plutôt que le corps de l'effet (react-hooks/set-state-in-effect,
    // même précédent que NoteDetail ci-dessus) — se déclenche à la transition vers un autre
    // document, avant que le prochain rendu n'affiche quoi que ce soit pour ce nouveau document.
    return () => {
      setPreviewLoadError(false);
    };
  }, [documentItem?.id]);

  if (!documentItem) {
    return null;
  }

  // Piège à focus à N éléments (Fermer, Télécharger, Supprimer) — généralise le piège à 1
  // élément de la Story 6.2 (qui reforçait le focus sur "Fermer" à chaque Tab, seul élément
  // focalisable à l'époque) via une liste construite dynamiquement plutôt que des cas figés,
  // même précédent de cycle Tab/Maj+Tab que components/confirm-dialog.tsx (2 éléments).
  // `downloadLinkRef` n'est jamais attaché quand le téléchargement n'est pas encore
  // disponible (bouton natif `disabled` ci-dessous, pas de ref) — `.current` reste alors
  // `null` et sort naturellement de `focusable` sans logique conditionnelle supplémentaire.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = [
      closeButtonRef.current,
      downloadLinkRef.current,
      deleteButtonRef.current,
    ].filter((el): el is HTMLButtonElement | HTMLAnchorElement => el !== null);
    if (focusable.length === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLButtonElement | HTMLAnchorElement,
    );
    if (event.shiftKey) {
      const previousIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      focusable[previousIndex].focus();
    } else {
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
      focusable[nextIndex].focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-detail-title"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.detailHeader}>
          <h2 id="document-detail-title" className={styles.title}>
            {documentItem.fileName || "Document"}
          </h2>
          <PriorityChip priority={documentItem.priority} />
        </div>

        {documentItem.storagePath &&
          (() => {
            const kind = documentPreviewKind(documentItem.mimeType);
            if (kind === "image") {
              return previewLoadError ? (
                <p className={styles.empty}>{PREVIEW_LOAD_ERROR_MESSAGE}</p>
              ) : (
                <img
                  className={styles.documentPreviewImage}
                  src={`/api/documents/${documentItem.id}/preview`}
                  alt={documentItem.fileName || "Aperçu du document"}
                  onError={() => setPreviewLoadError(true)}
                />
              );
            }
            if (kind === "pdf") {
              return (
                <iframe
                  className={styles.documentPreviewFrame}
                  src={`/api/documents/${documentItem.id}/preview`}
                  title={documentItem.fileName || "Document"}
                />
              );
            }
            return null;
          })()}

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>{documentItem.mimeType}</span>
          <span className={styles.metaPill}>{formatFileSize(documentItem.sizeBytes)}</span>
          <span className={styles.metaPill}>{formatDueDate(documentItem.createdAt)}</span>
          <span className={styles.metaPill}>
            {PROVENANCE_LABELS[documentItem.provenance]}
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
          {documentItem.storagePath ? (
            <a
              ref={downloadLinkRef}
              className={styles.ghostButton}
              href={`/api/documents/${documentItem.id}/download`}
              aria-label={`Télécharger ${documentItem.fileName || "le document"}`}
            >
              Télécharger
            </a>
          ) : (
            <button
              type="button"
              className={styles.ghostButton}
              disabled
              aria-label={`Télécharger ${documentItem.fileName || "le document"} (indisponible, synchronisation en cours)`}
            >
              Télécharger
            </button>
          )}
          <button
            ref={deleteButtonRef}
            type="button"
            className={styles.destructiveGhostButton}
            onClick={() => onDelete(documentItem)}
            aria-label={`Supprimer ${documentItem.fileName || "le document"}`}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
