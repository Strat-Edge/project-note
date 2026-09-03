// domain/note.ts — entité Note et validations pures associées. FR-15 (texte, Story 5.1),
// FR-16 (vocal, Story 5.2) et FR-17 (transcription à la demande, Story 5.3) partagent la
// même entité Note, distinguées par `type`. Ne dépend d'aucun module HORS domain/ (cf. AD-2) —
// importe Priority (./capture), Provenance (./task) et FieldConflict (./sync).
import type { Priority } from "./capture";
import type { Provenance } from "./task";
import type { FieldConflict } from "./sync";

export type NoteType = "text" | "voice";

export interface Note {
  id: string;
  projectId: string; // jamais null : FR-2 exige un projet pour une Note (contrairement à
    // Task.projectId, qui peut être null pour une tâche générale)
  type: NoteType; // "text" (Story 5.1) | "voice" (Story 5.2, FR-16)
  content: string; // texte libre pour type "text" (FR-15) ; toujours "" pour type "voice" —
    // la transcription (FR-17, Story 5.3) vit dans son propre champ `transcription`
    // ci-dessous, jamais dans `content` (cf. Dev Notes Story 5.3).
  audioPath: string | null; // chemin dans le bucket Supabase Storage "audio" (AD-5, AD-8) ;
    // null tant que sync/ n'a pas terminé l'upload du blob local. Toujours null pour type
    // "text". Jamais une URL complète : juste le chemin objet, une URL signée de courte durée
    // est générée à la demande côté serveur (cf. app/api/notes/[id]/audio/route.ts, AD-6) —
    // ne jamais persister d'URL signée elle-même.
  transcription: string | null; // null = jamais transcrite (état par défaut, y compris pour
    // type "text" où ce champ n'est jamais renseigné) ; texte généré par `gpt-transcribe`
    // (FR-17, Story 5.3) une fois la transcription demandée, ou choisi lors d'une résolution
    // de conflit.
  transcriptionUpdatedAt: string; // ISO 8601 UTC — dernière modification LOCALE de
    // `transcription` (AD-3, même mécanique que Task.statusUpdatedAt, Story 3.6)
  transcriptionSyncedAt: string | null; // valeur de transcription_updated_at au dernier sync
    // réussi ; null si jamais synchronisé
  transcriptionConflict: FieldConflict<string | null> | null; // non-null = conflit réel non résolu
  priority: Priority;
  provenance: Provenance;
  isNew: boolean;
  createdAt: string; // ISO 8601 UTC
}

// Un contenu composé uniquement d'espaces est traité comme vide (même règle que
// validateTaskTitle/validateProjectName). Ne s'applique qu'au type "text" — une note vocale
// n'a pas de contenu texte à valider (cf. validateAudioSize ci-dessous).
export function validateNoteContent(content: string): boolean {
  return content.trim().length > 0;
}

// NFR-10 : 20 Mo max par fichier (document ou note vocale) — AD-5 "vérifiée à la capture".
// Définie ici plutôt que dans un module partagé : Document (Epic 6) définira la sienne le
// jour venu, même précédent de duplication assumée que le reste de ce fichier (cf. Dev
// Notes Story 5.2 — chaque story n'ajoute que ce dont elle a réellement besoin).
export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

export function validateAudioSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_AUDIO_SIZE_BYTES;
}

// FR-25 : le badge "nouveau" disparaît à l'ouverture, quel que soit l'appareil — même
// logique que openTask (domain/task.ts), dupliquée ici (entités distinctes, pas de
// supertype partagé prématuré, cf. Dev Notes de la Story 3.3).
export function openNote(note: Note): Note {
  return { ...note, isNew: false };
}

// FR-17 : écrit le résultat d'une transcription réussie (gpt-transcribe), ou la valeur
// choisie lors d'une résolution de conflit (AD-3) — même rôle que setTaskStatus/
// setTaskPriority (Story 3.6) : efface systématiquement tout conflit en attente sur ce
// champ, une écriture explicite valant arbitrage implicite. `updatedAt` en paramètre (pas
// de `new Date()` interne) pour rester pure/déterministe, même précédent que Story 3.6.
export function setNoteTranscription(
  note: Note,
  transcription: string | null,
  updatedAt: string,
): Note {
  return { ...note, transcription, transcriptionUpdatedAt: updatedAt, transcriptionConflict: null };
}

// Ordre par défaut de l'onglet Notes — même convention que sortTasksChronologically
// (domain/task.ts). S'applique identiquement aux deux types (text/voice), cf. Dev Notes
// Story 5.1 : les filtres de tri combinables (FR-23) restent scopés à l'onglet Tâches.
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
