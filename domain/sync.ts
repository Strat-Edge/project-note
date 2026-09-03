// domain/sync.ts — entité SyncQueueEntry et règles pures de la file de synchronisation (FR-33 à FR-35).
// Ne dépend d'aucun autre module du projet (cf. AD-2). Forme exacte de l'enveloppe imposée par
// ARCHITECTURE-SPINE.md Consistency Conventions — ne pas dévier des noms de champs ci-dessous.

export type SyncEntity = "project" | "task" | "note" | "document";
export type SyncOperation = "create" | "update" | "delete";

// Les 5 valeurs de l'enveloppe ARCHITECTURE-SPINE.md sont conservées ici pour rester fidèle à la
// spec, même si cette story (3.2) ne produit jamais "synced" (entrée supprimée à la place, cf.
// data/local/sync-queue.ts markSucceeded) ni "conflict" (périmètre réel de la Story 3.6).
export type SyncStatus = "pending" | "syncing" | "synced" | "conflict" | "error";

export interface SyncQueueEntry {
  id: string; // `${entityId}:${field}` — clé d'idempotence, cf. syncQueueEntryId
  entity: SyncEntity;
  entityId: string;
  field: string;
  operation: SyncOperation;
  value: unknown;
  updatedAt: string; // ISO 8601 UTC
  syncedAt: string | null; // ISO 8601 UTC
  deviceId: string;
  status: SyncStatus;
  attempts: number; // ajout local hors enveloppe stricte, nécessaire pour AC#4 (cf. Dev Notes Story 3.2)
}

// Clé d'idempotence exacte de la convention : un même champ en attente n'a qu'une seule entrée.
export function syncQueueEntryId(entityId: string, field: string): string {
  return `${entityId}:${field}`;
}

// Valeur exacte de la convention pour une entrée de suppression (ARCHITECTURE-SPINE.md
// Consistency Conventions). Premier producteur réel : deleteDocument (data/local/documents.ts,
// Story 6.3, FR-21) — la constante existait depuis la Story 3.2 mais n'avait jamais été
// produite jusqu'ici.
export const DELETE_FIELD = "__record__";

// Seuil non spécifié ailleurs (PRD/Architecture) — valeur raisonnable choisie ici (cf. Dev Notes Story 3.2).
export const MAX_SYNC_ATTEMPTS = 3;

export function hasExhaustedRetries(
  entry: Pick<SyncQueueEntry, "attempts">,
): boolean {
  return entry.attempts >= MAX_SYNC_ATTEMPTS;
}

// Résolution de conflit au niveau du champ (AD-3). Réutilisable pour tout champ éditable
// après création sur les trois types capturables — aujourd'hui Task.status/priority
// uniquement (cf. Capability Map 4.3), Note.transcription s'y ajoutera en Epic 5.
export interface FieldConflict<T> {
  local: T;
  remote: T;
}

export type FieldSyncDecision =
  | "noop" // valeurs déjà identiques, rien à faire
  | "adopt-remote" // seul le distant a changé depuis le dernier point de synchro connu
  | "keep-local" // seul le local a changé — le push en file s'en charge, pull n'y touche pas
  | "conflict"; // les deux ont changé depuis le dernier point de synchro connu — arbitrage requis

// Algorithme exact d'AD-3 : "si seul le local a changé depuis <champ>_synced_at -> push.
// Si seul le distant a changé -> pull. Si les deux ont changé -> conflit réel, jamais résolu
// par simple comparaison d'horodatage entre les deux valeurs." Comparaison sur des chaînes
// ISO 8601 UTC de même format (>, <=) — valide lexicographiquement, même précédent que
// sortTasksChronologically (domain/task.ts) qui compare aussi des ISO 8601 en chaîne.
// localSyncedAt === null (jamais synchronisé) traité comme "les deux ont changé" par
// défaut : ne peut normalement plus se produire une fois cette story livrée (le pull en
// insertion et le succès de push renseignent désormais toujours *SyncedAt, cf. sync/client.ts),
// mais reste la position sûre pour tout enregistrement local antérieur à cette story
// (jamais d'écrasement silencieux, même dans le doute — c'est tout l'esprit d'AD-3).
export function resolveFieldSync<T>(
  localValue: T,
  localUpdatedAt: string,
  localSyncedAt: string | null,
  remoteValue: T,
  remoteUpdatedAt: string,
): FieldSyncDecision {
  if (localValue === remoteValue) {
    return "noop";
  }
  const localChanged = localSyncedAt === null || localUpdatedAt > localSyncedAt;
  const remoteChanged = localSyncedAt === null || remoteUpdatedAt > localSyncedAt;
  if (localChanged && remoteChanged) {
    return "conflict";
  }
  return remoteChanged ? "adopt-remote" : "keep-local";
}
