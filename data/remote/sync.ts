import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncQueueEntry } from "@/domain";

// data/remote/sync.ts — lecture/écriture Supabase pour les tables projects/tasks/notes/documents
// (FR-33 à FR-35, notes étendues en Story 5.1, documents ajoutés en Story 6.1,
// téléchargement/suppression de documents en Story 6.3 — FR-20/FR-21).
// Garde "server-only" (AD-2, AD-6) : ce module ne doit jamais atteindre le bundle client, même
// transitivement — cf. data/remote/client.ts pour la portée exacte de cette garde.
// Le client Supabase reçu en paramètre est toujours celui scopé à la session utilisateur
// (createSupabaseServerClient(), cookies de la requête) — jamais le client à privilèges élevés :
// RLS doit s'appliquer normalement, user_id est rempli côté Postgres par `default auth.uid()`
// (cf. migration SQL de la Story 3.2), jamais fourni par l'appelant.

// Colonnes snake_case, miroir exact des tables Postgres — jamais réexportées au-delà de ce
// fichier et de sync/server.ts (cf. Dev Notes Story 3.2 : sync/client.ts ne doit jamais les
// importer, même en `import type`, pour ne pas créer de dépendance de module vers un fichier
// gardé "server-only").
interface RemoteProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  created_at: string;
}

interface RemoteTaskRow {
  id: string;
  user_id: string;
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

interface RemoteNoteRow {
  id: string;
  user_id: string;
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

interface RemoteDocumentRow {
  id: string;
  user_id: string;
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

// Mapping explicite champ par champ (pas de conversion générique camelCase -> snake_case) :
// plus lisible, sans piège sur les cas non triviaux (isNew -> is_new).
function projectFieldsToColumns(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ("name" in fields) columns.name = fields.name;
  if ("description" in fields) columns.description = fields.description;
  if ("color" in fields) columns.color = fields.color;
  if ("status" in fields) columns.status = fields.status;
  if ("createdAt" in fields) columns.created_at = fields.createdAt;
  return columns;
}

function taskFieldsToColumns(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ("projectId" in fields) columns.project_id = fields.projectId;
  if ("title" in fields) columns.title = fields.title;
  if ("description" in fields) columns.description = fields.description;
  if ("dueDate" in fields) columns.due_date = fields.dueDate;
  if ("reminderAt" in fields) columns.reminder_at = fields.reminderAt;
  if ("priority" in fields) columns.priority = fields.priority;
  if ("status" in fields) columns.status = fields.status;
  if ("provenance" in fields) columns.provenance = fields.provenance;
  if ("isNew" in fields) columns.is_new = fields.isNew;
  if ("createdAt" in fields) columns.created_at = fields.createdAt;
  return columns;
}

function noteFieldsToColumns(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ("projectId" in fields) columns.project_id = fields.projectId;
  if ("type" in fields) columns.type = fields.type;
  if ("content" in fields) columns.content = fields.content;
  if ("audioPath" in fields) columns.audio_path = fields.audioPath;
  if ("transcription" in fields) columns.transcription = fields.transcription;
  if ("priority" in fields) columns.priority = fields.priority;
  if ("provenance" in fields) columns.provenance = fields.provenance;
  if ("isNew" in fields) columns.is_new = fields.isNew;
  if ("createdAt" in fields) columns.created_at = fields.createdAt;
  return columns;
}

function documentFieldsToColumns(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ("projectId" in fields) columns.project_id = fields.projectId;
  if ("fileName" in fields) columns.file_name = fields.fileName;
  if ("mimeType" in fields) columns.mime_type = fields.mimeType;
  if ("sizeBytes" in fields) columns.size_bytes = fields.sizeBytes;
  if ("storagePath" in fields) columns.storage_path = fields.storagePath;
  if ("priority" in fields) columns.priority = fields.priority;
  if ("provenance" in fields) columns.provenance = fields.provenance;
  if ("isNew" in fields) columns.is_new = fields.isNew;
  if ("createdAt" in fields) columns.created_at = fields.createdAt;
  return columns;
}

// UPDATE ne touche que les colonnes fournies — contrairement à upsert(), qui construit une
// ligne INSERT candidate et échoue sur une contrainte NOT NULL des colonnes omises même quand
// la ligne existe déjà et que seul le chemin ON CONFLICT DO UPDATE s'applique in fine
// (comportement Postgres documenté : la validation NOT NULL a lieu à la construction de la
// ligne candidate, avant la résolution du conflit). Découvert en vérification manuelle Story
// 3.3 : une mise à jour du seul champ isNew (markTaskOpened) sur une tâche déjà entièrement
// synchronisée échouait silencieusement en boucle (indicateur "Non synchronisé"). UPDATE
// affecte 0 ligne (sans erreur) si l'entité n'existe pas encore côté serveur — dans ce cas on
// retombe sur upsert(), qui ne reçoit alors un ensemble de champs incomplet que si l'entité
// entière n'a jamais été synchronisée, ce que enqueueCreate garantit en mettant tous les champs
// obligatoires en file d'un coup (cf. ARCHITECTURE-SPINE.md Consistency Conventions).
async function updateThenUpsert(
  client: SupabaseClient,
  table: "projects" | "tasks" | "notes" | "documents",
  entityId: string,
  columns: Record<string, unknown>,
): Promise<void> {
  const { data: updated, error: updateError } = await client
    .from(table)
    .update(columns)
    .eq("id", entityId)
    .select("id");

  if (updateError) {
    throw updateError;
  }

  if (updated && updated.length > 0) {
    return;
  }

  const { error: upsertError } = await client
    .from(table)
    .upsert({ id: entityId, ...columns }, { onConflict: "id" });

  if (upsertError) {
    throw upsertError;
  }
}

export async function upsertProjectFields(
  client: SupabaseClient,
  entityId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await updateThenUpsert(
    client,
    "projects",
    entityId,
    projectFieldsToColumns(fields),
  );
}

// Reçoit les entrées de file brutes du groupe (pas seulement le dictionnaire de valeurs
// aplati) — c'est le seul moyen d'accéder à l'updatedAt par champ à ce niveau, nécessaire
// pour peupler status_updated_at/priority_updated_at (AD-3, Story 3.6). upsertProjectFields
// garde sa signature d'origine : Project n'a aucun champ dans le périmètre de conflit de
// cette story (cf. Dev Notes de la story — les binds d'AD-3 ne citent jamais Project).
export async function upsertTaskFields(
  client: SupabaseClient,
  entityId: string,
  entries: readonly Pick<SyncQueueEntry, "field" | "value" | "updatedAt">[],
): Promise<void> {
  const fields = Object.fromEntries(entries.map((entry) => [entry.field, entry.value]));
  const columns = taskFieldsToColumns(fields);
  for (const entry of entries) {
    if (entry.field === "status") columns.status_updated_at = entry.updatedAt;
    if (entry.field === "priority") columns.priority_updated_at = entry.updatedAt;
  }
  await updateThenUpsert(client, "tasks", entityId, columns);
}

// Reçoit désormais les entrées de file brutes du groupe (pas seulement le dictionnaire de
// valeurs aplati) — même changement qu'upsertTaskFields (Story 3.6), nécessaire pour peupler
// transcription_updated_at (AD-3, Story 5.3). Note a désormais un champ dans le périmètre
// de conflit d'AD-3 (transcription), contrairement à l'état de cette fonction avant cette story.
export async function upsertNoteFields(
  client: SupabaseClient,
  entityId: string,
  entries: readonly Pick<SyncQueueEntry, "field" | "value" | "updatedAt">[],
): Promise<void> {
  const fields = Object.fromEntries(entries.map((entry) => [entry.field, entry.value]));
  const columns = noteFieldsToColumns(fields);
  for (const entry of entries) {
    if (entry.field === "transcription") columns.transcription_updated_at = entry.updatedAt;
  }
  await updateThenUpsert(client, "notes", entityId, columns);
}

// Document n'a aucun champ dans le périmètre de conflit d'AD-3 (cf. Dev Notes) — signature à
// fields aplatis, même précédent qu'upsertProjectFields.
export async function upsertDocumentFields(
  client: SupabaseClient,
  entityId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await updateThenUpsert(client, "documents", entityId, documentFieldsToColumns(fields));
}

// Quatre `select("*")` sans filtre supplémentaire (RLS restreint déjà à auth.uid()) — jeu de
// données solo-utilisateur, un simple "tout récupérer" suffit pour le pull en insertion seule
// de cette story (cf. Dev Notes Story 3.2, étendu à notes en Story 5.1, à documents en Story 6.1).
export async function fetchAllProjectsTasksNotesAndDocuments(client: SupabaseClient): Promise<{
  projects: RemoteProjectRow[];
  tasks: RemoteTaskRow[];
  notes: RemoteNoteRow[];
  documents: RemoteDocumentRow[];
}> {
  const [projectsResult, tasksResult, notesResult, documentsResult] = await Promise.all([
    client.from("projects").select("*"),
    client.from("tasks").select("*"),
    client.from("notes").select("*"),
    client.from("documents").select("*"),
  ]);

  if (projectsResult.error) {
    throw projectsResult.error;
  }
  if (tasksResult.error) {
    throw tasksResult.error;
  }
  if (notesResult.error) {
    throw notesResult.error;
  }
  if (documentsResult.error) {
    throw documentsResult.error;
  }

  return {
    projects: (projectsResult.data ?? []) as RemoteProjectRow[],
    tasks: (tasksResult.data ?? []) as RemoteTaskRow[],
    notes: (notesResult.data ?? []) as RemoteNoteRow[],
    documents: (documentsResult.data ?? []) as RemoteDocumentRow[],
  };
}

// Lit le storage_path courant d'un document (RLS "documents_owner" restreint déjà à
// auth.uid() via le client scopé session) — null si la ligne n'existe VRAIMENT pas (déjà
// supprimée, ou jamais synchronisée depuis cet appareil) ou si storage_path est encore null
// (upload jamais terminé, cf. AC#3/AC#4 Story 6.1). Une erreur de lecture (réseau/Postgres
// transitoire), elle, est levée plutôt que traitée comme "absente" (revue de code, Story
// 6.3) : la confondre avec une absence réelle ferait sauter le retrait Storage dans
// deleteDocumentAndFile tout en laissant la suppression de la ligne se poursuivre —
// orphelinant le fichier Storage de façon permanente sous ce mode d'échec précis. Étape
// séparée de deleteDocumentRow ci-dessous : sync/server.ts a besoin du chemin AVANT de
// supprimer la ligne, pour pouvoir aussi retirer le fichier Supabase Storage (AD-5, AD-8) —
// même ordre "lecture puis action" que getNoteAudioPlaybackUrl (sync/server.ts, Story 5.2).
export async function getDocumentStoragePath(
  client: SupabaseClient,
  entityId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("documents")
    .select("storage_path")
    .eq("id", entityId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return data.storage_path;
}

// Supprime la ligne `documents` (FR-21) — RLS ("documents_owner", policy `for all`, Story
// 6.1) restreint déjà la portée à l'utilisateur courant. 0 ligne affectée (document déjà
// supprimé, ou jamais synchronisé depuis cet appareil) n'est pas une erreur — idempotent
// par construction, même position qu'updateThenUpsert face à un UPDATE à 0 ligne (cf. Dev
// Notes Story 3.3).
export async function deleteDocumentRow(
  client: SupabaseClient,
  entityId: string,
): Promise<void> {
  const { error } = await client.from("documents").delete().eq("id", entityId);
  if (error) {
    throw error;
  }
}
