// data/local/document-file.ts — stockage local du blob brut d'un document (FR-18, AD-5).
// Table Dexie distincte de `documents` (data/local/db.ts, version 7) : Document (domain/document.ts)
// reste un type pur sans dépendance Web API (cf. AD-2), et un Blob ne doit jamais transiter
// par le mécanisme JSON de la file de synchronisation (data/local/sync-queue.ts), même
// précédent que data/local/note-audio.ts (Story 5.2). Consommée par data/local/documents.ts
// (écriture, à la création) et sync/client.ts (lecture, upload différé vers Supabase Storage).
import type { Transaction } from "dexie";
import { db } from "./db";

export interface DocumentFileRecord {
  documentId: string;
  blob: Blob;
}

// `tx` optionnel — même pattern que saveNoteAudio : permet d'écrire le blob dans la même
// transaction que le document et sa file de synchronisation (cf. createDocument), pour ne
// jamais perdre l'un sans l'autre.
export async function saveDocumentFile(
  documentId: string,
  blob: Blob,
  tx?: Transaction,
): Promise<void> {
  const table = tx ? tx.table<DocumentFileRecord, string>("documentFiles") : db.documentFiles;
  await table.put({ documentId, blob });
}

export async function getDocumentFile(documentId: string): Promise<Blob | undefined> {
  const record = await db.documentFiles.get(documentId);
  return record?.blob;
}
