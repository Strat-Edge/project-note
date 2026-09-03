---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 6.1: Ajout d'un document

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want attacher un fichier à un projet depuis le flux "+",
so that mes documents et photos liés à un projet soient centralisés au même endroit.

## Acceptance Criteria

1. **Given** l'étape Type du flux "+" **When** je choisis "Document" et sélectionne un fichier (sélecteur desktop, ou caméra/galerie mobile) **Then** le fichier est ajouté au projet choisi, avec nom/type/taille enregistrés automatiquement
2. **Given** un fichier de plus de 20 Mo **When** je tente de l'ajouter **Then** l'ajout est refusé avec un message explicite (limite de taille)
3. **Given** aucune connexion réseau **When** j'ajoute un document **Then** il est stocké localement (blob Dexie) jusqu'à upload réussi vers Supabase Storage
4. **Given** un upload interrompu par une coupure réseau **When** la connexion revient **Then** l'upload reprend depuis le dernier point réussi, sans repartir de zéro

## Scope boundary (important)

Cette story couvre **uniquement l'ajout** (FR-18). La liste/consultation des documents d'un projet (FR-19, onglet Documents) est **Story 6.2**, explicitement séparée dans `epics.md` — contrairement à Note (Story 5.1), qui a livré création ET affichage dans la même story. **Ne pas construire `DocumentCard`/`DocumentDetail` ni modifier l'onglet Documents de `app/projects/[id]/project-view.tsx` dans cette story** — il reste "Bientôt disponible." tel quel (aucun changement à ce fichier). La vérification de l'AC#1 se fait par inspection directe de Dexie (IndexedDB, tables `documents`/`documentFiles`) et de Supabase (table `public.documents`, bucket Storage `documents`), pas par l'UI — cf. Testing Standards.

## Tasks / Subtasks

- [x] Task 1: `domain/document.ts` — nouvelle entité `Document` + validation de taille (AC: #1, #2)
  - [x] Créer `domain/document.ts` :
    ```ts
    // domain/document.ts — entité Document et validations pures associées (FR-18, Story 6.1).
    // FR-19 à FR-21 (liste, téléchargement, suppression) viennent en Story 6.2/6.3 — cette story
    // ne couvre que l'ajout. Ne dépend d'aucun module HORS domain/ (cf. AD-2) — importe Priority
    // (./capture) et Provenance (./task), même précédent que Note (domain/note.ts).
    import type { Priority } from "./capture";
    import type { Provenance } from "./task";

    export interface Document {
      id: string;
      projectId: string; // jamais null : FR-2 exige un projet pour un Document, même règle que Note
      fileName: string; // nom original du fichier (FR-19 "nom") — jamais renommé, contrairement à
        // l'audio de note vocale (toujours "recording", cf. data/remote/storage.ts) : un File
        // réel issu du sélecteur/caméra porte déjà un nom fiable.
      mimeType: string; // FR-19 "type" — type MIME du fichier, "application/octet-stream" en repli
        // si le navigateur n'en fournit aucun (cf. Dev Notes).
      sizeBytes: number; // FR-18 "taille" — enregistrée automatiquement à l'ajout
      storagePath: string | null; // chemin dans le bucket Supabase Storage "documents" (AD-5, AD-8) ;
        // null tant que sync/ n'a pas terminé l'upload du blob local. Pas conflict-tracké (même
        // précédent qu'audioPath, domain/note.ts) : écrit une seule fois par sync/client.ts après
        // upload réussi, jamais comparé via resolveFieldSync.
      priority: Priority;
      provenance: Provenance;
      isNew: boolean;
      createdAt: string; // ISO 8601 UTC
    }

    // NFR-10/AD-5 : 20 Mo max par fichier (document ou note vocale), "vérifiée à la capture".
    // Constante dupliquée depuis MAX_AUDIO_SIZE_BYTES (domain/note.ts) plutôt que partagée — même
    // précédent de duplication assumée que le reste de ce dossier (cf. Dev Notes Story 5.2 :
    // "Document (Epic 6) définira la sienne le jour venu").
    export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

    export function validateDocumentSize(sizeBytes: number): boolean {
      return sizeBytes > 0 && sizeBytes <= MAX_DOCUMENT_SIZE_BYTES;
    }
    ```
  - [x] Pas de `openDocument`/`sortDocuments` (contrairement à `openNote`/`sortNotes`, domain/note.ts) — aucune UI de consultation/liste dans cette story (cf. Scope boundary). Story 6.2 les ajoutera avec l'onglet Documents.

- [x] Task 2: `domain/sync.ts` — étendre `SyncEntity` à `"document"` (AC: #1, #3)
  - [x] Remplacer :
    ```ts
    export type SyncEntity = "project" | "task" | "note";
    ```
    par :
    ```ts
    export type SyncEntity = "project" | "task" | "note" | "document";
    ```
  - [x] Mettre à jour le commentaire d'en-tête du fichier (ligne 5 actuelle : *"SyncEntity restreint à 'project' | 'task' | 'note' : Document n'existe pas encore en tant qu'entité (Epic 6) — étendre l'union quand elle existera réellement, pas avant."*) — supprimer cette phrase, devenue fausse (Document existe désormais).

- [x] Task 3: `domain/index.ts` — exports (AC: #1)
  - [x] Ajouter, à la suite du bloc `./note` :
    ```ts
    export { validateDocumentSize, MAX_DOCUMENT_SIZE_BYTES } from "./document";
    export type { Document } from "./document";
    ```

- [x] Task 4: `data/local/db.ts` — tables `documents`/`documentFiles`, version 7 (AC: #1, #3)
  - [x] Étendre l'import de types :
    ```ts
    import type { Project, Task, Note, Document, SyncQueueEntry } from "@/domain";
    import type { DocumentFileRecord } from "./document-file";
    ```
    (à la suite de l'import existant de `PendingTranscriptionRecord`).
  - [x] Ajouter à `AppDatabase`, à la suite de `pendingTranscriptions` :
    ```ts
    documents!: EntityTable<Document, "id">;
    documentFiles!: EntityTable<DocumentFileRecord, "documentId">;
    ```
  - [x] Ajouter, à la suite de `this.version(6)` :
    ```ts
    // Story 6.1 : nouvelles tables documents (métadonnées, FR-18) et documentFiles (blob brut du
    // fichier, AD-5 — même séparation que notes/noteAudio, Story 5.2 : un Blob ne doit jamais
    // transiter par le mécanisme JSON de la file de synchronisation). Index sur projectId/createdAt
    // (même précédent que notes, Story 5.1) — Story 6.2 (liste de l'onglet Documents) en aura besoin,
    // décidé au moment de créer la table plutôt que par une migration de schéma ultérieure coûteuse
    // pour un simple ajout d'index. `projects`/`tasks`/`syncQueue`/`notes`/`noteAudio`/
    // `pendingTranscriptions` repris tels quels des versions précédentes.
    this.version(7).stores({
      documents: "id, projectId, createdAt",
      documentFiles: "documentId",
    });
    ```

- [x] Task 5: `data/local/document-file.ts` — nouveau module, stockage local du blob (AC: #1, #3)
  - [x] Créer `data/local/document-file.ts` (copie conforme de `data/local/note-audio.ts`, adaptée à Document) :
    ```ts
    // data/local/document-file.ts — stockage local du blob brut d'un document (FR-18, AD-5).
    // Table Dexie distincte de `documents` (data/local/db.ts, version 7) : Document (domain/document.ts)
    // reste un type pur sans dépendance Web API (cf. AD-2), et un Blob ne doit jamais transiter
    // par le mécanisme JSON de la file de synchronisation (data/local/sync-queue.ts), même
        // précédent que data/local/note-audio.ts (Story 5.2). Consommée par data/local/documents.ts
    // (écriture, à la création) et sync/client.ts (lecture, upload différé vers Supabase Storage).
    import type { Transaction } from "dexie";
    import { db } from "./db";

    export interface DocumentFileRecord {
      documentId: string;
      blob: Blob;
    }

    // `tx` optionnel — même pattern que saveNoteAudio : permet d'écrire le blob dans la même
    // transaction que le document et sa file de synchronisation (cf. createDocument), pour ne
    // jamais perdre l'un sans l'autre.
    export async function saveDocumentFile(
      documentId: string,
      blob: Blob,
      tx?: Transaction,
    ): Promise<void> {
      const table = tx ? tx.table<DocumentFileRecord, string>("documentFiles") : db.documentFiles;
      await table.put({ documentId, blob });
    }

    export async function getDocumentFile(documentId: string): Promise<Blob | undefined> {
      const record = await db.documentFiles.get(documentId);
      return record?.blob;
    }
    ```

- [x] Task 6: `data/local/documents.ts` — `createDocument`, `markDocumentUploaded` (AC: #1, #2, #3)
  - [x] Créer `data/local/documents.ts` (structure calquée sur `createVoiceNote`/`markNoteAudioUploaded`, `data/local/notes.ts`) :
    ```ts
    // data/local/documents.ts — lecture/écriture Dexie pour Document (FR-18, Story 6.1). Dépend de
    // domain/ (types) uniquement, cf. AD-2. Aucun champ conflict-tracké (contrairement à
    // Task.status/priority, Note.transcription) : storagePath suit exactement le même traitement
    // qu'audioPath (Note, Story 5.2) — écrit une seule fois par sync/client.ts après upload
    // réussi, jamais comparé via resolveFieldSync (cf. Dev Notes). Aucune fonction de lecture/
    // liste/ouverture ici (listDocumentsByProject, markDocumentOpened) : hors périmètre de cette
    // story (cf. Scope boundary), Story 6.2 les ajoutera avec l'onglet Documents.
    import { db } from "./db";
    import type { Document, Priority, Provenance } from "@/domain";
    import { validateDocumentSize } from "@/domain";
    import { enqueueCreate, enqueueField } from "./sync-queue";
    import { saveDocumentFile } from "./document-file";
    import { getDeviceId } from "@/lib/device";

    export interface CreateDocumentInput {
      projectId: string; // toujours requis (FR-2), même règle que CreateNoteInput
      priority: Priority;
      provenance: Provenance;
      file: File; // sélecteur de fichier (desktop) ou caméra/galerie (mobile), cf. app/capture-flow.tsx
    }

    export async function createDocument(input: CreateDocumentInput): Promise<Document> {
      // Revalidé ici (pas seulement côté UI), même précédent que validateAudioSize
      // (createVoiceNote, data/local/notes.ts).
      if (!validateDocumentSize(input.file.size)) {
        throw new Error("Le fichier dépasse la taille maximale autorisée (20 Mo).");
      }

      const now = new Date().toISOString();

      const document: Document = {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        fileName: input.file.name,
        mimeType: input.file.type || "application/octet-stream",
        sizeBytes: input.file.size,
        storagePath: null,
        priority: input.priority,
        provenance: input.provenance,
        isNew: true,
        createdAt: now,
      };

      await db.transaction("rw", db.documents, db.syncQueue, db.documentFiles, async (tx) => {
        await db.documents.add(document);
        await saveDocumentFile(document.id, input.file, tx);
        await enqueueCreate(
          "document",
          document.id,
          {
            projectId: document.projectId,
            fileName: document.fileName,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            priority: document.priority,
            provenance: document.provenance,
            isNew: document.isNew,
            createdAt: document.createdAt,
          },
          getDeviceId(),
          now,
          tx,
        );
      });

      return document;
    }

    // Appelée uniquement par sync/client.ts (uploadPendingDocuments) une fois l'upload du blob
    // réussi côté serveur — jamais par l'UI directement (AD-1). Même précédent que
    // markNoteAudioUploaded (data/local/notes.ts) : pas de garde d'idempotence, un second appel ne
    // devrait jamais se produire (uploadPendingDocuments ne retente que les documents dont
    // storagePath est encore null) mais serait de toute façon sans conséquence.
    export async function markDocumentUploaded(id: string, storagePath: string): Promise<Document> {
      return db.transaction("rw", db.documents, db.syncQueue, async (tx) => {
        const existing = await db.documents.get(id);
        if (!existing) {
          throw new Error("Document introuvable.");
        }
        const updated: Document = { ...existing, storagePath };
        await db.documents.put(updated);
        await enqueueField(
          {
            entity: "document",
            entityId: id,
            field: "storagePath",
            operation: "update",
            value: storagePath,
            deviceId: getDeviceId(),
            updatedAt: new Date().toISOString(),
          },
          tx,
        );
        return updated;
      });
    }
    ```

- [x] Task 7: `data/local/index.ts` — exports (AC: #1)
  - [x] Ajouter, à la suite du bloc `./pending-transcription` :
    ```ts
    export { createDocument, markDocumentUploaded } from "./documents";
    export type { CreateDocumentInput } from "./documents";
    export { saveDocumentFile, getDocumentFile } from "./document-file";
    export type { DocumentFileRecord } from "./document-file";
    ```

- [x] Task 8: Schéma Supabase — table `documents` + bucket Storage `documents` + RLS (AC: #1, #2, #3, #4 ; AD-4, AD-5, AD-8)
  - [x] Guillaume exécute cette migration SQL dans l'éditeur SQL Supabase du projet dédié (`pxdmtnysvglorwchwsmc`, cf. Stories 1.1/3.2/5.1/5.2/5.3) — **aucune table ni bucket n'existe encore côté Supabase pour Document** (le bucket `audio` existe depuis la Story 5.2 ; `documents` a été délibérément laissé pour cette story, cf. Dev Notes Story 5.2) :
    ```sql
    -- size_bytes en integer (int4, max ~2,1 Go), pas bigint : PostgREST/Supabase sérialise les
    -- colonnes bigint en CHAÎNE (pas un nombre JSON, précision IEEE754 oblige) — RemoteDocumentRow
    -- (Task 10) et Document.sizeBytes (Task 1) sont typés `number`, une chaîne silencieuse
    -- casserait formatFileSize/validateDocumentSize sans erreur TypeScript visible. Le plafond de
    -- 20 Mo (NFR-10) tient très largement dans int4 (~2,1 Go) — aucun besoin réel de bigint ici.
    create table public.documents (
      id uuid primary key,
      user_id uuid not null default auth.uid() references auth.users(id),
      project_id uuid not null references public.projects(id) on delete cascade,
      file_name text not null,
      mime_type text not null,
      size_bytes integer not null,
      storage_path text,
      priority text not null,
      provenance text not null,
      is_new boolean not null default true,
      created_at timestamptz not null
    );
    alter table public.documents enable row level security;
    create policy "documents_owner" on public.documents for all
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

    grant select, insert, update, delete on public.documents to authenticated;

    -- Bucket privé dédié aux documents (AD-8 : deux buckets distincts documents/audio — "audio"
    -- existe depuis la Story 5.2, celui-ci complète la paire). file_size_limit en octets, aligné
    -- sur le plafond de 20 Mo (NFR-10, AD-5) en défense en profondeur — la vérification côté app
    -- (domain/document.ts validateDocumentSize, Task 1/6) reste la garde principale.
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('documents', 'documents', false, 20971520);

    -- RLS sur storage.objects : accès restreint au propriétaire, via le préfixe de dossier
    -- `{user_id}/...` du chemin de stockage (cf. data/remote/document-storage.ts) comparé à
    -- auth.uid() — même mécanique que la policy "audio_owner_insert" (Story 5.2). Seule la policy
    -- insert est ajoutée ici : aucune AC de cette story n'expose de lecture/téléchargement d'un
    -- document déjà envoyé (FR-20, Story 6.3) — la policy select correspondante sera ajoutée par
    -- la story qui en a l'usage réel, même précédent de scope que le reste de cette story.
    create policy "documents_owner_insert" on storage.objects for insert
      with check (bucket_id = 'documents' and (select auth.uid())::text = (storage.foldername(name))[1]);
    ```
  - [x] `project_id` en `on delete cascade` (pas `on delete set null`) : `Document.projectId` n'est jamais nul (FR-2), même règle que `notes.project_id` (Story 5.1) — `Task.project_id` est le seul cas `set null` (tâche générale, FR-2 exception).
  - [x] Vérifier après exécution : une requête sur `public.documents` depuis un rôle non-propriétaire échoue/retourne vide (RLS active) ; le bucket `documents` apparaît dans Storage (privé, limite 20 Mo), aux côtés du bucket `audio` existant — même précédent de vérification que les migrations précédentes.

- [x] Task 9: `data/remote/document-storage.ts` — nouveau module, upload Supabase Storage (AC: #1, #3, #4 ; AD-5, AD-6, AD-8)
  - [x] Créer `data/remote/document-storage.ts` (structure calquée sur `data/remote/storage.ts`, adaptée à Document — fichier séparé plutôt qu'ajouté à `storage.ts` : bucket différent, contrainte de nommage différente — un document réel porte déjà un nom fiable, contrairement à l'audio `MediaRecorder`, cf. Dev Notes) :
    ```ts
    import "server-only";
    import type { SupabaseClient } from "@supabase/supabase-js";

    // data/remote/document-storage.ts — upload des blobs de document dans le bucket Supabase
    // Storage "documents" (FR-18, AD-5, AD-8). Séparé de data/remote/storage.ts (bucket "audio",
    // Story 5.2) : bucket différent, et contrairement à l'audio (toujours "recording", extension
    // devinée depuis le mimeType, cf. audioExtensionFromMimeType), un document réel porte déjà un
    // nom de fichier fiable (input utilisateur via sélecteur/caméra) — aucune extension à deviner.
    // Garde "server-only" héritée transitivement de data/remote/client.ts (cf. data/remote/index.ts).
    // Pas de fonction de lecture/URL signée ici (contrairement à createNoteAudioSignedUrl) :
    // aucune AC de cette story n'expose de téléchargement (FR-20, Story 6.3, cf. Scope boundary).

    const DOCUMENT_BUCKET = "documents";

    // Un nom de fichier vient du sélecteur natif ou de la caméra/galerie mobile (input utilisateur
    // non fiable, cf. app/capture-flow.tsx) — jamais injecté tel quel dans un chemin de stockage
    // Supabase (séparateurs `/`, caractères de contrôle). Remplace tout caractère hors alphanumérique/
    // point/tiret/underscore par "_" ; l'extension d'origine est préservée (elle survit au filtre).
    function sanitizeFileName(fileName: string): string {
      return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    // Même traitement qu'isAlreadyExistsError (data/remote/storage.ts, Story 5.2) : le chemin est
    // déterministe par document (userId + documentId), donc un second upload pour le même document
    // ne peut jamais entrer en collision avec le contenu d'un AUTRE document — c'est forcément une
    // retentative de sync/client.ts uploadPendingDocuments() après un premier upload déjà réussi
    // côté Storage mais jamais confirmé localement. Dupliquée plutôt que partagée cross-module
    // (même précédent de duplication assumée que le reste de ce dossier, cf. Dev Notes Story 5.2).
    function isAlreadyExistsError(error: { message?: string; statusCode?: string }): boolean {
      return error.statusCode === "409" || /resource already exists/i.test(error.message ?? "");
    }

    // Chemin déterministe par document : `${userId}/${documentId}/${nomFichierAssaini}` — le
    // dossier documentId isole chaque fichier (deux documents portant le même nom original ne
    // collisionnent jamais), tout en préservant le nom ET l'extension d'origine dans le chemin
    // (contrairement à audioExtensionFromMimeType, qui devine une extension faute de nom fiable).
    // Le préfixe userId est ce que la policy RLS "documents_owner_insert" (migration Task 8)
    // compare à auth.uid() via storage.foldername(name)[1].
    export async function uploadDocumentFile(
      client: SupabaseClient,
      userId: string,
      documentId: string,
      file: File,
    ): Promise<string> {
      const path = `${userId}/${documentId}/${sanitizeFileName(file.name)}`;
      const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error && !isAlreadyExistsError(error)) {
        throw error;
      }
      return path;
    }
    ```

- [x] Task 10: `data/remote/sync.ts` — `RemoteDocumentRow`, `documentFieldsToColumns`, `upsertDocumentFields` (AC: #1, #3)
  - [x] Ajouter l'interface locale (non exportée au-delà de ce fichier et de `sync/server.ts`, même règle que `RemoteNoteRow`) :
    ```ts
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
    ```
  - [x] Ajouter `documentFieldsToColumns`, à la suite de `noteFieldsToColumns` :
    ```ts
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
    ```
  - [x] Étendre la signature de `updateThenUpsert` : `table: "projects" | "tasks" | "notes" | "documents"`.
  - [x] Ajouter `upsertDocumentFields`, à la suite d'`upsertNoteFields` — **signature à fields aplatis** (pas les entrées brutes du groupe), même précédent qu'`upsertProjectFields` : Document n'a aucun champ conflict-tracké (cf. Dev Notes — pas de colonne `*_updated_at` à peupler, contrairement à `upsertTaskFields`/`upsertNoteFields`) :
    ```ts
    // Document n'a aucun champ dans le périmètre de conflit d'AD-3 (cf. Dev Notes) — signature à
    // fields aplatis, même précédent qu'upsertProjectFields.
    export async function upsertDocumentFields(
      client: SupabaseClient,
      entityId: string,
      fields: Record<string, unknown>,
    ): Promise<void> {
      await updateThenUpsert(client, "documents", entityId, documentFieldsToColumns(fields));
    }
    ```
  - [x] Renommer `fetchAllProjectsTasksAndNotes` en `fetchAllProjectsTasksNotesAndDocuments` (le nom actuel deviendrait trompeur, même précédent que le renommage `fetchAllProjectsAndTasks` → `fetchAllProjectsTasksAndNotes` en Story 5.1) et ajouter la sélection `documents` :
    ```ts
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
    ```
  - [x] Mettre à jour le commentaire d'en-tête du fichier (ligne 5-6 actuelle, référence "tables projects/tasks/notes") pour inclure `documents`.

- [x] Task 11: `data/remote/index.ts` — exports (AC: #1)
  - [x] Remplacer :
    ```ts
    export {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      fetchAllProjectsTasksAndNotes,
    } from "./sync";
    export { uploadNoteAudio, createNoteAudioSignedUrl } from "./storage";
    export { transcribeAudio } from "./transcription";
    ```
    par :
    ```ts
    export {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      upsertDocumentFields,
      fetchAllProjectsTasksNotesAndDocuments,
    } from "./sync";
    export { uploadNoteAudio, createNoteAudioSignedUrl } from "./storage";
    export { transcribeAudio } from "./transcription";
    export { uploadDocumentFile } from "./document-storage";
    ```

- [x] Task 12: `sync/server.ts` — routage entité `"document"` (`pushQueueEntries`), `uploadDocumentBlob`, `pullRemoteSnapshot` (AC: #1, #3, #4)
  - [x] Étendre les imports :
    ```ts
    import {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      upsertDocumentFields,
      fetchAllProjectsTasksNotesAndDocuments,
    } from "@/data/remote/sync";
    import { uploadNoteAudio, createNoteAudioSignedUrl } from "@/data/remote/storage";
    import { uploadDocumentFile } from "@/data/remote/document-storage";
    import { transcribeAudio } from "@/data/remote/transcription";
    ```
  - [x] Dans `pushQueueEntries`, ajouter un panier `documentGroups` à côté de `projectGroups`/`taskGroups`/`noteGroups` :
    ```ts
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
    ```
  - [x] Étendre la boucle de traitement (ordre : project avant les autres, `document` référence `project_id`, même raison que `task`/`note`) :
    ```ts
    for (const group of [...projectGroups, ...taskGroups, ...noteGroups, ...documentGroups]) {
      const { entity, entityId } = group[0];
      const ids = group.map((entry) => entry.id);

      try {
        if (entity === "project") {
          const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
          await upsertProjectFields(client, entityId, fields);
        } else if (entity === "note") {
          await upsertNoteFields(client, entityId, group);
        } else if (entity === "document") {
          // Document n'a aucun champ conflict-tracké (AD-3 ne s'y applique pas, cf. Dev Notes) —
          // fields aplatis, même précédent que la branche "project" ci-dessus.
          const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
          await upsertDocumentFields(client, entityId, fields);
        } else {
          await upsertTaskFields(client, entityId, group);
        }
        succeededIds.push(...ids);
      } catch {
        failedIds.push(...ids);
      }
    }
    ```
  - [x] Remplacer `pullRemoteSnapshot` :
    ```ts
    export async function pullRemoteSnapshot(client: SupabaseClient) {
      return fetchAllProjectsTasksNotesAndDocuments(client);
    }
    ```
  - [x] Ajouter, à la suite d'`uploadNoteAudioBlob` — wrapper fin, même précédent (sync/server.ts reste le seul point d'entrée que les route handlers `app/api/*` importent pour atteindre `data/remote/`, AD-2/AD-6) :
    ```ts
    export async function uploadDocumentBlob(
      client: SupabaseClient,
      userId: string,
      documentId: string,
      file: File,
    ): Promise<string> {
      return uploadDocumentFile(client, userId, documentId, file);
    }
    ```

- [x] Task 13: `app/api/sync/upload-document/route.ts` — nouvelle route (AC: #1, #3, #4 ; AD-6)
  - [x] Créer `app/api/sync/upload-document/route.ts` (copie conforme d'`app/api/sync/upload-audio/route.ts`, adaptée à Document) :
    ```ts
    import { createSupabaseServerClient } from "@/data/remote/client";
    import { uploadDocumentBlob } from "@/sync/server";

    // app/api/sync/upload-document/route.ts — reçoit le blob d'un document en attente
    // (multipart/form-data, pas JSON : un Blob ne passe pas par JSON.stringify(), même précédent
    // qu'upload-audio, Story 5.2) et le téléverse vers Supabase Storage via sync/server.ts (AD-6).
    // Protégé par proxy.ts comme toute autre route /api/sync/* (cf. Dev Notes Story 3.2).

    // Format exact de crypto.randomUUID() (côté client, cf. data/local/documents.ts createDocument)
    // — même garde qu'upload-audio/route.ts (Story 5.2, trouvé en revue de code).
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    export async function POST(request: Request) {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase.auth.getClaims();
      if (!data) {
        return new Response(null, { status: 401 });
      }

      const userId = data.claims.sub;
      if (typeof userId !== "string") {
        return new Response(null, { status: 401 });
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return new Response(null, { status: 400 });
      }

      const documentId = formData.get("documentId");
      const file = formData.get("file");
      if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId) || !(file instanceof File)) {
        return new Response(null, { status: 400 });
      }

      try {
        const path = await uploadDocumentBlob(supabase, userId, documentId, file);
        return Response.json({ path });
      } catch {
        return new Response(null, { status: 500 });
      }
    }
    ```
  - [x] `app/api/sync/pull/route.ts` : **aucun changement** — déjà générique (`Response.json(await pullRemoteSnapshot(supabase))`), le nouveau champ `documents` du snapshot y transite automatiquement.

- [x] Task 14: `sync/client.ts` — pull/insertion `documents`, `uploadPendingDocuments` (AC: #1, #3, #4)
  - [x] Étendre l'import `@/data/local` : ajouter `getDocumentFile, markDocumentUploaded` à la suite de `clearTranscriptionPending`.
  - [x] Ajouter l'interface locale dupliquée (même règle que `PulledNoteRow` — jamais importée depuis `data/remote/sync.ts`, cf. Dev Notes Story 3.2), à la suite de `PulledNoteRow` :
    ```ts
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
    ```
  - [x] Ajouter `toLocalDocument`, à la suite de `toLocalNote` :
    ```ts
    // Document n'a aucun champ conflict-tracké (cf. Dev Notes) : contrairement à toLocalNote
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
    ```
  - [x] Étendre l'import de types : `import type { Document, Note, Project, SyncQueueEntry, Task } from "@/domain";`.
  - [x] Dans `pullOnce()`, ajouter la boucle documents à la suite de celle des notes — **insertion seule, pas de `mergeExistingDocument`** : aucun champ de Document ne peut diverger entre deux appareils après création dans cette story (`storagePath` est le seul champ écrit après coup, et seulement par l'appareil qui a réalisé l'upload lui-même ; `isNew` ne transitionne jamais dans cette story faute d'UI de consultation, cf. Scope boundary) — même position que le tout premier `pullOnce()` de la Story 3.2, avant que Story 3.6 n'introduise `mergeExistingTask` pour un besoin de conflit qui n'existe pas encore ici :
    ```ts
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
    ```
  - [x] Étendre le type de la réponse JSON dans `pullOnce()` :
    ```ts
    const snapshot = (await response.json()) as {
      projects: PulledProjectRow[];
      tasks: PulledTaskRow[];
      notes: PulledNoteRow[];
      documents: PulledDocumentRow[];
    };
    ```
  - [x] Renommer la constante `AUDIO_UPLOAD_TIMEOUT_MS` en `BLOB_UPLOAD_TIMEOUT_MS` (nom devenu trompeur — utilisée désormais par l'upload audio, l'upload document, ET la requête de transcription, pas seulement l'audio) et mettre à jour ses 2 usages existants (`uploadPendingAudio`, `retryPendingTranscriptions`) :
    ```ts
    // Upload d'un blob volumineux : délai plus généreux que FETCH_TIMEOUT_MS (15s, calibré pour
    // le JSON de la file de synchronisation) — jusqu'à 20 Mo (NFR-10) sur une connexion lente.
    // Nom générique (pas AUDIO_*) : utilisée par l'upload audio, l'upload document (Story 6.1) et
    // la requête de transcription, pas seulement l'audio (renommée en Story 6.1).
    const BLOB_UPLOAD_TIMEOUT_MS = 60_000;
    ```
  - [x] Ajouter `uploadPendingDocuments`, à la suite d'`uploadPendingAudio` — même structure exacte, adaptée à Document (pas de compteur de tentatives dédié, même position que l'audio : NFR-5 "reprise depuis le dernier point réussi" satisfaite au grain de l'upload entier, pas par octet — cf. Dev Notes pour la décision de conception complète derrière l'AC#4) :
    ```ts
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
    ```
  - [x] Dans `runSyncCycle()`, ajouter l'appel à la suite d'`uploadPendingAudio` :
    ```ts
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
    ```

- [x] Task 15: `app/capture-flow.tsx` — sélection de fichier, `handleSubmitDocument` (AC: #1, #2)
  - [x] Étendre l'import `@/domain` : ajouter `validateDocumentSize` à côté de `MAX_AUDIO_SIZE_BYTES`.
  - [x] Étendre l'import `@/data/local` : ajouter `createDocument` à côté de `createVoiceNote`.
  - [x] Mettre à jour le commentaire d'en-tête du fichier (lignes 3-6 actuelles) — Document devient fonctionnel (ajout uniquement, cf. Scope boundary de cette story) :
    ```tsx
    // app/capture-flow.tsx — FAB "+" persistant + flux de capture en 3 étapes
    // (Projet → Priorité → Type), UX-DR10/UX-DR14. Tâche (Story 3.1), Note texte (Story 5.1),
    // Note vocale (Story 5.2) et Document (Story 6.1, ajout uniquement — liste/consultation en
    // Story 6.2) sont fonctionnels.
    ```
  - [x] Ajouter les constantes, à côté d'`AUDIO_SIZE_CAPPED_MESSAGE` :
    ```ts
    const FILE_TOO_LARGE_MESSAGE =
      "Ce fichier dépasse la taille maximale autorisée (20 Mo).";
    ```
  - [x] **Supprimer** la constante `COMING_SOON_MESSAGE` — devenue morte : les 4 valeurs de `CaptureType` ("note-text", "voice-note", "task", "document") sont désormais toutes fonctionnelles, plus aucune valeur ne peut atteindre la branche qui l'affichait (cf. subtask suivante).
  - [x] Ajouter, à la suite de `formatRecordingTime` :
    ```ts
    // Formatage taille de fichier (FR-18/FR-19 "taille") — 1 décimale, virgule française (cohérent
    // avec formatDueDate, app/projects/[id]/project-view.tsx, qui utilise déjà "fr-FR").
    function formatFileSize(bytes: number): string {
      const megabytes = bytes / (1024 * 1024);
      return `${megabytes.toFixed(1).replace(".", ",")} Mo`;
    }
    ```
  - [x] Ajouter l'état, à la suite de `transcribeAtCreation` :
    ```ts
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [documentFileError, setDocumentFileError] = useState<string | undefined>();
    ```
  - [x] Dans `resetState()`, ajouter à la suite de `setTranscribeAtCreation(false);` :
    ```ts
    setDocumentFile(null);
    setDocumentFileError(undefined);
    ```
  - [x] Dans `handleBackToTypeSelection()`, ajouter les deux mêmes lignes à la suite de `setTranscribeAtCreation(false);`.
  - [x] Ajouter, à la suite de `handleDueDateChange` :
    ```ts
    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }
      if (!validateDocumentSize(file.size)) {
        setDocumentFileError(FILE_TOO_LARGE_MESSAGE);
        setDocumentFile(null);
        return;
      }
      setDocumentFileError(undefined);
      setDocumentFile(file);
    }
    ```
  - [x] Ajouter, à la suite de `handleSubmitVoiceNote` :
    ```ts
    async function handleSubmitDocument() {
      if (pending || !documentFile) {
        return;
      }

      setSubmitError(undefined);
      setPending(true);

      try {
        // projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject("document")
        // est true, même garde-fou que pour "note-text"/"voice-note" (Story 5.1/5.2).
        await createDocument({
          projectId: projectSelection as string,
          priority: priority as Priority,
          provenance: detectProvenance(),
          file: documentFile,
        });
      } catch {
        setSubmitError(SUBMIT_FAILED_MESSAGE);
        setPending(false);
        return;
      }

      setPending(false);
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        setOpen(false);
      }, SUCCESS_CLOSE_DELAY_MS);
    }
    ```
  - [x] Dans `stepTitle()`, ajouter avant le `return "Que voulez-vous créer ?";` final :
    ```ts
    if (type === "document") {
      return "Nouveau document";
    }
    ```
  - [x] Étendre la condition de la vue succès (inclure "document") :
    ```tsx
    {step === 3 &&
      (type === "task" || type === "note-text" || type === "voice-note" || type === "document") &&
      success && (
      <div className={styles.stepBody}>
        <p className={styles.success}>{SUCCESS_MESSAGE}</p>
      </div>
    )}
    ```
  - [x] **Supprimer entièrement** le bloc devenu mort (juste avant le bloc succès ci-dessus) :
    ```tsx
    {step === 3 &&
      type !== null &&
      type !== "task" &&
      type !== "note-text" &&
      type !== "voice-note" && (
      <div className={styles.stepBody}>
        <p className={styles.empty}>{COMING_SOON_MESSAGE}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={handleBackToTypeSelection}
          >
            Retour
          </button>
        </div>
      </div>
    )}
    ```
  - [x] Ajouter, à la suite du bloc `{step === 3 && type === "voice-note" && !success && (...)}` (juste avant la fermeture de `<div ref={contentRef}>`) — sélecteur de fichier natif (EXPERIENCE.md : "Sélecteur de fichier natif sur desktop ; choix caméra ou galerie sur mobile") : un simple `<input type="file">` **sans** attribut `capture` ni `accept` restrictif — `capture` forcerait la caméra directement sur mobile et retirerait le choix "galerie" attendu par la spec ; sans lui, les navigateurs mobiles proposent nativement Caméra/Galerie/Fichiers au tap, ce qui est exactement le comportement demandé :
    ```tsx
    {step === 3 && type === "document" && !success && (
      <div className={styles.stepBody}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="document-file">
            Fichier
          </label>
          <input
            className={styles.input}
            id="document-file"
            type="file"
            onChange={handleFileChange}
            disabled={pending}
          />
          {documentFile && !documentFileError && (
            <p className={styles.fileInfo}>
              {documentFile.name} · {formatFileSize(documentFile.size)}
            </p>
          )}
          {documentFileError && (
            <p className={styles.error} role="alert">
              {documentFileError}
            </p>
          )}
        </div>

        {submitError && (
          <p className={styles.error} role="alert">
            {submitError}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={handleBackToTypeSelection}
            disabled={pending}
          >
            Retour
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSubmitDocument}
            disabled={pending || !documentFile}
          >
            Créer
          </button>
        </div>
      </div>
    )}
    ```

- [x] Task 16: `app/capture-flow.module.css` — `.fileInfo` (AC: #1)
  - [x] Ajouter, à la fin du fichier :
    ```css
    /* Nom + taille du fichier sélectionné (Story 6.1, FR-18/FR-19) — même rôle informatif que
       .recordingTimer, sans le tabular-nums (pas de chiffres qui changent en temps réel ici). */
    .fileInfo {
      font-size: var(--font-caption-size);
      font-weight: var(--font-caption-weight);
      color: var(--color-muted);
    }
    ```

- [x] Task 17: Vérification manuelle (AC: #1, #2, #3, #4)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Exécuter la migration SQL de la Task 8 sur le projet Supabase avant toute vérification réseau/synchro. **Exécutée et vérifiée par Guillaume** (version idempotente, cf. Change Log — le bucket `documents` existait déjà).
  - [x] **AC#1** : flux "+" → "Document" → sélectionner un fichier (desktop : sélecteur natif ; mobile : vérifier le choix Caméra/Galerie proposé par l'OS) → "Créer" → "Enregistré." Vérifier via Dexie (DevTools → Application → IndexedDB → `project-note` → tables `documents`/`documentFiles`) que le document existe avec `fileName`/`mimeType`/`sizeBytes` corrects et `storagePath` initialement `null` puis renseigné après synchro. Vérifier côté Supabase (table `public.documents`, bucket Storage `documents`) que la ligne et le fichier apparaissent (chemin `{userId}/{documentId}/{fileName}`). **Vérifié par Guillaume en conditions réelles — fonctionne** (sélection multiple incluse, cf. Change Log pour l'amendement de portée).
  - [x] **AC#2** : sélectionner un fichier > 20 Mo → message explicite affiché, bouton "Créer" reste désactivé. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [x] **AC#3** : mode hors ligne (DevTools → Network → Offline) → ajouter un document → "Enregistré." s'affiche quand même (aucun appel réseau dans `createDocument`, écriture Dexie uniquement, AD-1) → `storagePath` reste `null` en Dexie tant que hors ligne. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [x] **AC#4** : couper le réseau pendant/juste après l'upload puis le rétablir → `uploadPendingDocuments` retente automatiquement au cycle suivant sans nouvelle action utilisateur, `storagePath` finit par se renseigner. Cf. Dev Notes pour la portée exacte de "reprend depuis le dernier point réussi" dans cette story (upload entier idempotent, pas de reprise par octet). **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [x] Non-régression : onglets Tâches/Notes toujours fonctionnels ; onglet Documents toujours "Bientôt disponible." (inchangé, cf. Scope boundary) ; capture Tâche/Note texte/Note vocale toujours fonctionnelle ; indicateur de synchronisation reflète l'upload en cours puis "à jour". **Aucune régression constatée par Guillaume.**
  - [ ] Nettoyage des données de test : document(s) de test à supprimer manuellement (aucune fonctionnalité de suppression de document n'existe encore, FR-21/Story 6.3) — IndexedDB et ligne `public.documents` + fichier du bucket `documents` (dashboard Supabase). **Reste à faire par Guillaume.**

### Review Findings

- [x] [Review][Patch] Échec partiel d'un lot multi-fichiers → resoumission dupliquée au retry [app/capture-flow.tsx:686] — corrigé
- [x] [Review][Patch] `sanitizeFileName` ne neutralise pas un nom de fichier réduit à "." ou ".." [data/remote/document-storage.ts:19] — corrigé
- [x] [Review][Patch] `formatFileSize` affiche "0,0 Mo" pour tout fichier < 50 Ko [app/capture-flow.tsx:72] — corrigé
- [x] [Review][Patch] Fichier vide (0 octet) affiche le message "dépasse la taille maximale" au lieu d'un message dédié [app/capture-flow.tsx:398] — corrigé
- [x] [Review][Patch] Annuler le sélecteur après un rejet de taille laisse le message d'erreur affiché [app/capture-flow.tsx:398] — corrigé
- [x] [Review][Defer] Aucune vérification que `documentId` correspond à un document existant/possédé avant l'upload du blob [app/api/sync/upload-document/route.ts:29] — deferred, pre-existing (même pattern qu'`upload-audio/route.ts` depuis la Story 5.2, jamais corrigé pour l'audio)
- [x] [Review][Defer] Aucune garde de concurrence dans `uploadPendingDocuments` (double upload possible sur cycles/onglets qui se chevauchent) [sync/client.ts] — deferred, pre-existing (même lacune qu'`uploadPendingAudio` depuis la Story 5.2)
- [x] [Review][Defer] L'upload du blob peut se terminer avant que la ligne de métadonnées du document ne soit confirmée synchronisée [sync/client.ts:708] — deferred, pre-existing (même ordre que l'audio depuis la Story 5.2)
- [x] [Review][Defer] Le type MIME fourni par le client est fait confiance sans validation [data/remote/document-storage.ts] — deferred, pre-existing (pas exploitable sans chemin de lecture/téléchargement, mais Story 6.2/6.3 ne devrait pas hériter de ce risque silencieusement)

### Review Findings — Dismissed as noise (9)

Aucune application côté serveur de la limite de 20 Mo dans le route handler (le bucket Storage `documents` porte déjà `file_size_limit: 20971520`, imposé par Supabase Storage lui-même — même précédent déjà tranché pour le bucket `audio` en Story 5.2) · Absence d'attribut `accept` sur l'input fichier (décision délibérée et documentée dans la Task 15 d'origine) · Absence de migration SQL dans le diff (vit hors diff par convention établie du projet, exécutée et vérifiée par Guillaume, cf. Change Log) · Absence de tests automatisés (convention établie du projet, documentée dans Testing Standards) · Duplication d'`isAlreadyExistsError` (duplication délibérée et documentée, convention établie de `data/remote/`) · Compatibilité navigateur du stockage de Blob dans IndexedDB (identique au pattern `noteAudio` déjà en production depuis la Story 5.2) · Exhaustivité non confirmée de `SyncEntity` ailleurs dans le code (aucun cas manqué localisé à l'inspection) · Cast non validé de `priority`/`provenance` distants (même pattern déjà utilisé pour Task/Note) · Absence de plafond sur le nombre de fichiers par lot (aucune exigence de spec, faible probabilité réelle pour un usage solo).

L'Acceptance Auditor n'a relevé aucune violation d'AC, aucune déviation de la spec, aucune implémentation manquante.

## Dev Notes

### Architecture Compliance

- **AD-1 (Local-first)** : `createDocument` (Task 6) écrit d'abord dans Dexie (document + blob + file de synchro), dans une seule transaction — aucun appel réseau. Upload et confirmation (`storagePath`) sont un second temps, géré par `sync/` uniquement (`uploadPendingDocuments`, Task 14).
- **AD-2 (direction de dépendance)** : `data/remote/document-storage.ts` garde `"server-only"` (Task 9) ; `app/capture-flow.tsx` n'importe que `data/local/` (Task 15), jamais `data/remote/`.
- **AD-3 (conflit par champ) — ne s'applique PAS à `Document` dans cette story.** Les binds explicites d'AD-3 sont "Task.status, priority partagée Task/Note/Document, Note.transcription". Mais Story 5.1 a déjà tranché que `Note.priority` n'est **pas** conflict-tracké malgré ce libellé ("FR-14 ne s'applique qu'à Task", cf. `data/local/notes.ts` en-tête et Dev Notes Story 5.1) — précédent explicitement établi et jamais révisé depuis (Stories 5.2/5.3 ne l'ont pas remis en cause). Cette story applique **exactement le même raisonnement** à `Document.priority` : aucune AC de Story 6.1 (ni d'aucune story livrée à ce jour) n'exerce une modification de priorité après coup sur un Document, et `data/local/documents.ts` n'expose volontairement aucune fonction `updateDocumentPriority`. `storagePath` suit le même traitement qu'`audioPath` (non conflict-tracké, écrit une seule fois par `sync/`). **Conséquence concrète** : `upsertDocumentFields`/`toLocalDocument` utilisent la signature simple (fields aplatis), pas la signature "entrées brutes" qu'exigent `upsertTaskFields`/`upsertNoteFields` pour peupler une colonne `*_updated_at` — et `sync/client.ts` n'a besoin d'aucune fonction `mergeExistingDocument` (insertion seule, cf. Task 14).
- **AD-4 (RLS)** : table `documents` + policy `for all` (Task 8), même modèle que `projects`/`tasks`/`notes`.
- **AD-5 (stockage hors ligne + reprise d'upload) — décision de conception explicite sur l'AC#4.** `AD-5` et l'AC#4 de cette story ("l'upload reprend depuis le dernier point réussi, sans repartir de zéro") pourraient suggérer une reprise **par octet** (protocole resumable/TUS). **Ce n'est pas ce qui est implémenté ici, et c'est un choix assumé** : Story 5.2 (audio, même NFR-5 sous-jacent, même plafond 20 Mo) a explicitement classé la reprise par octet "hors périmètre" et livré à la place une **retentative idempotente du fichier entier** — précédent accepté (story `done`) que cette story reconduit à l'identique pour Document (`uploadPendingDocuments`, structure calquée sur `uploadPendingAudio`). Une reprise par octet réelle exigerait soit un upload direct navigateur→Supabase Storage via le protocole resumable de Storage (violerait AD-1 : contournerait `sync/`, écriture non passée par Dexie-first), soit un relais chunké maison côté route handler (complexité disproportionnée pour un outil interne solo, NFR hors staging). **Ce qui est réellement garanti et satisfait l'esprit de l'AC#4** : le blob reste durablement en Dexie quoi qu'il arrive (jamais reperdu, jamais à re-sélectionner) ; une coupure réseau pendant l'upload est retentée automatiquement au cycle suivant (retour en ligne ou intervalle 30s), sans action utilisateur ; un upload déjà réussi côté Storage mais jamais confirmé localement n'est jamais renvoyé une seconde fois (chemin déterministe `{userId}/{documentId}/...` + traitement idempotent de l'erreur "already exists", `data/remote/document-storage.ts`). "Ne repart jamais de zéro" est donc satisfait au grain de l'opération (jamais besoin de recapturer/resélectionner le fichier), pas au grain de l'octet transféré. Si une reprise par octet devient un jour un besoin réel (fichiers volumineux sur connexion très instable), ce sera une story dédiée.
- **AD-6 (serveur uniquement)** : `app/api/sync/upload-document/route.ts` (Task 13) est l'unique point d'entrée réseau ; `data/remote/document-storage.ts` reste `"server-only"`.
- **AD-8 (buckets Storage)** : le bucket `documents` (Task 8) complète la paire `documents`/`audio` déjà anticipée par l'architecture — `audio` existe depuis la Story 5.2, `documents` était délibérément laissé pour cette story (cf. commentaire `data/remote/storage.ts` Story 5.2 : *"celui-ci, 'documents' reste pour l'Epic 6"*).

### Library/Framework Requirements

Aucune nouvelle dépendance npm — `File`/`FormData`/`fetch` natifs (même approche qu'`uploadNoteAudioBlob`, Story 5.2). Stack inchangée : Next.js 16.3.0, Dexie 4.4.4, `@supabase/supabase-js` 2.112.0.

### File Structure Requirements

**Créés :**
```text
domain/document.ts                    # entité Document, MAX_DOCUMENT_SIZE_BYTES, validateDocumentSize
data/local/document-file.ts           # saveDocumentFile/getDocumentFile (blob brut)
data/local/documents.ts               # createDocument, markDocumentUploaded
data/remote/document-storage.ts       # uploadDocumentFile (bucket "documents")
app/api/sync/upload-document/route.ts # upload du blob document en attente
```
**Modifiés :**
```text
domain/sync.ts                        # SyncEntity += "document"
domain/index.ts                       # + export Document, validateDocumentSize, MAX_DOCUMENT_SIZE_BYTES
data/local/db.ts                      # + tables documents/documentFiles, version 7
data/local/index.ts                   # + export createDocument, markDocumentUploaded, saveDocumentFile, getDocumentFile
data/remote/sync.ts                   # + RemoteDocumentRow, documentFieldsToColumns, upsertDocumentFields ;
                                       #   fetchAllProjectsTasksAndNotes renommé fetchAllProjectsTasksNotesAndDocuments (+ documents)
data/remote/index.ts                  # + export upsertDocumentFields, uploadDocumentFile, fetchAllProjectsTasksNotesAndDocuments (renommé)
sync/server.ts                        # + routage entité "document" (pushQueueEntries), uploadDocumentBlob,
                                       #   pullRemoteSnapshot -> fetchAllProjectsTasksNotesAndDocuments
sync/client.ts                        # + PulledDocumentRow, toLocalDocument, pullOnce étendu (insertion seule),
                                       #   uploadPendingDocuments, runSyncCycle étendu ;
                                       #   AUDIO_UPLOAD_TIMEOUT_MS renommé BLOB_UPLOAD_TIMEOUT_MS
app/capture-flow.tsx                  # + sélecteur de fichier (étape 3, type Document), handleSubmitDocument,
                                       #   formatFileSize ; suppression de COMING_SOON_MESSAGE (code mort)
app/capture-flow.module.css           # + .fileInfo
```
**Explicitement non modifiés** (cf. Scope boundary) : `app/projects/[id]/project-view.tsx`, `app/projects/[id]/project-view.module.css`, `app/api/sync/pull/route.ts` (déjà générique).

### Project Structure Notes

- Alignement complet avec l'arborescence minimale d'`ARCHITECTURE-SPINE.md` — aucune variance. `Document` suit exactement le patron déjà établi par `Note`/`Task` (entité dans `domain/`, lecture/écriture dans `data/local/`, passerelle serveur dans `data/remote/` + `sync/server.ts`, orchestration client dans `sync/client.ts`, UI dans `app/`).
- Aucun nouveau composant sous `components/` — même précédent que `Task`/`Note` (sous-composants internes à leurs fichiers `app/` respectifs). Cette story n'ajoute d'ailleurs aucun composant de carte/détail du tout (cf. Scope boundary), donc la question ne se pose même pas encore pour `Document`.

### Testing Standards

Aucun framework de test automatisé imposé (identique aux Stories 1.1 à 5.3). Vérification manuelle exhaustive en Task 17, contre le projet Supabase de production réel (pas de staging). **Particularité de cette story : pas d'UI de consultation** (cf. Scope boundary) — la vérification des AC passe par l'inspection directe de Dexie (DevTools → Application → IndexedDB) et du dashboard Supabase (table + bucket), pas par un parcours UI classique "créer puis voir apparaître dans une liste" comme les stories précédentes. Attention particulière à : AC#4 vérifiée en coupant le réseau pendant l'upload (DevTools → Network → Offline) puis en le rétablissant, sans action utilisateur additionnelle ; AC#2 vérifiée avec un fichier réellement > 20 Mo (pas seulement par lecture de code) ; non-régression du flux de capture pour Tâche/Note texte/Note vocale (le bloc "Bientôt disponible." supprimé ne doit affecter aucun autre type).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Documents, Story 6.1 (texte exact des 4 AC, FR-18 couvert par cette story ; FR-19/FR-20/FR-21 explicitement Story 6.2/6.3)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#FR-18 ("nom, type et taille du fichier sont enregistrés automatiquement à l'ajout... types de fichiers attendus en usage courant : photos et PDF") ; §9 Open Question 1 (taille max, résolue par AD-5/NFR-10 = 20 Mo) ; §9 Open Question 3 (reprise d'upload, "confirmé en phase Architecture" — portée exacte de cette confirmation documentée ci-dessus, Dev Notes AD-5) ; FR-2 (projet obligatoire pour Document, même règle que Note) ; NFR-10 (20 Mo max)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-3 (binds "priority partagée Task/Note/Document" — interprétation héritée du précédent Story 5.1, cf. Dev Notes ci-dessus) ; AD-5 (binds "FR-16, FR-18, data/local/" — stockage blob + reprise d'upload) ; AD-6 (serveur uniquement) ; AD-8 (deux buckets Storage distincts documents/audio) ; Capability → Architecture Map "4.5 Documents — FR-18 à FR-21 | data/local/ (blob), sync/ (upload vers Supabase Storage) | AD-3 (conflit sur priority), AD-5, AD-6" ; Deferred ("schéma exact Dexie/Supabase — job du code")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Ajout de document (étape 3, type Document) | Overlay '+' | Sélecteur de fichier natif sur desktop ; choix caméra ou galerie sur mobile. Le fichier ajouté alimente directement la carte document (nom, type, taille, date).") — la carte document elle-même est Story 6.2, cf. Scope boundary]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.task-card ("métadonnées fichier pour un document") — s'applique à Story 6.2, pas cette story]
- [Source: _bmad-output/implementation-artifacts/5-2-enregistrement-dune-note-vocale.md — patron complet blob local + upload différé réutilisé à l'identique pour Document : NoteAudioRecord → DocumentFileRecord, saveNoteAudio/getNoteAudio → saveDocumentFile/getDocumentFile, createVoiceNote → createDocument, markNoteAudioUploaded → markDocumentUploaded, uploadNoteAudio → uploadDocumentFile, isAlreadyExistsError (dupliquée), uploadPendingAudio → uploadPendingDocuments, décision déjà actée "NFR-5 (reprise par octet) hors périmètre" — reconduite ici (cf. Dev Notes AD-5) ; commentaire explicite "'documents' reste pour l'Epic 6" (data/remote/storage.ts) confirmant qu'aucun bucket documents n'existe encore]
- [Source: _bmad-output/implementation-artifacts/5-1-creation-dune-note-texte.md — décision "Note.priority non conflict-tracké malgré le libellé AD-3" (data/local/notes.ts), reconduite à l'identique pour Document.priority (cf. Dev Notes AD-3) ; renommage fetchAllProjectsAndTasks → fetchAllProjectsTasksAndNotes, même précédent que le renommage de cette story]
- [Source: _bmad-output/implementation-artifacts/3-6-resolution-de-conflit-de-synchronisation-par-champ.md — pourquoi Document n'a PAS besoin d'un mergeExistingDocument dans cette story : le pull "insertion seule" de la Story 3.2 (avant l'introduction de mergeExistingTask) est le bon précédent tant qu'aucun champ multi-appareil divergent n'existe]
- [Source: domain/sync.ts — commentaire "SyncEntity restreint à... étendre l'union quand elle existera réellement, pas avant" (Story 3.2) : cette story est le moment annoncé]
- [Source: _bmad-output/project-context.md#Agent Workflow Behavior — ne pas s'arrêter aux HALT procéduraux de bmad-create-story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre.
- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker, y compris la nouvelle route `app/api/sync/upload-document` correctement enregistrée comme dynamique).
- **Task 8 (migration SQL Supabase) non exécutable par l'agent** : aucun outil MCP Supabase/base de données disponible dans cette session (vérifié explicitement via recherche d'outils) — même situation que toutes les stories précédentes touchant le schéma Postgres (3.2, 3.6, 5.1, 5.2, 5.3). Le SQL est prêt dans le texte de la Task 8 ; reste à exécuter par Guillaume dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc`.
- **Vérification manuelle en conditions réelles impossible dans cette session** : `preview_start` en mode `autoPort` n'a démarré aucun processus joignable (même symptôme documenté dans le Debug Log des Stories 5.2/5.3 — port 3000 déjà occupé par le serveur `next dev` d'une session parallèle). Basculé sur `http://localhost:3000` (session parallèle déjà active, sert le code à jour) : l'écran de connexion s'affiche correctement, mais aucune session authentifiée n'est disponible dans cet environnement et je ne dois jamais saisir d'identifiants à la place de l'utilisateur — impossible de dérouler le flux "+" → Document réel. Un overlay d'erreur Next.js dev signale un échec d'enregistrement du Service Worker Serwist ("Failed to register a ServiceWorker... An unknown error occurred when fetching the script") — préexistant et sans rapport avec le code de cette story (aucun fichier touché par cette story ne concerne le service worker), même nature que l'artefact de service worker obsolète documenté dans le Debug Log de la Story 5.2.
- **Task 17 (vérification manuelle) non réalisable par l'agent au-delà de build/lint/tsc** : nécessite (1) la migration SQL de la Task 8 exécutée au préalable, (2) une session authentifiée dans un navigateur pour piloter le flux de capture, (3) un fichier réel > 20 Mo pour l'AC#2, (4) une coupure réseau pilotée en conditions réelles pour l'AC#4. Aucun de ces prérequis n'était réuni dans cette session. Reste intégralement à la charge de Guillaume.

### Completion Notes List

- **Code complet (Tasks 1 à 16)** : nouvelle entité `Document` (`domain/document.ts`, `MAX_DOCUMENT_SIZE_BYTES`/`validateDocumentSize`, aucun champ conflict-tracké — cf. Dev Notes AD-3) ; `SyncEntity` étendu à `"document"` (`domain/sync.ts`) ; stockage local Dexie complet (`documents`/`documentFiles`, version 7, `createDocument`/`markDocumentUploaded`, `saveDocumentFile`/`getDocumentFile`) ; passerelle Supabase complète (`data/remote/document-storage.ts` — upload bucket `documents`, chemin `{userId}/{documentId}/{fileName}`, nom de fichier assaini ; `data/remote/sync.ts` — `RemoteDocumentRow`, `upsertDocumentFields`, `fetchAllProjectsTasksAndNotes` renommé `fetchAllProjectsTasksNotesAndDocuments`) ; orchestration `sync/server.ts`/`sync/client.ts` complète (routage `pushQueueEntries`, `uploadDocumentBlob`, pull en insertion seule `toLocalDocument`, `uploadPendingDocuments`, `AUDIO_UPLOAD_TIMEOUT_MS` renommé `BLOB_UPLOAD_TIMEOUT_MS`) ; nouvelle route `POST /api/sync/upload-document` ; interface complète côté capture (`app/capture-flow.tsx` — sélecteur de fichier natif à l'étape 3, `handleSubmitDocument`, `formatFileSize`, suppression du bloc "Bientôt disponible." devenu mort) + `.fileInfo` (`app/capture-flow.module.css`).
- **Décision de conception documentée et appliquée telle quelle** (cf. Dev Notes AD-5) : AC#4 ("reprend depuis le dernier point réussi") satisfaite par une retentative idempotente du fichier ENTIER (même précédent que l'audio, Story 5.2), pas une reprise par octet (TUS) — choix assumé et justifié en détail dans la story, pas une déviation silencieuse.
- **`app/projects/[id]/project-view.tsx` intentionnellement non modifié** (cf. Scope boundary de la story) : l'onglet Documents reste "Bientôt disponible." — la liste/consultation est Story 6.2.
- Aucune nouvelle dépendance npm. Aucune déviation de portée par rapport à la story (pas de nouveau composant `components/`, pas de `DocumentCard`/`DocumentDetail`).
- **Task 8 (migration SQL) exécutée et vérifiée par Guillaume** en session de suivi — version idempotente utilisée suite à un conflit sur le bucket `documents`, déjà existant côté Supabase (cf. Change Log). Succès confirmé.
- **Amendement post-review : sélection multi-fichiers** (cf. Change Log) — Guillaume a testé l'AC#1 en conditions réelles ("l'enregistrement a l'air de fonctionner") et signalé une limitation UX (une sélection remplaçait la précédente au lieu de s'accumuler). Corrigé dans `app/capture-flow.tsx`/`app/capture-flow.module.css` uniquement — `createDocument` (data/local/documents.ts) réutilisé tel quel, appelé une fois par fichier.
- **Task 17 (vérification manuelle) complétée par Guillaume en conditions réelles** : AC#1 à #4 tous vérifiés fonctionnels (y compris sélection multi-fichiers, cf. Change Log), aucune régression constatée sur les onglets Tâches/Notes ni les autres types de capture. Seul reste le nettoyage des données de test (IndexedDB + Supabase), à sa charge (aucune fonctionnalité de suppression de document n'existe encore, FR-21/Story 6.3). Statut `review` — prochaine étape recommandée : `code-review`.

### File List

**Créés :**
- `domain/document.ts`
- `data/local/document-file.ts`
- `data/local/documents.ts`
- `data/remote/document-storage.ts`
- `app/api/sync/upload-document/route.ts`

**Modifiés :**
- `domain/sync.ts` (`SyncEntity` += `"document"`, commentaire d'en-tête corrigé)
- `domain/index.ts` (+ export `Document`, `validateDocumentSize`, `MAX_DOCUMENT_SIZE_BYTES`)
- `data/local/db.ts` (+ tables `documents`/`documentFiles`, version 7)
- `data/local/index.ts` (+ export `createDocument`, `markDocumentUploaded`, `saveDocumentFile`, `getDocumentFile`)
- `data/remote/sync.ts` (+ `RemoteDocumentRow`, `documentFieldsToColumns`, `upsertDocumentFields` ; `fetchAllProjectsTasksAndNotes` renommé `fetchAllProjectsTasksNotesAndDocuments` (+ documents) ; `updateThenUpsert` étendu ; commentaire d'en-tête corrigé)
- `data/remote/index.ts` (+ export `upsertDocumentFields`, `uploadDocumentFile`, `fetchAllProjectsTasksNotesAndDocuments` renommé)
- `sync/server.ts` (+ routage entité `"document"` dans `pushQueueEntries`, `uploadDocumentBlob`, `pullRemoteSnapshot` → `fetchAllProjectsTasksNotesAndDocuments`)
- `sync/client.ts` (+ `PulledDocumentRow`, `toLocalDocument`, `pullOnce` étendu (insertion seule), `uploadPendingDocuments`, `runSyncCycle` étendu ; `AUDIO_UPLOAD_TIMEOUT_MS` renommé `BLOB_UPLOAD_TIMEOUT_MS`)
- `app/capture-flow.tsx` (+ sélecteur de fichier étape 3/type Document, `handleSubmitDocument`, `formatFileSize`, `FILE_TOO_LARGE_MESSAGE` ; suppression de `COMING_SOON_MESSAGE` et du bloc JSX associé, devenus morts ; commentaire d'en-tête mis à jour)
- `app/capture-flow.module.css` (+ `.fileInfo`)

**Migration Supabase (Task 8) : SQL prêt, exécution en attente de Guillaume**, sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (même précédent que les Stories 3.2/3.6/5.1/5.2/5.3), le SQL vit dans le texte de la Task 8 de cette story.

## Change Log

- 2026-09-02 : **Revue de code adversariale** (3 couches en parallèle — Blind Hunter, Edge Case Hunter, Acceptance Auditor — contre le diff scopé exactement aux fichiers de cette story, reconstruit manuellement faute d'historique git incrémental). 18 findings relevés, triés à 5 patch / 4 defer / 9 dismissed as noise. L'Acceptance Auditor n'a relevé aucune violation d'AC ni déviation de la spec. Les 5 patches ont tous été corrigés :
  - Échec partiel d'un lot multi-fichiers (`handleSubmitDocument`, `app/capture-flow.tsx`) : les fichiers déjà créés avec succès avant une erreur sont retirés de la sélection (`succeededCount`/`.slice()`) — un nouveau clic sur "Créer" ne resoumet plus que les fichiers non encore traités, corrige une duplication réelle en cas d'échec à mi-lot.
  - `sanitizeFileName` (`data/remote/document-storage.ts`) neutralise désormais un nom réduit à "." ou ".." après filtrage (préfixe `_`), pour ne jamais laisser un segment de chemin ambigu dans la clé Storage.
  - `formatFileSize` (`app/capture-flow.tsx`) affiche désormais en Ko sous 1 Mo plutôt qu'un trompeur "0,0 Mo" en une décimale pour tout fichier < 50 Ko.
  - `handleFilesChange` (`app/capture-flow.tsx`) distingue désormais un fichier vide (message dédié `emptyFileMessage`) d'un fichier réellement trop volumineux (`tooLargeMessage`), et efface le message d'erreur si le sélecteur est rouvert puis annulé (sélection vide) au lieu de le laisser affiché indéfiniment.
  - Les 4 findings deferred (vérification de propriété de `documentId` avant upload, garde de concurrence sur `uploadPendingDocuments`, ordre upload/métadonnées, confiance dans le type MIME client) sont tous des patterns déjà présents et acceptés pour l'audio depuis la Story 5.2, pas des déviations introduites par cette story — consignés dans `deferred-work.md`.
  - `npm run build`/`npm run lint`/`npx tsc --noEmit` propres après application des 5 patches.
  - Statut passé à `done`.
- 2026-09-02 : **Task 17 (vérification manuelle) complétée par Guillaume en conditions réelles** — AC#1 (ajout, y compris multi-fichiers), AC#2 (fichier > 20 Mo refusé), AC#3 (mode hors ligne), AC#4 (reprise après coupure réseau) tous confirmés fonctionnels ; aucune régression constatée. Reste : nettoyage des données de test (IndexedDB + Supabase), à la charge de Guillaume. Statut maintenu à `review` — prochaine étape : `code-review`.
- 2026-09-02 : **Affinage UI — contraste** (retour de vérification manuelle de Guillaume, capture d'écran à l'appui). Deux ajustements dans `app/capture-flow.tsx`/`app/capture-flow.module.css` :
  - "Choisir des fichiers" passe de `styles.ghostButton` (ton sur ton, ne se distinguait pas du fond) à `styles.primaryButton` (même poids visuel que "Créer").
  - `.primaryButton:disabled` : le bouton "Créer" grisé par opacité réduite (0.6 sur fond bleu) ne se lisait pas clairement comme désactivé. Remplacé par un fond neutre (`--color-bg-alt` clair / `--color-surface-2-dark` sombre, même paire de tokens que `.option[data-priority="low"]` pour le même besoin de contraste clair/sombre) + texte `--color-muted`. **Effet de bord assumé et documenté** : `.primaryButton` est une classe partagée par tous les boutons "Continuer"/"Créer" du flux de capture (Tâche, Note texte, Note vocale, Document) — ce changement améliore la lisibilité de l'état désactivé partout dans ce fichier, pas seulement pour Document ; aucune régression attendue (comportement `disabled` inchangé, seul le style visuel change).
  - `npm run build`/`npm run lint`/`npx tsc --noEmit` propres. **Rendu visuel confirmé par Guillaume** ("cette fois c'est bien !").
- 2026-09-02 : **Affinage UI — bouton stylé au lieu du bouton natif du navigateur** (retour de vérification manuelle de Guillaume, capture d'écran à l'appui). Le bouton natif de l'`<input type="file">` ("Sélect. fichiers" + libellé "Aucun fichier choisi") faisait doublon avec la liste des fichiers déjà sélectionnés affichée juste en dessous. Corrigé dans `app/capture-flow.tsx` : `documentFileInputRef` (nouveau ref), l'`<input>` devient `styles.visuallyHidden` (même classe déjà utilisée pour la case à cocher "Générer la transcription", Story 5.3) et un bouton `styles.ghostButton` ("Choisir des fichiers") déclenche `documentFileInputRef.current?.click()`. Aucun changement de comportement — même `handleFilesChange`/accumulation/rejet par taille qu'avant. `npm run build`/`npm run lint`/`npx tsc --noEmit` propres.
- 2026-09-02 : **Amendement de portée — sélection multi-fichiers (retour de vérification manuelle de Guillaume, Task 17).** La story et son AC#1 supposaient un seul fichier par capture ("sélectionne un fichier", texte exact d'`epics.md`/`prd.md` FR-18) — comportement d'origine confirmé fonctionnel par Guillaume ("l'enregistrement a l'air de fonctionner"), mais jugé limitant : chaque nouvelle sélection remplaçait la précédente, sans façon d'en ajouter plusieurs en une fois. Corrigé dans `app/capture-flow.tsx`/`app/capture-flow.module.css` (aucun changement `domain/`/`data/`/`sync/` — `createDocument` était déjà indépendant par fichier, il suffit de l'appeler plusieurs fois) :
  - `<input type="file">` → ajout de l'attribut `multiple` (sélection de plusieurs fichiers en un seul passage dans le sélecteur natif, ctrl/maj-clic).
  - État `documentFile: File | null` → `documentFiles: File[]` ; `handleFilesChange` (remplace `handleFileChange`) **accumule** les sélections successives au lieu de les remplacer (réinitialise `event.target.value` pour permettre de rouvrir le sélecteur plusieurs fois) — corrige précisément le problème signalé ("si j'en sélectionne un autre, ça efface le premier").
  - Fichiers > 20 Mo (AC#2) : filtrés individuellement, pas de rejet du lot entier — `tooLargeMessage()` liste nominativement le(s) fichier(s) ignoré(s), les fichiers valides restent sélectionnés.
  - Ajout d'un bouton de retrait (✕) par fichier dans la liste (`handleRemoveDocumentFile`) — nécessaire dès lors que la resélection n'efface plus tout : sans lui, corriger une sélection par erreur n'aurait plus été possible autrement qu'en abandonnant tout via "Retour".
  - `handleSubmitDocument` : boucle séquentielle sur `documentFiles` (pas `Promise.all`) — un échec à mi-lot n'annule pas les documents déjà créés avec succès, cohérent avec l'esprit local-first (ne jamais perdre une capture réussie).
  - `npm run build`/`npm run lint`/`npx tsc --noEmit` propres après ce changement.
  - AC#1 texte original ("sélectionne un fichier") non réécrit dans la section Acceptance Criteria (valeur historique, cf. précédent de la Task 8 ci-dessous) — cette entrée de Change Log fait foi de l'extension réelle à N fichiers.
- 2026-09-02 : **Task 8 exécutée et vérifiée par Guillaume** — version idempotente (cf. entrée précédente), succès confirmé. Table `public.documents`, RLS, policy, grants, et réglages du bucket Storage `documents` (privé, limite 20 Mo) en place. Reste : Task 17 (vérification manuelle du flux "+" → Document en conditions réelles).
- 2026-09-02 : **Correction Task 8** — le bucket Storage `documents` existait déjà côté Supabase (probablement créé dès la configuration initiale du projet, Story 1.1), contrairement à l'hypothèse de la story ("aucune table ni bucket n'existe encore côté Supabase pour Document"). Le SQL original (`insert into storage.buckets`, sans gestion de conflit) a échoué sur `duplicate key value violates unique constraint "buckets_pkey"`, probablement en annulant le reste du script (table/policies/grants) si Supabase l'exécute en une seule transaction. Version idempotente fournie à Guillaume en session de suivi (`create table if not exists`, `drop policy if exists` + `create policy`, `insert ... on conflict (id) do update`) — texte original de la Task 8 conservé tel quel dans les Tasks/Subtasks (valeur historique), cette note documente l'écart réel constaté à l'exécution.
- 2026-09-02 : Implémentation complète des Tasks 1 à 16 (entité Document, stockage local Dexie, passerelle Supabase Storage/Postgres, orchestration de synchronisation client/serveur, interface de capture). `npm run build`/`npm run lint`/`npx tsc --noEmit` propres. Task 8 (migration SQL Supabase) non exécutable par l'agent (aucun accès Supabase dans cette session), à la charge de Guillaume. Task 17 (vérification manuelle en conditions réelles) non réalisable au-delà de build/lint/tsc, faute d'accès Supabase/session authentifiée/fichier réel > 20 Mo dans cette session. Statut passé à `review`.
