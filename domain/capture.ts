// domain/capture.ts — règles pures du flux de capture "+" (FR-1 à FR-5).
// Ne dépend d'aucun autre module du projet (cf. AD-2).

export type CaptureType = "note-text" | "voice-note" | "task" | "document";

// Partagé Task/Note/Document (FR-3) — défini ici car c'est la capture qui le fait
// choisir en premier, avant même le type de contenu.
export type Priority = "low" | "normal" | "high";

// FR-2 : Note et Document exigent un projet ; Tâche peut s'en passer (tâche générale).
export function captureTypeRequiresProject(type: CaptureType): boolean {
  return type !== "task";
}
