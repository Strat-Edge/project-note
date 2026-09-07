// data/local/projects.ts — lecture/écriture Dexie pour Project (FR-6, FR-7).
// Dépend de domain/ (types) uniquement, cf. AD-2. Aucune écriture Supabase ici : le moteur de
// synchronisation (sync/) n'existe qu'à partir de l'Epic 3 — cf. Dev Notes de la Story 2.1.
import { db } from "./db";
import type { Project, ProjectColorKey } from "@/domain";
import {
  nextProjectColor,
  validateProjectName,
  archiveProject as toArchivedProject,
  unarchiveProject as toActiveProject,
  updateProjectDetails,
} from "@/domain";
import { enqueueCreate, enqueueField, enqueueDelete } from "./sync-queue";
import { getDeviceId } from "@/lib/device";

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: ProjectColorKey;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  // Revalidé ici (pas seulement côté UI) : un appelant qui contournerait le formulaire
  // ne doit pas pouvoir persister un projet à nom vide.
  if (!validateProjectName(input.name)) {
    throw new Error("Le nom du projet est obligatoire.");
  }

  // Transaction : count() + add() doivent être atomiques, sinon deux créations
  // quasi simultanées peuvent lire le même compte et se voir assigner la même couleur.
  // Story 3.2 : élargie à syncQueue pour que l'écriture et la mise en file soient atomiques.
  return db.transaction("rw", db.projects, db.syncQueue, async (tx) => {
    const existingCount = await db.projects.count();
    const now = new Date().toISOString();

    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      color: input.color ?? nextProjectColor(existingCount),
      status: "active",
      createdAt: now,
    };

    await db.projects.add(project);
    await enqueueCreate(
      "project",
      project.id,
      {
        name: project.name,
        description: project.description,
        color: project.color,
        status: project.status,
        createdAt: project.createdAt,
      },
      getDeviceId(),
      now,
      tx,
    );
    return project;
  });
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.toArray();
}

// Vue projet (Story 3.3) — undefined (pas d'exception) si l'id ne correspond à rien :
// l'appelant distingue "projet introuvable" d'une erreur technique.
export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

async function getProjectOrThrow(id: string): Promise<Project> {
  const project = await db.projects.get(id);
  if (!project) {
    throw new Error("Projet introuvable.");
  }
  return project;
}

export async function archiveProject(id: string): Promise<void> {
  return db.transaction("rw", db.projects, db.syncQueue, async (tx) => {
    const project = await getProjectOrThrow(id);
    const archived = toArchivedProject(project);
    await db.projects.put(archived);
    await enqueueField(
      {
        entity: "project",
        entityId: id,
        field: "status",
        operation: "update",
        value: archived.status,
        deviceId: getDeviceId(),
        updatedAt: new Date().toISOString(),
      },
      tx,
    );
  });
}

export async function unarchiveProject(id: string): Promise<void> {
  return db.transaction("rw", db.projects, db.syncQueue, async (tx) => {
    const project = await getProjectOrThrow(id);
    const activated = toActiveProject(project);
    await db.projects.put(activated);
    await enqueueField(
      {
        entity: "project",
        entityId: id,
        field: "status",
        operation: "update",
        value: activated.status,
        deviceId: getDeviceId(),
        updatedAt: new Date().toISOString(),
      },
      tx,
    );
  });
}

export interface UpdateProjectInput {
  name: string;
  description?: string;
}

// Renommer/redécrire un projet existant (retour Guillaume : aucun moyen de corriger le nom
// d'un projet déjà créé). N'affecte jamais color/status/createdAt ni le contenu du projet
// (tâches/notes/documents restent liés par id) — même portée que archiveProject/
// unarchiveProject, un seul champ métier à la fois.
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  // Revalidé ici (pas seulement côté UI), même précédent que createProject.
  if (!validateProjectName(input.name)) {
    throw new Error("Le nom du projet est obligatoire.");
  }

  return db.transaction("rw", db.projects, db.syncQueue, async (tx) => {
    const project = await getProjectOrThrow(id);
    const now = new Date().toISOString();
    const updated = updateProjectDetails(project, input.name, input.description ?? "");
    await db.projects.put(updated);
    await enqueueField(
      {
        entity: "project",
        entityId: id,
        field: "name",
        operation: "update",
        value: updated.name,
        deviceId: getDeviceId(),
        updatedAt: now,
      },
      tx,
    );
    await enqueueField(
      {
        entity: "project",
        entityId: id,
        field: "description",
        operation: "update",
        value: updated.description,
        deviceId: getDeviceId(),
        updatedAt: now,
      },
      tx,
    );
    return updated;
  });
}

// Suppression définitive (retour Guillaume : depuis l'onglet Archives, pouvoir supprimer un
// projet pour de bon) — rompt délibérément le principe "rien n'est supprimé" observé jusqu'ici
// par le reste de l'app (cf. Dev Notes Story 5.1 : "aucune suppression de projet n'existe dans
// l'app, archivage seulement"), sur demande explicite et seulement depuis l'état archivé —
// jamais un projet actif, revalidé ici (pas seulement côté UI) plutôt que de faire confiance
// au seul bouton conditionnel de projects-screen.tsx. Écriture optimiste immédiate en local
// (AD-1, même position que deleteDocument, Story 6.3) : les tâches du projet deviennent
// générales (projectId: null, même règle SQL que tasks.project_id "on delete set null", cf.
// migration Story 3.2) plutôt que supprimées — seuls notes/documents, qui exigent tous deux un
// projet (FR-2), disparaissent avec lui (mêmes migrations : "on delete cascade"). Chaque
// note/document supprimé passe par enqueueDelete individuellement (pas une suppression en
// cascade silencieuse côté sync) : sync/server.ts s'en sert pour aussi nettoyer leurs fichiers
// Supabase Storage (audio/documents) avant que la ligne Postgres ne disparaisse via la
// suppression du projet — cf. Dev Notes sync/server.ts sur l'ordre de poussée enfants-puis-parent.
export async function deleteProject(id: string): Promise<void> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  // Forme tableau (pas les surcharges à table individuelle, plafonnées à 5 par les types
  // Dexie) : nécessaire dès que la transaction touche plus de 5 tables, comme ici.
  await db.transaction(
    "rw",
    [
      db.projects,
      db.tasks,
      db.notes,
      db.noteAudio,
      db.pendingTranscriptions,
      db.documents,
      db.documentFiles,
      db.syncQueue,
    ],
    async (tx) => {
      const project = await getProjectOrThrow(id);
      if (project.status !== "archived") {
        throw new Error("Seul un projet archivé peut être supprimé définitivement.");
      }

      const orphanedTaskIds = (await tx
        .table("tasks")
        .where("projectId")
        .equals(id)
        .primaryKeys()) as string[];
      await tx.table("tasks").where("projectId").equals(id).modify({ projectId: null });
      for (const taskId of orphanedTaskIds) {
        await enqueueField(
          {
            entity: "task",
            entityId: taskId,
            field: "projectId",
            operation: "update",
            value: null,
            deviceId,
            updatedAt: now,
          },
          tx,
        );
      }

      const noteIds = (await tx
        .table("notes")
        .where("projectId")
        .equals(id)
        .primaryKeys()) as string[];
      await tx.table("notes").where("projectId").equals(id).delete();
      for (const noteId of noteIds) {
        await tx.table("noteAudio").delete(noteId);
        await tx.table("pendingTranscriptions").delete(noteId);
        await enqueueDelete("note", noteId, deviceId, now, tx);
      }

      const documentIds = (await tx
        .table("documents")
        .where("projectId")
        .equals(id)
        .primaryKeys()) as string[];
      await tx.table("documents").where("projectId").equals(id).delete();
      for (const documentId of documentIds) {
        await tx.table("documentFiles").delete(documentId);
        await enqueueDelete("document", documentId, deviceId, now, tx);
      }

      await tx.table("projects").delete(id);
      await enqueueDelete("project", id, deviceId, now, tx);
    },
  );
}
