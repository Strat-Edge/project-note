// data/local/sync-queue.ts — file de synchronisation Dexie (FR-33 à FR-35).
// Dépend de domain/ (types) uniquement, cf. AD-2. Enveloppe et clé d'idempotence exactes de
// ARCHITECTURE-SPINE.md Consistency Conventions (cf. domain/sync.ts).
import type { Transaction } from "dexie";
import { db } from "./db";
import type { SyncEntity, SyncOperation, SyncQueueEntry } from "@/domain";
import { syncQueueEntryId, hasExhaustedRetries, DELETE_FIELD } from "@/domain";

export interface EnqueueFieldInput {
  entity: SyncEntity;
  entityId: string;
  field: string;
  operation: SyncOperation;
  value: unknown;
  // Requis (Story 3.6) — pas de `new Date()` interne : pour status/priority (Task), cet
  // horodatage doit être identique bit pour bit à celui stocké sur Task.*UpdatedAt, sans
  // quoi markTaskFieldsSynced (sync/client.ts) ne reconnaît jamais l'entrée comme
  // correspondant à la valeur locale courante et *SyncedAt ne s'actualise jamais (AD-3).
  // L'appelant doit calculer un seul `new Date().toISOString()` et le réutiliser partout
  // où le même événement d'écriture doit être daté à l'identique.
  updatedAt: string;
  deviceId: string;
}

// `put` (upsert), jamais `add` : une nouvelle modification du même champ avant sync doit
// remplacer l'entrée existante (valeur, updatedAt, status/attempts remis à zéro) plutôt que
// d'en empiler une seconde, conformément à la convention d'idempotence de la spine.
export async function enqueueField(
  input: EnqueueFieldInput,
  tx?: Transaction,
): Promise<void> {
  const entry: SyncQueueEntry = {
    id: syncQueueEntryId(input.entityId, input.field),
    entity: input.entity,
    entityId: input.entityId,
    field: input.field,
    operation: input.operation,
    value: input.value,
    updatedAt: input.updatedAt,
    syncedAt: null,
    deviceId: input.deviceId,
    status: "pending",
    attempts: 0,
  };

  const table = tx ? tx.table<SyncQueueEntry, string>("syncQueue") : db.syncQueue;
  await table.put(entry);
}

// Implémente la convention "create porte la valeur initiale de chaque champ — une entrée par
// champ, pas un instantané unique" : une entrée de file par clé de `fields`. `updatedAt`
// unique pour tout le lot (Story 3.6) — toutes les valeurs d'une même création partagent le
// même horodatage conceptuel, cf. EnqueueFieldInput.
export async function enqueueCreate(
  entity: SyncEntity,
  entityId: string,
  fields: Record<string, unknown>,
  deviceId: string,
  updatedAt: string,
  tx?: Transaction,
): Promise<void> {
  for (const [field, value] of Object.entries(fields)) {
    await enqueueField(
      { entity, entityId, field, operation: "create", value, deviceId, updatedAt },
      tx,
    );
  }
}

// AD-3 : "l'entrée de suppression prime sur toute entrée pending restante du même entity_id"
// (ARCHITECTURE-SPINE.md Consistency Conventions) — purge d'abord tout champ déjà en file
// pour cette entité (une création pas encore synchronisée, ou un champ modifié juste avant
// la suppression) avant d'ajouter l'unique entrée de suppression, jamais empilée à côté.
// `.where("entityId")` utilise l'index déjà déclaré sur syncQueue (data/local/db.ts,
// version 3) — aucune nouvelle version Dexie nécessaire. Premier appelant réel :
// deleteDocument (data/local/documents.ts, Story 6.3).
export async function enqueueDelete(
  entity: SyncEntity,
  entityId: string,
  deviceId: string,
  updatedAt: string,
  tx?: Transaction,
): Promise<void> {
  const table = tx ? tx.table<SyncQueueEntry, string>("syncQueue") : db.syncQueue;
  await table.where("entityId").equals(entityId).delete();
  await enqueueField(
    {
      entity,
      entityId,
      field: DELETE_FIELD,
      operation: "delete",
      value: null,
      deviceId,
      updatedAt,
    },
    tx,
  );
}

export async function listPendingAndError(): Promise<SyncQueueEntry[]> {
  return db.syncQueue.where("status").anyOf("pending", "error").toArray();
}

export async function markSyncing(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.syncQueue.where("id").anyOf(ids).modify({ status: "syncing" });
}

// `pushed` porte l'`updatedAt` capturé au moment où l'entrée a été envoyée (avant markSyncing) —
// nécessaire pour détecter une réédition du même champ pendant que l'envoi était en vol
// (cf. Review Findings Story 3.2) : `enqueueField` remplace l'entrée existante par une nouvelle
// valeur/updatedAt sous le même id ; sans cette vérification, marquer l'ancien envoi comme
// réussi/échoué supprimerait ou corromprait silencieusement la valeur plus récente jamais
// synchronisée.
type PushedEntry = Pick<SyncQueueEntry, "id" | "updatedAt">;

// Une fois poussée avec succès, une entrée de file n'a plus d'utilité pour cette story
// (pas de statut "synced" matérialisé, cf. Dev Notes Story 3.2) — suppression directe, mais
// seulement si l'entrée n'a pas été remplacée par une valeur plus récente entre-temps.
export async function markSucceeded(pushed: readonly PushedEntry[]): Promise<void> {
  if (pushed.length === 0) return;
  const updatedAtById = new Map(pushed.map((entry) => [entry.id, entry.updatedAt]));
  await db.syncQueue
    .where("id")
    .anyOf(pushed.map((entry) => entry.id))
    .filter((current) => updatedAtById.get(current.id) === current.updatedAt)
    .delete();
}

export async function markFailed(pushed: readonly PushedEntry[]): Promise<void> {
  if (pushed.length === 0) return;
  const updatedAtById = new Map(pushed.map((entry) => [entry.id, entry.updatedAt]));
  await db.syncQueue
    .where("id")
    .anyOf(pushed.map((entry) => entry.id))
    .modify((entry) => {
      if (updatedAtById.get(entry.id) !== entry.updatedAt) {
        // Remplacée par une édition plus récente pendant l'envoi — ne pas incrémenter ses
        // tentatives, la nouvelle entrée est déjà "pending"/attempts:0 fraîche (cf. enqueueField).
        return;
      }
      entry.attempts += 1;
      entry.status = hasExhaustedRetries(entry) ? "error" : "pending";
    });
}

// Utilisé par le réessai manuel (tap sur l'indicateur en état "Non synchronisé").
export async function resetErrorsToPending(): Promise<void> {
  await db.syncQueue
    .where("status")
    .equals("error")
    .modify({ status: "pending", attempts: 0 });
}

// "syncing" est un état transitoire censé durer le temps d'une requête réseau — il ne doit
// jamais survivre à un rechargement de page. Si l'utilisateur ferme l'onglet/rafraîchit
// pendant qu'une entrée est "syncing", elle resterait bloquée indéfiniment (listPendingAndError
// ne regarde que "pending"/"error") sans ce rattrapage. Appelé une fois au démarrage du moteur
// (cf. sync/client.ts startSyncEngine) — trouvé lors de la vérification manuelle de la Story 3.2
// (Fast Refresh en dev a interrompu un push en cours, entrées restées "syncing" pour toujours).
export async function resetStaleSyncingToPending(): Promise<void> {
  await db.syncQueue
    .where("status")
    .equals("syncing")
    .modify({ status: "pending" });
}
