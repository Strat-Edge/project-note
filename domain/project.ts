// domain/project.ts — entité Project et règles métier pures associées (FR-6 à FR-9).
// Ne dépend d'aucun autre module du projet (cf. AD-2) : les 8 couleurs de rotation sont
// représentées par des clés, pas par leurs valeurs hex (qui vivent en CSS, cf. app/globals.css).

// La couleur n'est plus affichée nulle part dans l'UI (retour Guillaume : "j'ai trop de
// projets, les couleurs se répètent, je n'en veux plus") — mais le champ reste écrit en
// interne (rotation automatique, cf. nextProjectColor) parce que la colonne Postgres
// `projects.color` est `not null` sans valeur par défaut (cf. migration SQL de la Story
// 3.2) : ne plus l'envoyer casserait la synchronisation de tout nouveau projet. Un jour où
// cette colonne sera retirée/rendue nullable côté Supabase (migration hors du périmètre de
// cette story, jamais exécutée automatiquement), ce type et cette rotation pourront être
// supprimés avec elle.
export type ProjectColorKey =
  | "project-1"
  | "project-2"
  | "project-3"
  | "project-4"
  | "project-5"
  | "project-6"
  | "project-7"
  | "project-8";

export const PROJECT_COLOR_ROTATION: readonly ProjectColorKey[] = [
  "project-1",
  "project-2",
  "project-3",
  "project-4",
  "project-5",
  "project-6",
  "project-7",
  "project-8",
];

export type ProjectStatus = "active" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: ProjectColorKey;
  status: ProjectStatus;
  createdAt: string;
}

// Rotation cyclique sur les 8 teintes — reçoit le nombre de projets déjà existants
// (calculé en amont, domain/ ne dépend d'aucune source de données).
export function nextProjectColor(existingCount: number): ProjectColorKey {
  const index = existingCount % PROJECT_COLOR_ROTATION.length;
  return PROJECT_COLOR_ROTATION[index];
}

// Un nom composé uniquement d'espaces est traité comme vide (AC#4).
export function validateProjectName(name: string): boolean {
  return name.trim().length > 0;
}

export interface ProjectsByStatus {
  active: Project[];
  archived: Project[];
}

// Actifs en premier, archivés regroupés (FR-7). Aucun ordre n'est imposé au sein d'un
// groupe par le PRD/l'UX — le plus récemment créé en tête est un choix pragmatique.
export function groupProjectsByStatus(
  projects: readonly Project[],
): ProjectsByStatus {
  const sorted = [...projects].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    active: sorted.filter((project) => project.status === "active"),
    archived: sorted.filter((project) => project.status === "archived"),
  };
}

// Transitions de statut pures (FR-8, FR-9). Aucun invariant supplémentaire ne les
// conditionne aujourd'hui (contrairement à validateProjectName) — leur rôle est de
// faire transiter la mutation par domain/, cf. Consistency Conventions.
export function archiveProject(project: Project): Project {
  return { ...project, status: "archived" };
}

export function unarchiveProject(project: Project): Project {
  return { ...project, status: "active" };
}

// Renommer/redécrire un projet existant, sans toucher à son contenu (tâches/notes/documents
// restent liés par id, jamais par nom) — retour Guillaume : "je ne peux pas modifier un
// projet qui a déjà été créé". `name` revalidé par l'appelant via validateProjectName (même
// convention que createProject/archiveProject : le domaine n'échoue jamais silencieusement
// sur une valeur déjà validée en amont).
export function updateProjectDetails(
  project: Project,
  name: string,
  description: string,
): Project {
  return { ...project, name: name.trim(), description: description.trim() };
}
