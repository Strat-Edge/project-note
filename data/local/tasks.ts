// data/local/tasks.ts — lecture/écriture Dexie pour Task (FR-10, capture du type "Tâche").
// Dépend de domain/ (types) uniquement, cf. AD-2. Aucune écriture Supabase ici : le moteur de
// synchronisation (sync/) n'existe qu'à partir de la Story 3.2 — cf. Dev Notes de la Story 3.1.
import { db } from "./db";
import type { Task, Priority, Provenance, TaskStatus } from "@/domain";
import {
  validateTaskTitle,
  canSetReminder,
  openTask,
  setTaskStatus,
  setTaskPriority,
} from "@/domain";
import { enqueueCreate, enqueueField } from "./sync-queue";
import { getDeviceId } from "@/lib/device";

export interface CreateTaskInput {
  projectId: string | null;
  title: string;
  description?: string;
  dueDate?: string | null; // ISO 8601 UTC, déjà converti par l'appelant (cf. capture-flow.tsx)
  reminderAt?: string | null; // ISO 8601 UTC, déjà converti par l'appelant
  priority: Priority;
  provenance: Provenance;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  // Revalidé ici (pas seulement côté UI) : un appelant qui contournerait le formulaire
  // ne doit pas pouvoir persister une tâche sans titre.
  if (!validateTaskTitle(input.title)) {
    throw new Error("Le titre de la tâche est obligatoire.");
  }

  const dueDate = input.dueDate?.trim() || null;
  const reminderAt = input.reminderAt?.trim() || null;

  if (reminderAt && !canSetReminder(dueDate)) {
    throw new Error("Un rappel nécessite une échéance.");
  }

  // Un seul horodatage pour tout l'événement de création (Story 3.6) — évite trois
  // `new Date()` légèrement différents pour createdAt/statusUpdatedAt/priorityUpdatedAt.
  const now = new Date().toISOString();

  const task: Task = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    dueDate,
    reminderAt,
    priority: input.priority,
    status: "todo",
    provenance: input.provenance,
    isNew: true,
    createdAt: now,
    // Un champ tout juste créé n'a par définition encore jamais divergé, mais n'a pas non
    // plus été confirmé synchronisé (AD-3, Story 3.6) — statusSyncedAt/prioritySyncedAt
    // restent null jusqu'au premier push réussi (cf. sync/client.ts markTaskFieldsSynced).
    statusUpdatedAt: now,
    statusSyncedAt: null,
    statusConflict: null,
    priorityUpdatedAt: now,
    prioritySyncedAt: null,
    priorityConflict: null,
  };

  // Transaction (Story 3.2) : l'écriture de la tâche et sa mise en file de synchronisation
  // doivent être atomiques — une tâche écrite sans être mise en file ne serait jamais
  // synchronisée. Story 3.1 n'avait pas besoin de transaction ici, ce n'est plus vrai.
  await db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
    await db.tasks.add(task);
    await enqueueCreate(
      "task",
      task.id,
      {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        reminderAt: task.reminderAt,
        priority: task.priority,
        status: task.status,
        provenance: task.provenance,
        isNew: task.isNew,
        createdAt: task.createdAt,
      },
      getDeviceId(),
      now,
      tx,
    );
  });

  return task;
}

// Vue projet (Story 3.3) — n'inclut jamais les tâches générales (projectId: null),
// atteinte uniquement depuis un projet réel. Utilise l'index projectId (version 2).
export async function listTasksByProject(projectId: string): Promise<Task[]> {
  return db.tasks.where("projectId").equals(projectId).toArray();
}

// Écran Général (Story 4.1) — toutes les tâches, tous projets confondus, y compris les
// tâches générales (projectId: null, FR-2). Scan complet plutôt qu'une requête Dexie
// filtrée sur l'index `dueDate` (`.where("dueDate").notEqual(null)`) : IndexedDB ne
// garantit pas un tri/filtre fiable entre `null` et des chaînes sur un même index, et le
// filtrage réel (tâches AVEC échéance) est de toute façon délégué à domain/
// (tasksWithDueDate, Capability Map 4.7 — "agrégation en lecture"). Taille de table
// compatible avec un scan complet (outil interne solo, même précédent que listProjects()).
export async function listAllTasks(): Promise<Task[]> {
  return db.tasks.toArray();
}

async function getTaskOrThrow(id: string): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) {
    throw new Error("Tâche introuvable.");
  }
  return task;
}

// FR-25 : marque une tâche comme consultée (le badge "nouveau" disparaît). Court-circuit
// idempotent si déjà ouverte — évite une entrée de file de synchronisation inutile.
export async function markTaskOpened(id: string): Promise<Task> {
  return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
    const existing = await getTaskOrThrow(id);
    if (!existing.isNew) {
      return existing;
    }

    const opened = openTask(existing);
    await db.tasks.put(opened);
    await enqueueField(
      {
        entity: "task",
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

// FR-13 : changement de statut manuel (Story 3.5). Court-circuit idempotent si déjà à ce
// statut ET aucun conflit en attente — même précédent que markTaskOpened, évite une entrée
// de file inutile (retaper le segment déjà actif ne doit rien déclencher, cf. EXPERIENCE.md
// "pas de cycle forcé"). La garde sur statusConflict (Story 3.6) est ce qui permet de
// réutiliser cette même fonction comme point d'entrée de résolution de conflit depuis
// ConflictBanner : choisir la valeur déjà affichée localement doit quand même effacer le
// conflit et repousser la valeur pour trancher côté serveur, jamais un no-op silencieux.
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
    const existing = await getTaskOrThrow(id);
    if (existing.status === status && existing.statusConflict === null) {
      return existing;
    }

    // Même horodatage pour Task.statusUpdatedAt et l'entrée de file (Story 3.6) — sans ça,
    // markTaskFieldsSynced (sync/client.ts) ne peut jamais faire correspondre les deux au
    // succès du push, cf. Dev Notes.
    const now = new Date().toISOString();
    const updated = setTaskStatus(existing, status, now);
    await db.tasks.put(updated);
    await enqueueField(
      {
        entity: "task",
        entityId: id,
        field: "status",
        operation: "update",
        value: updated.status,
        deviceId: getDeviceId(),
        updatedAt: now,
      },
      tx,
    );
    return updated;
  });
}

// FR-14 : priorité modifiable après coup depuis le détail (Story 3.5). Même court-circuit
// idempotent (étendu au conflit, Story 3.6) que updateTaskStatus.
export async function updateTaskPriority(id: string, priority: Priority): Promise<Task> {
  return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
    const existing = await getTaskOrThrow(id);
    if (existing.priority === priority && existing.priorityConflict === null) {
      return existing;
    }

    // Même rationale que updateTaskStatus ci-dessus.
    const now = new Date().toISOString();
    const updated = setTaskPriority(existing, priority, now);
    await db.tasks.put(updated);
    await enqueueField(
      {
        entity: "task",
        entityId: id,
        field: "priority",
        operation: "update",
        value: updated.priority,
        deviceId: getDeviceId(),
        updatedAt: now,
      },
      tx,
    );
    return updated;
  });
}
