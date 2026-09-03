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
} from "@/domain";
import { enqueueCreate, enqueueField } from "./sync-queue";
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
