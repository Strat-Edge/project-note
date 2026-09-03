// domain/ — règles métier pures (entités, validations, cas d'usage).
// Ne dépend d'aucun autre module du projet (ni data/*, ni sync/, ni app/, ni components/).
// Expose des types et interfaces ; les implémentations concrètes (data/local/, data/remote/, sync/) en dépendent, jamais l'inverse.
// Cf. ARCHITECTURE-SPINE.md — Design Paradigm, AD-2.

export {
  PROJECT_COLOR_ROTATION,
  nextProjectColor,
  validateProjectName,
  groupProjectsByStatus,
  archiveProject,
  unarchiveProject,
} from "./project";
export type {
  Project,
  ProjectColorKey,
  ProjectStatus,
  ProjectsByStatus,
} from "./project";
export { captureTypeRequiresProject } from "./capture";
export type { CaptureType, Priority } from "./capture";
export {
  validateTaskTitle,
  canSetReminder,
  openTask,
  setTaskStatus,
  setTaskPriority,
  isTaskOverdue,
  sortTasksChronologically,
  sortTasks,
} from "./task";
export type { Task, TaskStatus, Provenance, SortFilters } from "./task";
export {
  validateNoteContent,
  openNote,
  sortNotes,
  validateAudioSize,
  MAX_AUDIO_SIZE_BYTES,
  setNoteTranscription,
} from "./note";
export type { Note, NoteType } from "./note";
export {
  validateDocumentSize,
  MAX_DOCUMENT_SIZE_BYTES,
  openDocument,
  sortDocuments,
} from "./document";
export type { Document } from "./document";
export {
  dateKey,
  isSameDay,
  tasksWithDueDate,
  groupTasksByDueDate,
  getWeekDays,
  getMonthGridDays,
  filterTasksForCalendar,
} from "./calendar";
export type { CalendarFilters, CalendarViewMode } from "./calendar";
export {
  syncQueueEntryId,
  DELETE_FIELD,
  MAX_SYNC_ATTEMPTS,
  hasExhaustedRetries,
  resolveFieldSync,
} from "./sync";
export type {
  SyncEntity,
  SyncOperation,
  SyncStatus,
  SyncQueueEntry,
  FieldConflict,
  FieldSyncDecision,
} from "./sync";
