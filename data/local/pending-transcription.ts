// data/local/pending-transcription.ts — marqueurs locaux (jamais synchronisés) des notes dont
// une transcription a été demandée mais pas encore confirmée écrite (FR-17). Corrige une perte
// silencieuse trouvée en revue de code : l'appel immédiat déclenché par app/ (à la création ou
// depuis le détail) peut réussir côté OpenAI puis ne jamais atteindre updateNoteTranscription
// si l'onglet se ferme entre les deux — ce marqueur, lui, survit au rechargement et permet à
// sync/client.ts de retenter la transcription au prochain cycle, même rôle que
// Note.audioPath === null pour uploadPendingAudio (Story 5.2). Sert aussi à empêcher deux
// requêtes de transcription concurrentes pour la même note (déclenchement à la création +
// depuis le détail) : app/ vérifie ce marqueur avant de démarrer un nouvel appel immédiat.
import { db } from "./db";

export interface PendingTranscriptionRecord {
  noteId: string;
}

export async function markTranscriptionPending(noteId: string): Promise<void> {
  await db.pendingTranscriptions.put({ noteId });
}

export async function clearTranscriptionPending(noteId: string): Promise<void> {
  await db.pendingTranscriptions.delete(noteId);
}

export async function isTranscriptionPending(noteId: string): Promise<boolean> {
  return (await db.pendingTranscriptions.get(noteId)) !== undefined;
}

export async function listPendingTranscriptionNoteIds(): Promise<string[]> {
  return (await db.pendingTranscriptions.toArray()).map((record) => record.noteId);
}
