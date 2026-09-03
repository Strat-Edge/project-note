import {
  db,
  listPendingAndError,
  markSyncing,
  markSucceeded,
  markFailed,
  resetErrorsToPending,
  resetStaleSyncingToPending,
  getNoteAudio,
  markNoteAudioUploaded,
  updateNoteTranscription,
  listPendingTranscriptionNoteIds,
  clearTranscriptionPending,
  getDocumentFile,
  markDocumentUploaded,
} from "@/data/local";
import type { Document, Note, Project, SyncQueueEntry, Task } from "@/domain";
import { resolveFieldSync, syncQueueEntryId } from "@/domain";

// Délai avant abandon d'une requête réseau (cf. Review Findings Story 3.2) : sans lui, une
// connexion qui pend indéfiniment laisse l'entrée bloquée en "syncing" et l'indicateur affiche
// "Synchronisation…" jusqu'au prochain rechargement de page.
const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// sync/client.ts — moteur client (détection réseau, traitement de la file, pull en insertion
// seule). N'importe jamais data/remote/ (AD-2, AD-6) : parle au serveur exclusivement via fetch
// sur des routes relatives (@/sync/server, invoqué uniquement par ces route handlers). Cf. Dev
// Notes Story 3.2 sur la répartition client/serveur du dossier sync/.

// Formes locales dupliquées des lignes distantes (jamais importées depuis data/remote/sync.ts,
// même en `import type` — cf. Dev Notes Story 3.2, ne pas créer de dépendance de module vers un
// fichier gardé "server-only").
interface PulledProjectRow {
  id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  created_at: string;
}

interface PulledTaskRow {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  due_date: string | null;
  reminder_at: string | null;
  priority: string;
  status: string;
  provenance: string;
  is_new: boolean;
  created_at: string;
  status_updated_at: string;
  priority_updated_at: string;
}

interface PulledNoteRow {
  id: string;
  project_id: string;
  type: string;
  content: string;
  audio_path: string | null;
  transcription: string | null;
  transcription_updated_at: string;
  priority: string;
  provenance: string;
  is_new: boolean;
  created_at: string;
}

interface PulledDocumentRow {
  id: string;
  project_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string | null;
  priority: string;
  provenance: string;
  is_new: boolean;
  created_at: string;
}

function toLocalProject(row: PulledProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color as Project["color"],
    status: row.status as Project["status"],
    createdAt: row.created_at,
  };
}

// Postgres/Supabase sérialise les timestamptz avec un suffixe "+00:00" (ex.
// "...804+00:00"), jamais "Z" — alors que tout horodatage produit côté client passe par
// `new Date().toISOString()` (toujours suffixe "Z", cf. Task.statusUpdatedAt/statusSyncedAt).
// resolveFieldSync compare ces chaînes lexicographiquement ; mélanger les deux formats
// fausserait la comparaison (le caractère "Z" (0x5A) est toujours "supérieur" à "+" (0x2B),
// indépendamment de l'ordre chronologique réel). Toute valeur distante est donc normalisée
// au même format avant comparaison ou stockage local (Story 3.6, trouvé en vérification
// manuelle).
function toIsoZ(value: string): string {
  return new Date(value).toISOString();
}

function toLocalTask(row: PulledTaskRow): Task {
  const statusUpdatedAt = toIsoZ(row.status_updated_at);
  const priorityUpdatedAt = toIsoZ(row.priority_updated_at);
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    reminderAt: row.reminder_at,
    priority: row.priority as Task["priority"],
    status: row.status as Task["status"],
    provenance: row.provenance as Task["provenance"],
    isNew: row.is_new,
    createdAt: row.created_at,
    // Une tâche encore inconnue localement : le snapshot distant devient la vérité locale
    // de référence, donc *SyncedAt = *_updated_at — le pull lui-même est le point de synchro
    // (AD-3, Story 3.6).
    statusUpdatedAt,
    statusSyncedAt: statusUpdatedAt,
    statusConflict: null,
    priorityUpdatedAt,
    prioritySyncedAt: priorityUpdatedAt,
    priorityConflict: null,
  };
}

// `audioPath` n'est pas conflict-tracké (cf. domain/note.ts, Dev Notes Story 5.2) : reflète
// l'état distant tel quel, si non encore uploadé ailleurs reste null localement aussi
// (uploadPendingAudio ci-dessous ne le tentera pas depuis cet appareil s'il n'a jamais eu le
// blob localement). `transcription`, lui, EST conflict-tracké (AD-3, Story 5.3) — une note
// encore inconnue localement : le snapshot distant devient la vérité locale de référence,
// donc transcriptionSyncedAt = transcription_updated_at normalisé (même précédent que
// toLocalTask ci-dessus).
function toLocalNote(row: PulledNoteRow): Note {
  const transcriptionUpdatedAt = toIsoZ(row.transcription_updated_at);
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as Note["type"],
    content: row.content,
    audioPath: row.audio_path,
    transcription: row.transcription,
    transcriptionUpdatedAt,
    transcriptionSyncedAt: transcriptionUpdatedAt,
    transcriptionConflict: null,
    priority: row.priority as Note["priority"],
    provenance: row.provenance as Note["provenance"],
    isNew: row.is_new,
    createdAt: row.created_at,
  };
}

// Document n'a aucun champ conflict-tracké (cf. Dev Notes Story 6.1) : contrairement à toLocalNote
// (transcriptionSyncedAt = transcription_updated_at), rien à normaliser via toIsoZ ici au-delà
// de storagePath, qui reflète l'état distant tel quel — même traitement qu'audioPath (Note).
function toLocalDocument(row: PulledDocumentRow): Document {
  return {
    id: row.id,
    projectId: row.project_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    priority: row.priority as Document["priority"],
    provenance: row.provenance as Document["provenance"],
    isNew: row.is_new,
    createdAt: row.created_at,
  };
}

// Fusionne une ligne distante avec un projet déjà connu localement — jusqu'ici pullOnce()
// n'insérait un projet QUE s'il était totalement inconnu localement (comportement "insertion
// seule" hérité de la Story 3.2, jamais mis à jour depuis) : un archivage/désarchivage
// (data/local/projects.ts) écrit bien `status` en local et l'envoie en file, mais l'AUTRE
// appareil ignorait ensuite silencieusement toute ligne distante dont l'id existait déjà —
// son statut local ne bougeait donc jamais (retour Guillaume : "j'ai archivé un projet [sur
// le téléphone] et il ne s'est pas archivé sur l'ordinateur").
//
// Contrairement à mergeExistingTask ci-dessous, pas de résolution de conflit par champ à la
// AD-3 (statusUpdatedAt/statusSyncedAt) : Project ne porte pas ces horodatages (domain/
// project.ts) et un archivage est un geste bien trop rare pour justifier d'étendre son schéma
// pour ça. Garde plus simple mais dans le même esprit qu'AD-3 ("jamais d'écrasement
// silencieux d'un changement local pas encore synchronisé") : si une entrée de file est
// encore en attente pour ce projet/ce champ, un archivage/désarchivage vient d'être fait sur
// CET appareil et n'a pas encore atteint le serveur — le pull ne doit pas l'écraser avec une
// valeur distante forcément plus ancienne ; le push qui suit dans le même cycle (AD-3, ordre
// pull-puis-push) la fera converger normalement.
async function mergeExistingProject(existing: Project, row: PulledProjectRow): Promise<void> {
  const remoteStatus = row.status as Project["status"];
  if (existing.status === remoteStatus) {
    return;
  }

  const pendingStatusEntry = await db.syncQueue.get(syncQueueEntryId(existing.id, "status"));
  if (pendingStatusEntry) {
    return;
  }

  await db.projects.update(existing.id, { status: remoteStatus });
}

// Fusionne une ligne distante avec une tâche déjà connue localement (AD-3, Story 3.6) —
// remplace l'ancien comportement "insertion seule" (Story 3.2) qui ignorait silencieusement
// toute ligne distante dont l'id existait déjà en local. Compare status et priority
// indépendamment (résolution par champ, jamais par enregistrement entier).
async function mergeExistingTask(existing: Task, row: PulledTaskRow): Promise<void> {
  // Repli pour les enregistrements locaux antérieurs à cette story (revue de code) : Dexie ne
  // force aucun schéma sur les propriétés non indexées, donc *UpdatedAt/*SyncedAt peuvent être
  // `undefined` en pratique sur une tâche créée avant ce déploiement, même si le type ne
  // l'autorise pas. resolveFieldSync ne reconnaît que `null` comme "jamais synchronisé" — sans
  // cette normalisation, `undefined` retomberait silencieusement sur "keep-local" en cas de
  // vraie divergence au lieu du repli prudent "conflict". `createdAt` est le meilleur proxy
  // disponible pour "dernière modification connue" d'un champ jamais explicitement horodaté.
  const localStatusUpdatedAt = existing.statusUpdatedAt ?? existing.createdAt;
  const localStatusSyncedAt = existing.statusSyncedAt ?? null;
  const localPriorityUpdatedAt = existing.priorityUpdatedAt ?? existing.createdAt;
  const localPrioritySyncedAt = existing.prioritySyncedAt ?? null;

  const remoteStatusUpdatedAt = toIsoZ(row.status_updated_at);
  const remotePriorityUpdatedAt = toIsoZ(row.priority_updated_at);

  const statusDecision = resolveFieldSync(
    existing.status,
    localStatusUpdatedAt,
    localStatusSyncedAt,
    row.status as Task["status"],
    remoteStatusUpdatedAt,
  );
  const priorityDecision = resolveFieldSync(
    existing.priority,
    localPriorityUpdatedAt,
    localPrioritySyncedAt,
    row.priority as Task["priority"],
    remotePriorityUpdatedAt,
  );

  // Un champ nécessite une écriture dès que sa décision n'est pas "keep-local" (rien à faire,
  // le push en file s'en charge) ni un "noop" déjà pleinement convergé (valeur ET point de
  // synchro alignés) — calculé indépendamment par champ (revue de code). L'ancien retour
  // anticipé combiné (`if (les deux sont "noop") return`) sautait la réconciliation d'un champ
  // dès que l'AUTRE était "noop", laissant son point de synchro périmé indéfiniment après la
  // résolution d'un conflit sur l'autre appareil — exposant à de futurs faux conflits.
  const statusNeedsWrite =
    statusDecision === "adopt-remote" ||
    statusDecision === "conflict" ||
    (statusDecision === "noop" && localStatusSyncedAt !== remoteStatusUpdatedAt);
  const priorityNeedsWrite =
    priorityDecision === "adopt-remote" ||
    priorityDecision === "conflict" ||
    (priorityDecision === "noop" && localPrioritySyncedAt !== remotePriorityUpdatedAt);

  if (!statusNeedsWrite && !priorityNeedsWrite) {
    return;
  }

  await db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
    const patch: Partial<Task> = {};

    if (statusDecision === "adopt-remote") {
      patch.status = row.status as Task["status"];
      patch.statusUpdatedAt = remoteStatusUpdatedAt;
      patch.statusSyncedAt = remoteStatusUpdatedAt;
      patch.statusConflict = null;
    } else if (statusDecision === "conflict") {
      patch.statusConflict = { local: existing.status, remote: row.status as Task["status"] };
      // Annule le push en attente sur ce champ — sans ça, le prochain processQueue()
      // écraserait silencieusement la valeur distante avec la valeur locale conflictuelle,
      // exactement l'écrasement silencieux qu'AD-3 interdit. La valeur locale n'est pas
      // perdue : elle reste consultable dans statusConflict.local jusqu'à l'arbitrage.
      await tx.table("syncQueue").delete(syncQueueEntryId(existing.id, "status"));
    } else if (statusNeedsWrite) {
      // Valeurs déjà identiques mais point de synchro pas encore réaligné (ex. après
      // résolution d'un conflit sur un autre appareil) — reconverger évite un faux conflit
      // lors d'un futur pull.
      patch.statusSyncedAt = remoteStatusUpdatedAt;
      patch.statusConflict = null;
    }

    if (priorityDecision === "adopt-remote") {
      patch.priority = row.priority as Task["priority"];
      patch.priorityUpdatedAt = remotePriorityUpdatedAt;
      patch.prioritySyncedAt = remotePriorityUpdatedAt;
      patch.priorityConflict = null;
    } else if (priorityDecision === "conflict") {
      patch.priorityConflict = { local: existing.priority, remote: row.priority as Task["priority"] };
      await tx.table("syncQueue").delete(syncQueueEntryId(existing.id, "priority"));
    } else if (priorityNeedsWrite) {
      patch.prioritySyncedAt = remotePriorityUpdatedAt;
      patch.priorityConflict = null;
    }

    await db.tasks.update(existing.id, patch);
  });
}

// Fusionne une ligne distante avec une note déjà connue localement (AD-3, Story 5.3) —
// remplace l'ancienne réconciliation "isNew seulement" (Story 5.1), insuffisante maintenant
// que transcription est un champ conflict-tracké. Même repli que mergeExistingTask pour les
// enregistrements locaux antérieurs à cette story (transcriptionUpdatedAt/SyncedAt
// potentiellement `undefined`, jamais `null`, cf. Dev Notes Story 3.6).
async function mergeExistingNote(existing: Note, row: PulledNoteRow): Promise<void> {
  const localTranscriptionUpdatedAt = existing.transcriptionUpdatedAt ?? existing.createdAt;
  const localTranscriptionSyncedAt = existing.transcriptionSyncedAt ?? null;
  const remoteTranscriptionUpdatedAt = toIsoZ(row.transcription_updated_at);

  const transcriptionDecision = resolveFieldSync(
    existing.transcription,
    localTranscriptionUpdatedAt,
    localTranscriptionSyncedAt,
    row.transcription,
    remoteTranscriptionUpdatedAt,
  );

  const transcriptionNeedsWrite =
    transcriptionDecision === "adopt-remote" ||
    transcriptionDecision === "conflict" ||
    (transcriptionDecision === "noop" &&
      localTranscriptionSyncedAt !== remoteTranscriptionUpdatedAt);

  // isNew : transition à sens unique (true -> false), jamais recréée à true — même
  // réconciliation qu'avant cette story (cf. Dev Notes Story 5.1), désormais regroupée dans
  // cette même fonction plutôt que dans une branche séparée de pullOnce.
  const isNewNeedsWrite = existing.isNew && !row.is_new;

  if (!transcriptionNeedsWrite && !isNewNeedsWrite) {
    return;
  }

  await db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
    const patch: Partial<Note> = {};

    if (transcriptionDecision === "adopt-remote") {
      patch.transcription = row.transcription;
      patch.transcriptionUpdatedAt = remoteTranscriptionUpdatedAt;
      patch.transcriptionSyncedAt = remoteTranscriptionUpdatedAt;
      patch.transcriptionConflict = null;
    } else if (transcriptionDecision === "conflict") {
      patch.transcriptionConflict = { local: existing.transcription, remote: row.transcription };
      // Annule le push en attente sur ce champ — sans ça, le prochain processQueue()
      // écraserait silencieusement la valeur distante avec la valeur locale conflictuelle
      // (AD-3). La valeur locale reste consultable dans transcriptionConflict.local.
      await tx.table("syncQueue").delete(syncQueueEntryId(existing.id, "transcription"));
    } else if (transcriptionNeedsWrite) {
      patch.transcriptionSyncedAt = remoteTranscriptionUpdatedAt;
      patch.transcriptionConflict = null;
    }

    if (isNewNeedsWrite) {
      patch.isNew = false;
    }

    await db.notes.update(existing.id, patch);
  });
}

// Fait avancer le point de synchro (*SyncedAt) sur Task pour les champs status/priority dont
// le push vient de réussir (AD-3, Story 3.6). Sans cette étape, *SyncedAt resterait bloqué à
// null indéfiniment et tout futur pull détecterait un "conflit" à la moindre divergence, y
// compris légitime — c'est ce qui fait tenir tout l'algorithme de resolveFieldSync.
async function markTaskFieldsSynced(succeeded: readonly SyncQueueEntry[]): Promise<void> {
  const relevant = succeeded.filter(
    (entry) => entry.entity === "task" && (entry.field === "status" || entry.field === "priority"),
  );
  if (relevant.length === 0) {
    return;
  }

  // Lecture-puis-écriture conditionnelle regroupée dans une transaction (revue de code) —
  // même précédent que toutes les autres opérations multi-étapes de ce fichier/de la base
  // (createTask, updateTaskStatus, updateTaskPriority, markTaskOpened, mergeExistingTask).
  await db.transaction("rw", db.tasks, async () => {
    for (const entry of relevant) {
      const task = await db.tasks.get(entry.entityId);
      if (!task) continue;

      // Garde de réédition en vol (même précédent que markSucceeded/markFailed,
      // data/local/sync-queue.ts) : si l'utilisateur a modifié ce champ à nouveau pendant que
      // cet envoi était en vol, *UpdatedAt ne correspond plus à entry.updatedAt — ne pas
      // marquer comme synchronisée une valeur qui vient d'être remplacée localement, elle a
      // déjà sa propre entrée de file fraîche.
      if (entry.field === "status" && task.statusUpdatedAt === entry.updatedAt) {
        await db.tasks.update(entry.entityId, { statusSyncedAt: entry.updatedAt });
      }
      if (entry.field === "priority" && task.priorityUpdatedAt === entry.updatedAt) {
        await db.tasks.update(entry.entityId, { prioritySyncedAt: entry.updatedAt });
      }
    }
  });
}

// Fait avancer le point de synchro (transcriptionSyncedAt) sur Note pour le champ
// transcription dont le push vient de réussir (AD-3, Story 5.3) — même rôle que
// markTaskFieldsSynced pour status/priority (Story 3.6). S'applique aussi bien à l'entrée
// "create" initiale (transcription: null poussée à la création, cf. data/local/notes.ts)
// qu'à une "update" ultérieure (résultat d'une vraie transcription) — aucun filtre sur
// `operation`, même précédent que markTaskFieldsSynced.
async function markNoteFieldsSynced(succeeded: readonly SyncQueueEntry[]): Promise<void> {
  const relevant = succeeded.filter(
    (entry) => entry.entity === "note" && entry.field === "transcription",
  );
  if (relevant.length === 0) {
    return;
  }

  await db.transaction("rw", db.notes, async () => {
    for (const entry of relevant) {
      const note = await db.notes.get(entry.entityId);
      if (!note) continue;

      if (note.transcriptionUpdatedAt === entry.updatedAt) {
        await db.notes.update(entry.entityId, { transcriptionSyncedAt: entry.updatedAt });
      }
    }
  });
}

// Upload d'un blob volumineux : délai plus généreux que FETCH_TIMEOUT_MS (15s, calibré pour
// le JSON de la file de synchronisation) — jusqu'à 20 Mo (NFR-10) sur une connexion lente.
// Nom générique (pas AUDIO_*) : utilisée par l'upload audio, l'upload document (Story 6.1) et
// la requête de transcription, pas seulement l'audio (renommée en Story 6.1).
const BLOB_UPLOAD_TIMEOUT_MS = 60_000;

// Notes vocales dont le blob local n'a pas encore été téléversé vers Supabase Storage
// (audioPath encore null) — étape distincte du flux générique de la file de synchronisation
// (data/local/sync-queue.ts) : un Blob ne peut pas transiter par JSON.stringify() (cf. Dev
// Notes Story 5.2, /api/sync/push reçoit du JSON). Appelée dans runSyncCycle avant
// processQueue() : une fois l'upload réussi, audioPath est mis en file (enqueueField, via
// markNoteAudioUploaded) et repoussé au serveur par le mécanisme générique existant, au même
// cycle. Pas de compteur de tentatives dédié (contrairement à data/local/sync-queue.ts
// attempts/MAX_SYNC_ATTEMPTS) — un simple filtre "audioPath === null" ; NFR-5 (reprise depuis
// le dernier point réussi pour un upload interrompu) explicitement hors périmètre de cette
// story, cf. Dev Notes.
async function uploadPendingAudio(): Promise<void> {
  const allNotes = await db.notes.toArray();
  const pending = allNotes.filter((note) => note.type === "voice" && note.audioPath === null);

  for (const note of pending) {
    const blob = await getNoteAudio(note.id);
    if (!blob) {
      // Blob jamais enregistré localement pour cette note (ne devrait pas arriver — écrit
      // dans la même transaction que la note à la création, cf. createVoiceNote) : rien à
      // téléverser depuis cet appareil, une note vocale créée ailleurs attend son propre
      // appareil d'origine pour l'upload.
      continue;
    }

    try {
      const formData = new FormData();
      formData.append("noteId", note.id);
      formData.append("file", blob, "recording");

      const response = await fetchWithTimeout(
        "/api/sync/upload-audio",
        { method: "POST", body: formData },
        BLOB_UPLOAD_TIMEOUT_MS,
      );
      if (!response.ok) {
        continue; // réessayé au prochain cycle (online/intervalle)
      }
      const result = (await response.json()) as { path: string };
      await markNoteAudioUploaded(note.id, result.path);
    } catch {
      // Réessayé au prochain cycle — même position que processQueue face à un échec réseau.
    }
  }
}

// Documents dont le blob local n'a pas encore été téléversé vers Supabase Storage
// (storagePath encore null) — même structure exacte qu'uploadPendingAudio (Story 5.2),
// adaptée à Document. Appelée dans runSyncCycle avant processQueue() : une fois l'upload
// réussi, storagePath est mis en file (enqueueField, via markDocumentUploaded) et repoussé au
// serveur par le mécanisme générique existant, au même cycle.
async function uploadPendingDocuments(): Promise<void> {
  const allDocuments = await db.documents.toArray();
  const pending = allDocuments.filter((document) => document.storagePath === null);

  for (const document of pending) {
    const blob = await getDocumentFile(document.id);
    if (!blob) {
      // Blob jamais enregistré localement pour ce document (ne devrait pas arriver — écrit
      // dans la même transaction que le document à la création, cf. createDocument) : rien à
      // téléverser depuis cet appareil, un document créé ailleurs attend son propre appareil
      // d'origine pour l'upload.
      continue;
    }

    try {
      const formData = new FormData();
      formData.append("documentId", document.id);
      formData.append("file", blob, document.fileName);

      const response = await fetchWithTimeout(
        "/api/sync/upload-document",
        { method: "POST", body: formData },
        BLOB_UPLOAD_TIMEOUT_MS,
      );
      if (!response.ok) {
        continue; // réessayé au prochain cycle (online/intervalle) — AC#4 : le blob local
        // n'est jamais perdu (Dexie), la capture n'est jamais à refaire.
      }
      const result = (await response.json()) as { path: string };
      await markDocumentUploaded(document.id, result.path);
    } catch {
      // Réessayé au prochain cycle — même position que processQueue face à un échec réseau.
    }
  }
}

// Filet de sécurité pour une transcription demandée depuis app/ (case à la création ou bouton
// du détail, cf. Dev Notes Story 5.3) dont le résultat OpenAI n'a jamais atteint
// updateNoteTranscription — ex. l'onglet fermé entre la réponse réussie et l'écriture Dexie.
// `data/local/pending-transcription.ts` porte un marqueur durable (jamais synchronisé, comme
// `noteAudio`) posé par app/ AVANT chaque appel immédiat et retiré après une écriture réussie ;
// s'il survit jusqu'ici, l'appel immédiat a échoué ou a été interrompu — retenté ici, même
// position qu'uploadPendingAudio (pas de compteur de tentatives dédié, retentée indéfiniment
// tant que le marqueur existe et que transcription reste null).
async function retryPendingTranscriptions(): Promise<void> {
  const pendingIds = await listPendingTranscriptionNoteIds();

  for (const noteId of pendingIds) {
    const note = await db.notes.get(noteId);
    if (!note || note.transcription !== null) {
      // Déjà résolue par l'appel immédiat entre-temps (ou note disparue) — marqueur périmé.
      await clearTranscriptionPending(noteId);
      continue;
    }

    const blob = await getNoteAudio(noteId);
    if (!blob) {
      // Blob jamais enregistré localement sur CET appareil (note dont la transcription a été
      // demandée depuis un autre appareil, ou blob pas encore écrit) : rien à retenter d'ici.
      continue;
    }

    try {
      const response = await fetchWithTimeout(
        "/api/sync/transcribe-audio",
        { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob },
        BLOB_UPLOAD_TIMEOUT_MS,
      );
      if (!response.ok) {
        continue; // réessayé au prochain cycle
      }
      const result = (await response.json()) as { text: string };
      await updateNoteTranscription(noteId, result.text);
      await clearTranscriptionPending(noteId);
    } catch {
      // Réessayé au prochain cycle.
    }
  }
}

// Garde de ré-entrance (cf. Review Findings Story 3.2) : l'événement "online", l'intervalle de
// 30s et le montage initial peuvent tous se déclencher dans une fenêtre rapprochée — sans cette
// garde, plusieurs appels concurrents dupliqueraient les requêtes réseau et pourraient courir
// l'un contre l'autre sur les mêmes entrées de file.
let queueInFlight = false;

export async function processQueue(): Promise<void> {
  if (queueInFlight) {
    return;
  }

  const entries = await listPendingAndError();
  if (entries.length === 0) {
    return;
  }

  queueInFlight = true;
  try {
    const ids = entries.map((entry) => entry.id);
    await markSyncing(ids);

    try {
      const response = await fetchWithTimeout("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });

      if (!response.ok) {
        await markFailed(entries);
        return;
      }

      const result = (await response.json()) as {
        succeededIds: string[];
        failedIds: string[];
      };
      // Retrouve les entrées d'origine (avec leur updatedAt capturé avant l'envoi) à partir des
      // ids retournés par le serveur — markSucceeded/markFailed en ont besoin pour détecter une
      // réédition survenue pendant que cet envoi était en vol (cf. leur documentation).
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      const toEntries = (resultIds: string[]) =>
        resultIds
          .map((id) => byId.get(id))
          .filter((entry): entry is SyncQueueEntry => entry !== undefined);
      const succeededEntries = toEntries(result.succeededIds);
      await markSucceeded(succeededEntries);
      await markTaskFieldsSynced(succeededEntries);
      await markNoteFieldsSynced(succeededEntries);
      await markFailed(toEntries(result.failedIds));
    } catch {
      // Couvre aussi le cas d'une redirection 30x vers /login (session expirée, cf. Dev Notes
      // Story 3.2 sur proxy.ts) : le corps HTML n'est pas un JSON valide, response.json() lève.
      // Couvre également le timeout (fetchWithTimeout abandonne après FETCH_TIMEOUT_MS).
      await markFailed(entries);
    }
  } finally {
    queueInFlight = false;
  }
}

let pullInFlight = false;

export async function pullOnce(): Promise<void> {
  if (pullInFlight) {
    return;
  }

  pullInFlight = true;
  try {
    const response = await fetchWithTimeout("/api/sync/pull");
    if (!response.ok) {
      return;
    }

    const snapshot = (await response.json()) as {
      projects: PulledProjectRow[];
      tasks: PulledTaskRow[];
      notes: PulledNoteRow[];
      documents: PulledDocumentRow[];
    };

    for (const row of snapshot.projects) {
      try {
        const existing = await db.projects.get(row.id);
        if (!existing) {
          await db.projects.add(toLocalProject(row));
        } else {
          await mergeExistingProject(existing, row);
        }
      } catch {
        // Une ligne en échec (ex. ConstraintError d'une course avec un autre appel) ne doit pas
        // empêcher l'insertion des lignes suivantes de ce cycle — rattrapée au prochain cycle si
        // elle manque encore localement (cf. Review Findings Story 3.2).
      }
    }

    for (const row of snapshot.tasks) {
      try {
        const existing = await db.tasks.get(row.id);
        if (!existing) {
          await db.tasks.add(toLocalTask(row));
        } else {
          await mergeExistingTask(existing, row);
        }
      } catch {
        // idem
      }
    }

    for (const row of snapshot.notes) {
      try {
        const existing = await db.notes.get(row.id);
        if (!existing) {
          await db.notes.add(toLocalNote(row));
        } else {
          await mergeExistingNote(existing, row);
        }
      } catch {
        // idem
      }
    }

    // Insertion seule, pas de mergeExistingDocument (Story 6.1) — aucun champ de Document ne
    // peut diverger entre deux appareils après création dans cette story (storagePath est
    // écrit uniquement par l'appareil qui a réalisé l'upload lui-même ; isNew ne transitionne
    // jamais faute d'UI de consultation, cf. Scope boundary) — même position que le tout
    // premier pullOnce() de la Story 3.2, avant que Story 3.6 n'introduise mergeExistingTask
    // pour un besoin de conflit qui n'existe pas encore ici.
    for (const row of snapshot.documents) {
      try {
        const existing = await db.documents.get(row.id);
        if (!existing) {
          await db.documents.add(toLocalDocument(row));
        }
      } catch {
        // idem
      }
    }

    // Réconciliation de suppression cross-appareil (FR-21) — deleteDocument()
    // (data/local/documents.ts) retire déjà la ligne locale immédiatement sur l'appareil qui
    // supprime (écriture optimiste, AD-1) ; ce bloc couvre l'AUTRE appareil, qui doit
    // découvrir la suppression au prochain pull. fetchAllProjectsTasksNotesAndDocuments
    // (data/remote/sync.ts) renvoie l'état complet des documents restants (RLS, pas de filtre
    // incrémental) — tout document encore présent en local mais absent du snapshot a donc été
    // supprimé côté serveur. Garde `storagePath !== null` : un document créé hors ligne sur CET
    // appareil et jamais encore poussé au serveur (storagePath encore null, upload pas
    // terminé) n'apparaît pas non plus dans le snapshot distant, mais ne doit surtout pas être
    // traité comme "supprimé ailleurs" — il n'a tout simplement jamais existé côté serveur. Un
    // document synchronisé au moins une fois (storagePath non null) qui manque au snapshot n'a,
    // lui, qu'une seule explication possible : une suppression réussie entre-temps (par cet
    // appareil ou un autre).
    const remoteDocumentIds = new Set(snapshot.documents.map((row) => row.id));
    const localDocuments = await db.documents.toArray();
    for (const document of localDocuments) {
      if (document.storagePath !== null && !remoteDocumentIds.has(document.id)) {
        try {
          await db.transaction("rw", db.documents, db.documentFiles, db.syncQueue, async (tx) => {
            await tx.table("documents").delete(document.id);
            await tx.table("documentFiles").delete(document.id);
            // Purge toute entrée de file orpheline pour ce document (ex. un champ modifié sur
            // un appareil avant que l'autre ne le supprime) — rien à pousser pour un document
            // qui n'existe plus nulle part, même rationale qu'enqueueDelete.
            await tx.table("syncQueue").where("entityId").equals(document.id).delete();
          });
        } catch {
          // idem — rattrapé au prochain pull si cette écriture échoue.
        }
      }
    }
  } catch {
    // Échec silencieux (réseau, session expirée, timeout) — un prochain cycle (online/interval)
    // réessaiera, cf. startSyncEngine.
  } finally {
    pullInFlight = false;
  }
}

// Garde couvrant le cycle pull-puis-push entier (revue de code) — pullInFlight/queueInFlight
// ne protègent chacune que leur propre fonction, pas la séquence complète : sans cette garde
// partagée, deux runSyncCycle() quasi simultanés (ex. événement "online" + intervalle 30s)
// pouvaient entrelacer le pull de l'un avec le push de l'autre, contournant la garantie
// pull-puis-push ci-dessous par un chemin distinct de celui qu'elle couvre en interne.
let syncCycleInFlight = false;

// Ordre pull-puis-push strict, jamais l'inverse (AD-3, Story 3.6) : pullOnce() est ce qui
// détecte un conflit et retire l'entrée de file correspondante. Si processQueue() s'exécutait
// avant, il enverrait la valeur locale conflictuelle et écraserait la valeur distante avant
// même que le conflit ait pu être détecté — exactement l'écrasement silencieux qu'AD-3
// interdit. Utilisé aux trois points de déclenchement d'un cycle complet (handleOnline,
// rattrapage initial, intervalle) et par retryNow (revue de code — reroutée dans ce cycle
// plutôt que d'appeler processQueue() seule, pour ne jamais pousser sans avoir d'abord pull).
async function runSyncCycle(): Promise<void> {
  if (syncCycleInFlight) {
    return;
  }
  syncCycleInFlight = true;
  try {
    await pullOnce();
    await uploadPendingAudio();
    await uploadPendingDocuments();
    await retryPendingTranscriptions();
    await processQueue();
  } finally {
    syncCycleInFlight = false;
  }
}

// Déclenché par le tap sur l'indicateur en état "Non synchronisé — toucher pour réessayer".
// Repasse par runSyncCycle (revue de code) plutôt que par processQueue() seule : sans pull
// préalable, une valeur locale devenue conflictuelle pendant que l'entrée était en erreur
// aurait pu être poussée avant qu'un conflit n'ait la chance d'être détecté et annulé — le
// même écrasement silencieux qu'AD-3 interdit, via un chemin distinct des trois déclencheurs
// automatiques. Si un cycle est déjà en cours, ce tap se fond dedans (garde partagée
// ci-dessus) — les entrées tout juste repassées à "pending" seront traitées par ce cycle-là.
export async function retryNow(): Promise<void> {
  await resetErrorsToPending();
  await runSyncCycle();
}

export function startSyncEngine(): () => void {
  const handleOnline = () => {
    void runSyncCycle();
  };

  // Rattrapage des entrées restées "syncing" d'une session précédente interrompue en plein
  // envoi (fermeture d'onglet, rechargement) — sinon elles ne seraient plus jamais reprises
  // (listPendingAndError ignore "syncing"), cf. resetStaleSyncingToPending. Fait avant tout
  // appel réseau, même hors ligne, pour que ces entrées soient prêtes dès le retour du réseau.
  void resetStaleSyncingToPending().then(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void runSyncCycle();
    }
  });

  window.addEventListener("online", handleOnline);

  // Filet de sécurité : l'événement "online" ne se déclenche pas de façon fiable sur tous les
  // navigateurs mobiles en sortie de veille (cf. Dev Notes Story 3.2, recherche technique).
  const intervalId = window.setInterval(() => {
    if (navigator.onLine) {
      void runSyncCycle();
    }
  }, 30_000);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.clearInterval(intervalId);
  };
}
