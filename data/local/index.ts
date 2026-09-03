// data/local/ — implémentation Dexie/IndexedDB, source de vérité immédiate pour toute écriture (AD-1).
// Dépend de domain/ (types) uniquement. Toute table de contenu métier est ajoutée par la story qui en a besoin,
// jamais toutes d'un coup (cf. ARCHITECTURE-SPINE.md — Deferred).

export { db, AppDatabase } from "./db";
export {
  createProject,
  listProjects,
  getProject,
  archiveProject,
  unarchiveProject,
} from "./projects";
export type { CreateProjectInput } from "./projects";
export {
  createTask,
  listTasksByProject,
  listAllTasks,
  markTaskOpened,
  updateTaskStatus,
  updateTaskPriority,
} from "./tasks";
export type { CreateTaskInput } from "./tasks";
export {
  createNote,
  createVoiceNote,
  listNotesByProject,
  markNoteOpened,
  markNoteAudioUploaded,
  updateNoteTranscription,
} from "./notes";
export type { CreateNoteInput, CreateVoiceNoteInput } from "./notes";
export { saveNoteAudio, getNoteAudio } from "./note-audio";
export type { NoteAudioRecord } from "./note-audio";
export {
  markTranscriptionPending,
  clearTranscriptionPending,
  isTranscriptionPending,
  listPendingTranscriptionNoteIds,
} from "./pending-transcription";
export type { PendingTranscriptionRecord } from "./pending-transcription";
export {
  createDocument,
  markDocumentUploaded,
  listDocumentsByProject,
  markDocumentOpened,
  deleteDocument,
} from "./documents";
export type { CreateDocumentInput } from "./documents";
export { saveDocumentFile, getDocumentFile } from "./document-file";
export type { DocumentFileRecord } from "./document-file";
export {
  enqueueField,
  enqueueCreate,
  enqueueDelete,
  listPendingAndError,
  markSyncing,
  markSucceeded,
  markFailed,
  resetErrorsToPending,
  resetStaleSyncingToPending,
} from "./sync-queue";
export type { EnqueueFieldInput } from "./sync-queue";
