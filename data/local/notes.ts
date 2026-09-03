// data/local/notes.ts — lecture/écriture Dexie pour Note (FR-15 texte, FR-16 vocal, FR-17
// transcription). Dépend de domain/ (types) uniquement, cf. AD-2. Priorité non trackée pour
// conflit ici (contrairement à Task.status/priority, Story 3.6) : FR-14 ne s'applique qu'à
// Task, cf. Dev Notes Story 5.1. `transcription` EST conflict-trackée (AD-3, Story 5.3) —
// contrairement à `audioPath`, qui n'est écrit qu'une seule fois par sync/client.ts après
// upload réussi et n'est jamais comparé via resolveFieldSync, cf. Dev Notes Story 5.3.
import { db } from "./db";
import type { Note, Priority, Provenance } from "@/domain";
import { validateNoteContent, validateAudioSize, openNote, setNoteTranscription } from "@/domain";
import { enqueueCreate, enqueueField } from "./sync-queue";
import { saveNoteAudio } from "./note-audio";
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
    type: "text",
    content: input.content.trim(),
    audioPath: null,
    transcription: null,
    transcriptionUpdatedAt: now,
    transcriptionSyncedAt: null,
    transcriptionConflict: null,
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
        type: note.type,
        content: note.content,
        priority: note.priority,
        provenance: note.provenance,
        isNew: note.isNew,
        createdAt: note.createdAt,
        transcription: note.transcription,
      },
      getDeviceId(),
      now,
      tx,
    );
  });

  return note;
}

export interface CreateVoiceNoteInput {
  projectId: string; // toujours requis, même règle que CreateNoteInput (FR-2)
  priority: Priority;
  provenance: Provenance;
  audioBlob: Blob; // enregistrement brut du MediaRecorder (cf. app/capture-flow.tsx)
}

// FR-16 : capture d'une note vocale. `content` reste "" (pas de transcription avant FR-17,
// Story 5.3) ; `audioPath` reste null jusqu'à ce que sync/client.ts termine l'upload vers
// Supabase Storage (cf. markNoteAudioUploaded ci-dessous) — le blob lui-même est stocké
// immédiatement en local (data/local/note-audio.ts, AD-5), dans la même transaction que la
// note et sa file de synchronisation, pour ne jamais perdre l'un sans l'autre.
export async function createVoiceNote(input: CreateVoiceNoteInput): Promise<Note> {
  // Revalidé ici (pas seulement côté UI, même précédent que validateNoteContent ci-dessus) —
  // AD-5/NFR-10 : 20 Mo max, "vérifiée à la capture". app/capture-flow.tsx coupe déjà
  // l'enregistrement en temps réel à ce plafond (cf. Dev Notes), cette garde couvre le cas
  // résiduel d'un appelant qui ne le ferait pas.
  if (!validateAudioSize(input.audioBlob.size)) {
    throw new Error("Le fichier audio dépasse la taille maximale autorisée (20 Mo).");
  }

  const now = new Date().toISOString();

  const note: Note = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    type: "voice",
    content: "",
    audioPath: null,
    transcription: null,
    transcriptionUpdatedAt: now,
    transcriptionSyncedAt: null,
    transcriptionConflict: null,
    priority: input.priority,
    provenance: input.provenance,
    isNew: true,
    createdAt: now,
  };

  await db.transaction("rw", db.notes, db.syncQueue, db.noteAudio, async (tx) => {
    await db.notes.add(note);
    await saveNoteAudio(note.id, input.audioBlob, tx);
    await enqueueCreate(
      "note",
      note.id,
      {
        projectId: note.projectId,
        type: note.type,
        content: note.content,
        priority: note.priority,
        provenance: note.provenance,
        isNew: note.isNew,
        createdAt: note.createdAt,
        transcription: note.transcription,
      },
      getDeviceId(),
      now,
      tx,
    );
  });

  return note;
}

// Vue projet (onglet Notes) — même précédent que listTasksByProject. Retourne les deux types
// indifféremment (sortNotes/l'UI font la distinction par `type`, cf. Dev Notes).
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

// Appelée uniquement par sync/client.ts (uploadPendingAudio) une fois l'upload du blob réussi
// côté serveur — jamais par l'UI directement (AD-1 : toute écriture qui atteint le réseau
// transite par sync/). Pas de garde d'idempotence façon markNoteOpened : un second appel pour
// la même note ne devrait jamais se produire (uploadPendingAudio ne retente que les notes dont
// audioPath est encore null), mais écraser avec la même valeur serait de toute façon sans
// conséquence.
export async function markNoteAudioUploaded(id: string, audioPath: string): Promise<Note> {
  return db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
    const existing = await getNoteOrThrow(id);
    const updated: Note = { ...existing, audioPath };
    await db.notes.put(updated);
    await enqueueField(
      {
        entity: "note",
        entityId: id,
        field: "audioPath",
        operation: "update",
        value: audioPath,
        deviceId: getDeviceId(),
        updatedAt: new Date().toISOString(),
      },
      tx,
    );
    return updated;
  });
}

// Persiste le résultat d'une transcription (FR-17) — appelée par app/ après un appel réseau
// réussi à /api/sync/transcribe-audio (jamais par ce module directement : data/local/ ne
// dépend que de domain/, cf. AD-2, en-tête de fichier). Réutilisée aussi pour la résolution
// d'un conflit de transcription (choix entre les deux valeurs, cf. ConflictBanner côté UI) —
// même précédent qu'updateTaskStatus/updateTaskPriority (Story 3.6) : la garde d'idempotence
// ne court-circuite pas quand un conflit est en attente, pour permettre de "trancher" même
// en choisissant la valeur déjà affichée localement.
export async function updateNoteTranscription(
  id: string,
  transcription: string | null,
): Promise<Note> {
  return db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
    const existing = await getNoteOrThrow(id);
    if (existing.transcription === transcription && existing.transcriptionConflict === null) {
      return existing;
    }
    const now = new Date().toISOString();
    const updated = setNoteTranscription(existing, transcription, now);
    await db.notes.put(updated);
    await enqueueField(
      {
        entity: "note",
        entityId: id,
        field: "transcription",
        operation: "update",
        value: updated.transcription,
        deviceId: getDeviceId(),
        updatedAt: now,
      },
      tx,
    );
    return updated;
  });
}
