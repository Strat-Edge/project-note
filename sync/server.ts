import type { SupabaseClient } from "@supabase/supabase-js";
import {
  upsertProjectFields,
  upsertTaskFields,
  upsertNoteFields,
  upsertDocumentFields,
  fetchAllProjectsTasksNotesAndDocuments,
  getDocumentStoragePath,
  deleteDocumentRow,
} from "@/data/remote/sync";
import { uploadNoteAudio, createNoteAudioSignedUrl } from "@/data/remote/storage";
import {
  uploadDocumentFile,
  createDocumentSignedUrl,
  createDocumentPreviewUrl,
  removeDocumentFile,
} from "@/data/remote/document-storage";
import { transcribeAudio } from "@/data/remote/transcription";
import type { SyncQueueEntry } from "@/domain";

// sync/server.ts — seul fichier de sync/ qui importe data/remote/ (AD-2, AD-6). N'est jamais
// importé, même transitivement, par un composant "use client" — uniquement par les route
// handlers app/api/sync/push et app/api/sync/pull. Cf. Dev Notes Story 3.2 sur la répartition
// client/serveur du dossier sync/ (sync/client.ts, jamais importé ici, est son pendant client).

export async function pushQueueEntries(
  client: SupabaseClient,
  entries: SyncQueueEntry[],
): Promise<{ succeededIds: string[]; failedIds: string[] }> {
  // Groupe les entrées par (entity, entityId) : un seul upsert Postgres par entité concernée,
  // pas un par champ — le grain fin de la file locale ne coûte qu'en lignes IndexedDB, jamais
  // en aller-retours réseau (cf. Dev Notes Story 3.2).
  const groups = new Map<string, SyncQueueEntry[]>();
  for (const entry of entries) {
    const groupKey = `${entry.entity}:${entry.entityId}`;
    const group = groups.get(groupKey);
    if (group) {
      group.push(entry);
    } else {
      groups.set(groupKey, [entry]);
    }
  }

  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  // Les groupes "project" sont traités avant les groupes "task" du même lot : une tâche créée
  // hors ligne peut référencer un projet créé dans le même lot (project_id), et l'ordre
  // d'itération d'un Map (ordre d'insertion, pas garanti aligné sur l'ordre de création côté
  // client) ne suffit pas à le garantir — cf. Review Findings Story 3.2. Sans cet ordre, une
  // violation de clé étrangère peut survenir (auto-corrigée au cycle de retry suivant, mais
  // évitable). Une valeur `entity` non reconnue (payload corrompu) n'est jamais traitée comme
  // "task" par défaut — elle est marquée échouée sans aucune écriture Supabase.
  const projectGroups: SyncQueueEntry[][] = [];
  const taskGroups: SyncQueueEntry[][] = [];
  const noteGroups: SyncQueueEntry[][] = [];
  const documentGroups: SyncQueueEntry[][] = [];
  for (const group of groups.values()) {
    const { entity } = group[0];
    if (entity === "project") {
      projectGroups.push(group);
    } else if (entity === "task") {
      taskGroups.push(group);
    } else if (entity === "note") {
      noteGroups.push(group);
    } else if (entity === "document") {
      documentGroups.push(group);
    } else {
      failedIds.push(...group.map((entry) => entry.id));
    }
  }

  for (const group of [...projectGroups, ...taskGroups, ...noteGroups, ...documentGroups]) {
    const { entity, entityId } = group[0];
    const ids = group.map((entry) => entry.id);

    try {
      if (entity === "project") {
        const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
        await upsertProjectFields(client, entityId, fields);
      } else if (entity === "note") {
        // Groupe brut (pas aplati) : upsertNoteFields a désormais besoin de l'updatedAt par
        // champ pour peupler transcription_updated_at (AD-3, Story 5.3) — même raison
        // qu'upsertTaskFields depuis la Story 3.6.
        await upsertNoteFields(client, entityId, group);
      } else if (entity === "document") {
        // FR-21 : l'entrée de suppression prime sur tout champ (AD-3, cf. enqueueDelete,
        // data/local/sync-queue.ts) — le groupe ne contient normalement jamais plus d'une
        // entrée dans ce cas, mais cherchée explicitement plutôt que supposée en position 0
        // (revue de code, Story 6.3) : rend le routage robuste même si cette invariante
        // maintenue par convention ailleurs venait un jour à être violée.
        const deleteEntry = group.find((entry) => entry.operation === "delete");
        if (deleteEntry) {
          await deleteDocumentAndFile(client, entityId);
        } else {
          // Document n'a aucun champ conflict-tracké (AD-3 ne s'y applique pas, cf. Dev Notes
          // Story 6.1) — fields aplatis, même précédent que la branche "project" ci-dessus.
          const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
          await upsertDocumentFields(client, entityId, fields);
        }
      } else {
        // Groupe brut (pas aplati) : upsertTaskFields a besoin de l'updatedAt par champ
        // pour peupler status_updated_at/priority_updated_at (AD-3, Story 3.6).
        await upsertTaskFields(client, entityId, group);
      }
      succeededIds.push(...ids);
    } catch {
      // Un échec d'upsert pour une entité marque tous ses champs du groupe comme échoués —
      // le client réessaiera le lot entier au prochain cycle (cf. sync/client.ts markFailed).
      failedIds.push(...ids);
    }
  }

  return { succeededIds, failedIds };
}

export async function pullRemoteSnapshot(client: SupabaseClient) {
  return fetchAllProjectsTasksNotesAndDocuments(client);
}

export async function uploadNoteAudioBlob(
  client: SupabaseClient,
  userId: string,
  noteId: string,
  file: File,
): Promise<string> {
  return uploadNoteAudio(client, userId, noteId, file);
}

export async function uploadDocumentBlob(
  client: SupabaseClient,
  userId: string,
  documentId: string,
  file: File,
): Promise<string> {
  return uploadDocumentFile(client, userId, documentId, file);
}

// Suppression définitive d'un document (FR-21) — retire d'abord le fichier Storage (si un
// upload avait réussi), puis la ligne `documents`. Cet ordre rend l'opération idempotente
// en cas de retry après échec partiel : si la ligne existe encore au prochain essai,
// storage_path est relu et le retrait Storage retenté (naturellement idempotent, cf.
// removeDocumentFile) avant une nouvelle tentative de suppression de ligne ; si la ligne a
// déjà disparu (première tentative allée jusqu'au bout), storagePath vaut null et rien
// n'est retenté côté Storage.
export async function deleteDocumentAndFile(
  client: SupabaseClient,
  entityId: string,
): Promise<void> {
  const storagePath = await getDocumentStoragePath(client, entityId);
  if (storagePath) {
    await removeDocumentFile(client, storagePath);
  }
  await deleteDocumentRow(client, entityId);
}

// Même précédent que getNoteAudioPlaybackUrl ci-dessus (Story 5.2) : vérifie l'appartenance
// via une lecture RLS (client scopé session) avant de générer une URL signée — un document
// inexistant ou non possédé renvoie null plutôt que de lever, laissant la route handler
// répondre 404. Repli `|| "Document"` sur file_name (revue de code, Story 6.3) — cohérent
// avec le même repli déjà utilisé partout ailleurs dans l'UI (DocumentCard/DocumentDetail) :
// un file_name vide/absent transmis tel quel à createDocumentSignedUrl produirait une
// Content-Disposition malformée ou un nom de fichier téléchargé vide. Le corps de
// createDocumentSignedUrl est encapsulé (revue de code) : une erreur Supabase Storage lors
// de la génération de l'URL signée dégrade en 404 propre plutôt que de se propager non
// interceptée jusqu'au route handler (500 générique du framework), même position que le
// garde-fou déjà en place sur la lecture initiale.
export async function getDocumentDownloadUrl(
  client: SupabaseClient,
  documentId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data || !data.storage_path) {
    return null;
  }

  try {
    return await createDocumentSignedUrl(client, data.storage_path, data.file_name || "Document");
  } catch {
    return null;
  }
}

// Même précédent que getDocumentDownloadUrl ci-dessus, mais génère une URL d'APERÇU inline
// (pas de Content-Disposition: attachment) — consommée par <img>/<iframe> dans DocumentDetail,
// jamais pour déclencher un téléchargement. Garde de type MIME côté serveur (revue de code,
// Story 6.3) — `documentPreviewKind` (app/projects/[id]/project-view.tsx) ne restreint le
// rendu inline aux deux types image/PDF que côté client ; sans cette garde miroir ici,
// n'importe quel document pouvait être servi inline (sans Content-Disposition: attachment)
// via une navigation directe vers /api/documents/[id]/preview, contournant la restriction
// client et rouvrant le risque déjà connu du mimeType d'upload non validé (cf.
// data/remote/document-storage.ts createDocumentPreviewUrl, deferred-work.md "code review of
// story-6.1").
export async function getDocumentPreviewUrl(
  client: SupabaseClient,
  documentId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("documents")
    .select("storage_path, mime_type")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data || !data.storage_path) {
    return null;
  }

  const isPreviewable = data.mime_type.startsWith("image/") || data.mime_type === "application/pdf";
  if (!isPreviewable) {
    return null;
  }

  try {
    return await createDocumentPreviewUrl(client, data.storage_path);
  } catch {
    return null;
  }
}

// Vérifie que la note appartient bien à l'utilisateur courant via une lecture RLS (client
// scopé session, jamais le client à privilèges élevés) avant de générer une URL signée — une
// note inexistante ou sans audio_path renvoie null plutôt que de lever, laissant la route
// handler répondre 404 (cf. app/api/notes/[id]/audio/route.ts).
export async function getNoteAudioPlaybackUrl(
  client: SupabaseClient,
  noteId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notes")
    .select("audio_path")
    .eq("id", noteId)
    .maybeSingle();

  if (error || !data || !data.audio_path) {
    return null;
  }

  return createNoteAudioSignedUrl(client, data.audio_path);
}

// Wrapper fin, même précédent qu'uploadNoteAudioBlob ci-dessus (Story 5.2) : sync/server.ts
// reste le seul point d'entrée que les route handlers app/api/* importent pour atteindre
// data/remote/ (AD-2, AD-6) — jamais un import direct de data/remote/ depuis app/api/*.
export async function transcribeNoteAudio(file: Blob): Promise<string> {
  return transcribeAudio(file);
}
