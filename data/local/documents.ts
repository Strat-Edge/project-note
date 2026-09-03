// data/local/documents.ts — lecture/écriture Dexie pour Document (FR-18 à FR-21, Stories 6.1/6.2/6.3).
// Dépend de domain/ (types) uniquement, cf. AD-2. Aucun champ conflict-tracké (contrairement à
// Task.status/priority, Note.transcription) : storagePath suit exactement le même traitement
// qu'audioPath (Note, Story 5.2) — écrit une seule fois par sync/client.ts après upload
// réussi, jamais comparé via resolveFieldSync (cf. Dev Notes).
import { db } from "./db";
import type { Document, Priority, Provenance } from "@/domain";
import { validateDocumentSize, openDocument } from "@/domain";
import { enqueueCreate, enqueueField, enqueueDelete } from "./sync-queue";
import { saveDocumentFile } from "./document-file";
import { getDeviceId } from "@/lib/device";

export interface CreateDocumentInput {
  projectId: string; // toujours requis (FR-2), même règle que CreateNoteInput
  priority: Priority;
  provenance: Provenance;
  file: File; // sélecteur de fichier (desktop) ou caméra/galerie (mobile), cf. app/capture-flow.tsx
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  // Revalidé ici (pas seulement côté UI), même précédent que validateAudioSize
  // (createVoiceNote, data/local/notes.ts).
  if (!validateDocumentSize(input.file.size)) {
    throw new Error("Le fichier dépasse la taille maximale autorisée (20 Mo).");
  }

  const now = new Date().toISOString();

  const document: Document = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    fileName: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
    storagePath: null,
    priority: input.priority,
    provenance: input.provenance,
    isNew: true,
    createdAt: now,
  };

  await db.transaction("rw", db.documents, db.syncQueue, db.documentFiles, async (tx) => {
    await db.documents.add(document);
    await saveDocumentFile(document.id, input.file, tx);
    await enqueueCreate(
      "document",
      document.id,
      {
        projectId: document.projectId,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        priority: document.priority,
        provenance: document.provenance,
        isNew: document.isNew,
        createdAt: document.createdAt,
      },
      getDeviceId(),
      now,
      tx,
    );
  });

  return document;
}

// Appelée uniquement par sync/client.ts (uploadPendingDocuments) une fois l'upload du blob
// réussi côté serveur — jamais par l'UI directement (AD-1). Même précédent que
// markNoteAudioUploaded (data/local/notes.ts) : pas de garde d'idempotence, un second appel ne
// devrait jamais se produire (uploadPendingDocuments ne retente que les documents dont
// storagePath est encore null) mais serait de toute façon sans conséquence.
export async function markDocumentUploaded(id: string, storagePath: string): Promise<Document> {
  return db.transaction("rw", db.documents, db.syncQueue, async (tx) => {
    const existing = await db.documents.get(id);
    if (!existing) {
      throw new Error("Document introuvable.");
    }
    const updated: Document = { ...existing, storagePath };
    await db.documents.put(updated);
    await enqueueField(
      {
        entity: "document",
        entityId: id,
        field: "storagePath",
        operation: "update",
        value: storagePath,
        deviceId: getDeviceId(),
        updatedAt: new Date().toISOString(),
      },
      tx,
    );
    return updated;
  });
}

// Vue projet (onglet Documents) — même précédent que listTasksByProject/listNotesByProject.
// Utilise l'index `projectId` déjà déclaré (data/local/db.ts, version 7, Story 6.1) : aucune
// nouvelle version Dexie nécessaire.
export async function listDocumentsByProject(projectId: string): Promise<Document[]> {
  return db.documents.where("projectId").equals(projectId).toArray();
}

async function getDocumentOrThrow(id: string): Promise<Document> {
  const document = await db.documents.get(id);
  if (!document) {
    throw new Error("Document introuvable.");
  }
  return document;
}

// FR-25 : marque un document comme consulté (le badge "nouveau" disparaît). Court-circuit
// idempotent si déjà ouvert, même précédent que markTaskOpened/markNoteOpened. Aucune
// migration Supabase requise : la table `documents` porte déjà `is_new boolean not null
// default true` (migration Story 6.1), et `documentFieldsToColumns`/`toLocalDocument`
// (data/remote/sync.ts, sync/client.ts) mappent déjà `isNew` ↔ `is_new`.
export async function markDocumentOpened(id: string): Promise<Document> {
  return db.transaction("rw", db.documents, db.syncQueue, async (tx) => {
    const existing = await getDocumentOrThrow(id);
    if (!existing.isNew) {
      return existing;
    }

    const opened = openDocument(existing);
    await db.documents.put(opened);
    await enqueueField(
      {
        entity: "document",
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

// Suppression définitive (FR-21) — écriture optimiste immédiate en local (AD-1, même
// position que createDocument) : retire la ligne `documents` ET son blob `documentFiles`
// dans la même transaction, puis met en file une suppression (enqueueDelete) pour que
// sync/ la propage à Supabase (ligne Postgres + fichier Storage, cf. sync/server.ts
// deleteDocumentAndFile). L'appareil qui n'a jamais eu ce document localement (un autre
// appareil de Guillaume) le découvre au pull suivant (cf. sync/client.ts pullOnce,
// réconciliation par storagePath — Story 6.3).
export async function deleteDocument(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction("rw", db.documents, db.documentFiles, db.syncQueue, async (tx) => {
    await tx.table("documents").delete(id);
    await tx.table("documentFiles").delete(id);
    await enqueueDelete("document", id, getDeviceId(), now, tx);
  });
}
