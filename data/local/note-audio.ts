// data/local/note-audio.ts — stockage local du blob brut d'une note vocale (FR-16, AD-5).
// Table Dexie distincte de `notes` (data/local/db.ts, version 5) : Note (domain/note.ts)
// reste un type pur sans dépendance Web API (cf. AD-2), et un Blob ne doit jamais transiter
// par le mécanisme JSON de la file de synchronisation (data/local/sync-queue.ts), qui
// sérialise ses entrées via JSON.stringify() pour /api/sync/push (cf. Dev Notes Story 5.2).
// Consommée par data/local/notes.ts (écriture, à la création d'une note vocale),
// sync/client.ts (lecture, upload différé vers Supabase Storage), et
// app/projects/[id]/project-view.tsx (lecture, lecture audio locale).
import type { Transaction } from "dexie";
import { db } from "./db";

export interface NoteAudioRecord {
  noteId: string;
  blob: Blob;
}

// `tx` optionnel — même pattern qu'enqueueField (data/local/sync-queue.ts) : permet d'écrire
// le blob dans la même transaction que la note et sa file de synchronisation (cf.
// createVoiceNote), pour ne jamais perdre l'un sans l'autre.
export async function saveNoteAudio(
  noteId: string,
  blob: Blob,
  tx?: Transaction,
): Promise<void> {
  const table = tx ? tx.table<NoteAudioRecord, string>("noteAudio") : db.noteAudio;
  await table.put({ noteId, blob });
}

export async function getNoteAudio(noteId: string): Promise<Blob | undefined> {
  const record = await db.noteAudio.get(noteId);
  return record?.blob;
}
