---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 5.2: Enregistrement d'une note vocale

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want enregistrer un vocal directement dans l'app, sur téléphone comme sur ordinateur,
so that je capture une idée à l'oral sans avoir à l'écrire.

## Acceptance Criteria

1. **Given** l'étape Type du flux "+" **When** je choisis "Note vocale" et j'enregistre via le micro de mon appareil **Then** l'audio est stocké et rattaché au projet, sur mobile comme sur desktop
2. **Given** aucune connexion réseau **When** j'enregistre une note vocale **Then** l'audio est stocké localement (Dexie) et mis en file de synchronisation comme tout autre contenu
3. **Given** l'accès micro refusé par le navigateur/OS **When** je tente d'enregistrer **Then** un état dégradé explicite s'affiche ("Micro indisponible"), sans bloquer les autres types de capture

## Tasks / Subtasks

- [x] Task 1: `domain/note.ts` — étendre l'entité `Note` pour le type "voice" (AC: #1, #2 ; Capability Map 4.4)
  - [x] Ajouter `NoteType`, étendre `Note` avec `type`/`audioPath`, ajouter `MAX_AUDIO_SIZE_BYTES`/`validateAudioSize` :
    ```ts
    // domain/note.ts — entité Note et validations pures associées. FR-15 (texte, Story 5.1) et
    // FR-16 (vocal, cette story) partagent la même entité Note, distinguées par `type`. Ne
    // dépend d'aucun module HORS domain/ (cf. AD-2) — importe Priority (./capture) et Provenance
    // (./task), même précédent que domain/task.ts important Priority depuis ./capture.
    import type { Priority } from "./capture";
    import type { Provenance } from "./task";

    export type NoteType = "text" | "voice";

    export interface Note {
      id: string;
      projectId: string; // jamais null : FR-2 exige un projet pour une Note (contrairement à
        // Task.projectId, qui peut être null pour une tâche générale)
      type: NoteType; // "text" (Story 5.1) | "voice" (cette story, FR-16)
      content: string; // texte libre pour type "text" (FR-15) ; toujours "" pour type "voice"
        // jusqu'à transcription à la demande (FR-17, Story 5.3 — pas de champ transcription
        // séparé avant cette story-là, cf. domain/sync.ts et Dev Notes Story 5.1)
      audioPath: string | null; // chemin dans le bucket Supabase Storage "audio" (AD-5, AD-8) ;
        // null tant que sync/ n'a pas terminé l'upload du blob local. Toujours null pour type
        // "text". Jamais une URL complète : juste le chemin objet, une URL signée de courte
        // durée est générée à la demande côté serveur (cf. app/api/notes/[id]/audio/route.ts,
        // AD-6) — ne jamais persister d'URL signée elle-même.
      priority: Priority;
      provenance: Provenance;
      isNew: boolean;
      createdAt: string; // ISO 8601 UTC
    }

    // Un contenu composé uniquement d'espaces est traité comme vide (même règle que
    // validateTaskTitle/validateProjectName). Ne s'applique qu'au type "text" — une note vocale
    // n'a pas de contenu texte à valider (cf. validateAudioSize ci-dessous).
    export function validateNoteContent(content: string): boolean {
      return content.trim().length > 0;
    }

    // NFR-10 : 20 Mo max par fichier (document ou note vocale) — AD-5 "vérifiée à la capture".
    // Définie ici plutôt que dans un module partagé : Document (Epic 6) définira la sienne le
    // jour venu, même précédent de duplication assumée que le reste de ce fichier (cf. Dev
    // Notes — chaque story n'ajoute que ce dont elle a réellement besoin).
    export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

    export function validateAudioSize(sizeBytes: number): boolean {
      return sizeBytes > 0 && sizeBytes <= MAX_AUDIO_SIZE_BYTES;
    }

    // FR-25 : le badge "nouveau" disparaît à l'ouverture, quel que soit l'appareil — même
    // logique que openTask (domain/task.ts), dupliquée ici (entités distinctes, pas de
    // supertype partagé prématuré, cf. Dev Notes de la Story 3.3).
    export function openNote(note: Note): Note {
      return { ...note, isNew: false };
    }

    // Ordre par défaut de l'onglet Notes — même convention que sortTasksChronologically
    // (domain/task.ts). S'applique identiquement aux deux types (text/voice), cf. Dev Notes
    // Story 5.1 : les filtres de tri combinables (FR-23) restent scopés à l'onglet Tâches.
    export function sortNotes(notes: readonly Note[]): Note[] {
      return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    ```
  - [x] **Ne pas** ajouter de champ `transcription` sur `Note` dans cette story — c'est le champ conflict-tracké de la Story 5.3 (cf. domain/sync.ts, déjà anticipé dans son commentaire d'en-tête). `audioPath` n'est **pas** non plus conflict-tracké (pas de `audioPathUpdatedAt`/`audioPathSyncedAt`/`audioPathConflict`) : il n'est écrit qu'une seule fois, par `sync/client.ts` après upload réussi, jamais par l'utilisateur — cf. Dev Notes.

- [x] Task 2: `domain/index.ts` — exporter les nouveaux symboles (AC: #1, #2, #3)
  - [x] Remplacer le bloc `export { validateNoteContent, openNote, sortNotes } from "./note";` par :
    ```ts
    export {
      validateNoteContent,
      openNote,
      sortNotes,
      validateAudioSize,
      MAX_AUDIO_SIZE_BYTES,
    } from "./note";
    export type { Note, NoteType } from "./note";
    ```

- [x] Task 3: `data/local/db.ts` — nouvelle table Dexie `noteAudio` (AC: #1, #2)
  - [x] Importer le type local (pas domain — un Blob n'est pas un type que `domain/` doit connaître, cf. AD-2) : `import type { NoteAudioRecord } from "./note-audio";`. Import type-only : aucun cycle d'exécution malgré le fait que `note-audio.ts` importe `db` (valeur) depuis ce même fichier — les `import type` sont effacés à la compilation.
  - [x] Ajouter la propriété de classe `noteAudio!: EntityTable<NoteAudioRecord, "noteId">;` à côté de `notes!`.
  - [x] Ajouter une nouvelle version de schéma à la suite de `this.version(4).stores({ notes: ... })` :
    ```ts
    // Story 5.2 : nouvelle table noteAudio (FR-16, blob audio brut des notes vocales, AD-5).
    // Clé = noteId (un seul blob par note vocale). Table distincte de `notes` — jamais fusionnée
    // dans l'enregistrement Note (cf. data/local/note-audio.ts : un Blob ne doit jamais
    // transiter par le mécanisme JSON de la file de synchronisation, cf. Dev Notes).
    // `projects`/`tasks`/`syncQueue`/`notes` repris tels quels des versions précédentes, ne pas
    // les répéter ici.
    this.version(5).stores({
      noteAudio: "noteId",
    });
    ```

- [x] Task 4: `data/local/note-audio.ts` — nouveau module, stockage local du blob audio (AC: #1, #2)
  - [x] Créer `data/local/note-audio.ts` :
    ```ts
    // data/local/note-audio.ts — stockage local du blob brut d'une note vocale (FR-16, AD-5).
    // Table Dexie distincte de `notes` (data/local/db.ts, version 5) : Note (domain/note.ts)
    // reste un type pur sans dépendance Web API (cf. AD-2), et un Blob ne doit jamais transiter
    // par le mécanisme JSON de la file de synchronisation (data/local/sync-queue.ts), qui
    // sérialise ses entrées via JSON.stringify() pour /api/sync/push (cf. Dev Notes de cette
    // story). Consommée par data/local/notes.ts (écriture, à la création d'une note vocale),
    // sync/client.ts (lecture, upload différé vers Supabase Storage), et
    // app/projects/[id]/project-view.tsx (lecture, lecture audio locale).
    import type { Transaction } from "dexie";
    import { db } from "./db";

    export interface NoteAudioRecord {
      noteId: string;
      blob: Blob;
    }

    // `tx` optionnel — même pattern qu'enqueueField (data/local/sync-queue.ts) : permet d'écrire
    // le blob dans la même transaction que la note et sa file de synchronisation (cf.
    // createVoiceNote), pour ne jamais perdre l'un sans l'autre.
    export async function saveNoteAudio(
      noteId: string,
      blob: Blob,
      tx?: Transaction,
    ): Promise<void> {
      const table = tx ? tx.table<NoteAudioRecord, string>("noteAudio") : db.noteAudio;
      await table.put({ noteId, blob });
    }

    export async function getNoteAudio(noteId: string): Promise<Blob | undefined> {
      const record = await db.noteAudio.get(noteId);
      return record?.blob;
    }
    ```

- [x] Task 5: `data/local/notes.ts` — `createVoiceNote` + `markNoteAudioUploaded` (AC: #1, #2)
  - [x] Mettre à jour l'en-tête de fichier et les imports :
    ```ts
    // data/local/notes.ts — lecture/écriture Dexie pour Note (FR-15 texte, FR-16 vocal). Dépend
    // de domain/ (types) uniquement, cf. AD-2. Priorité non trackée pour conflit ici
    // (contrairement à Task.status/priority, Story 3.6) : FR-14 ne s'applique qu'à Task, cf. Dev
    // Notes Story 5.1. Le champ conflict-tracké de Note sera `transcription` (Story 5.3).
    // `audioPath` (cette story) n'est pas non plus conflict-tracké : écrit une seule fois par
    // sync/client.ts après upload réussi, jamais modifié par l'utilisateur, cf. Dev Notes.
    import { db } from "./db";
    import type { Note, Priority, Provenance } from "@/domain";
    import { validateNoteContent, validateAudioSize, openNote } from "@/domain";
    import { enqueueCreate, enqueueField } from "./sync-queue";
    import { saveNoteAudio } from "./note-audio";
    import { getDeviceId } from "@/lib/device";
    ```
  - [x] Étendre le littéral `Note` construit dans `createNote` (Story 5.1, existant) — ajouter `type: "text",` et `audioPath: null,`, et ajouter `type: note.type,` au dictionnaire de champs passé à `enqueueCreate` (juste après `projectId: note.projectId,`). Le reste de `createNote` est inchangé.
  - [x] Ajouter, à la suite de `createNote` :
    ```ts
    export interface CreateVoiceNoteInput {
      projectId: string; // toujours requis, même règle que CreateNoteInput (FR-2)
      priority: Priority;
      provenance: Provenance;
      audioBlob: Blob; // enregistrement brut du MediaRecorder (cf. app/capture-flow.tsx)
    }

    // FR-16 : capture d'une note vocale. `content` reste "" (pas de transcription avant FR-17,
    // Story 5.3) ; `audioPath` reste null jusqu'à ce que sync/client.ts termine l'upload vers
    // Supabase Storage (cf. markNoteAudioUploaded ci-dessous) — le blob lui-même est stocké
    // immédiatement en local (data/local/note-audio.ts, AD-5), dans la même transaction que la
    // note et sa file de synchronisation, pour ne jamais perdre l'un sans l'autre.
    export async function createVoiceNote(input: CreateVoiceNoteInput): Promise<Note> {
      // Revalidé ici (pas seulement côté UI, même précédent que validateNoteContent) — AD-5/
      // NFR-10 : 20 Mo max, "vérifiée à la capture". app/capture-flow.tsx coupe déjà
      // l'enregistrement en temps réel à ce plafond (cf. Dev Notes), cette garde couvre le cas
      // résiduel d'un appelant qui ne le ferait pas.
      if (!validateAudioSize(input.audioBlob.size)) {
        throw new Error("Le fichier audio dépasse la taille maximale autorisée (20 Mo).");
      }

      const now = new Date().toISOString();

      const note: Note = {
        id: crypto.randomUUID(),
        projectId: input.projectId,
        type: "voice",
        content: "",
        audioPath: null,
        priority: input.priority,
        provenance: input.provenance,
        isNew: true,
        createdAt: now,
      };

      await db.transaction("rw", db.notes, db.syncQueue, db.noteAudio, async (tx) => {
        await db.notes.add(note);
        await saveNoteAudio(note.id, input.audioBlob, tx);
        await enqueueCreate(
          "note",
          note.id,
          {
            projectId: note.projectId,
            type: note.type,
            content: note.content,
            priority: note.priority,
            provenance: note.provenance,
            isNew: note.isNew,
            createdAt: note.createdAt,
          },
          getDeviceId(),
          now,
          tx,
        );
      });

      return note;
    }
    ```
  - [x] Ajouter, après `markNoteOpened` (inchangé) :
    ```ts
    // Appelée uniquement par sync/client.ts (uploadPendingAudio) une fois l'upload du blob
    // réussi côté serveur — jamais par l'UI directement (AD-1 : toute écriture qui atteint le
    // réseau transite par sync/). Pas de garde d'idempotence façon markNoteOpened : un second
    // appel pour la même note ne devrait jamais se produire (uploadPendingAudio ne retente que
    // les notes dont audioPath est encore null), mais écraser avec la même valeur serait de
    // toute façon sans conséquence.
    export async function markNoteAudioUploaded(id: string, audioPath: string): Promise<Note> {
      return db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
        const existing = await getNoteOrThrow(id);
        const updated: Note = { ...existing, audioPath };
        await db.notes.put(updated);
        await enqueueField(
          {
            entity: "note",
            entityId: id,
            field: "audioPath",
            operation: "update",
            value: audioPath,
            deviceId: getDeviceId(),
            updatedAt: new Date().toISOString(),
          },
          tx,
        );
        return updated;
      });
    }
    ```
    (`getNoteOrThrow` déjà défini par la Story 5.1, réutilisé tel quel.)

- [x] Task 6: `data/local/index.ts` — exporter les nouveaux symboles (AC: #1, #2)
  - [x] Remplacer le bloc d'export de `./notes` par :
    ```ts
    export {
      createNote,
      createVoiceNote,
      listNotesByProject,
      markNoteOpened,
      markNoteAudioUploaded,
    } from "./notes";
    export type { CreateNoteInput, CreateVoiceNoteInput } from "./notes";
    ```
  - [x] Ajouter :
    ```ts
    export { saveNoteAudio, getNoteAudio } from "./note-audio";
    export type { NoteAudioRecord } from "./note-audio";
    ```

- [x] Task 7: Schéma Supabase — colonnes `notes` + bucket Storage `audio` + RLS (AC: #1, #2 ; AD-5, AD-8)
  - [x] Guillaume exécute cette migration SQL dans l'éditeur SQL Supabase du projet dédié (`pxdmtnysvglorwchwsmc`, cf. Stories 1.1/3.2/5.1) :
    ```sql
    -- Story 5.2 : extension du schéma Note pour les notes vocales (FR-16), au-dessus de la
    -- table notes existante (Story 5.1). Défaut 'text' sur `type` : les lignes existantes
    -- (créées avant cette migration) sont toutes des notes texte.
    alter table public.notes add column type text not null default 'text';
    alter table public.notes add column audio_path text;

    -- Bucket privé dédié à l'audio des notes vocales (AD-8 : deux buckets distincts
    -- documents/audio — celui-ci, "documents" reste pour l'Epic 6). file_size_limit en octets,
    -- aligné sur le plafond de 20 Mo (NFR-10, AD-5) en défense en profondeur — la vérification
    -- côté app (domain/note.ts validateAudioSize, appliquée en temps réel à l'enregistrement,
    -- cf. Dev Notes) reste la garde principale, celle-ci un filet supplémentaire côté serveur.
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('audio', 'audio', false, 20971520);

    -- RLS sur storage.objects : accès restreint au propriétaire, via le préfixe de dossier
    -- `{user_id}/...` du chemin de stockage (cf. data/remote/storage.ts) comparé à auth.uid().
    -- storage.objects a RLS activée par défaut sur tout projet Supabase — seules les policies
    -- manquent, contrairement aux tables applicatives (cf. migrations précédentes qui incluent
    -- explicitement `enable row level security`). Ne couvre que select/insert : aucune AC de
    -- cette story n'expose de suppression ou de remplacement d'un audio déjà envoyé.
    create policy "audio_owner_select" on storage.objects for select
      using (bucket_id = 'audio' and (select auth.uid())::text = (storage.foldername(name))[1]);
    create policy "audio_owner_insert" on storage.objects for insert
      with check (bucket_id = 'audio' and (select auth.uid())::text = (storage.foldername(name))[1]);
    ```
  - [x] Vérifier après exécution : `select type, audio_path from public.notes limit 1;` renvoie `type = 'text'` pour une note existante de la Story 5.1 ; le bucket `audio` apparaît dans Storage (privé, limite 20 Mo) ; une requête de lecture sur le bucket `audio` depuis un rôle non-propriétaire échoue/retourne vide (RLS active), même précédent de vérification que les stories précédentes.

- [x] Task 8: `data/remote/storage.ts` — nouveau module, upload + URL signée Supabase Storage (AC: #1, #2)
  - [x] Créer `data/remote/storage.ts` :
    ```ts
    import "server-only";
    import type { SupabaseClient } from "@supabase/supabase-js";

    // data/remote/storage.ts — upload et lecture des blobs audio de note vocale dans le bucket
    // Supabase Storage "audio" (FR-16, AD-5, AD-8). Séparé de data/remote/sync.ts (tables
    // Postgres) : ce fichier ne parle qu'à Supabase Storage, jamais à une table. Garde
    // "server-only" héritée transitivement de data/remote/client.ts (cf. data/remote/index.ts).
    // Chemin de stockage : `${userId}/${noteId}.<ext>` — le préfixe userId est ce que les
    // policies RLS de storage.objects comparent à auth.uid() (cf. migration SQL de cette story),
    // jamais un simple noteId à la racine du bucket.

    const AUDIO_BUCKET = "audio";

    function audioExtensionFromMimeType(mimeType: string): string {
      if (mimeType.includes("webm")) return "webm";
      if (mimeType.includes("mp4")) return "m4a";
      if (mimeType.includes("ogg")) return "ogg";
      // Repli raisonnable : MediaRecorder ne produit jamais un mimeType vide en pratique
      // (cf. app/capture-flow.tsx pickAudioMimeType), mais un upload serveur ne doit jamais
      // planter sur un type inattendu plutôt que se replier sur une extension par défaut.
      return "webm";
    }

    export async function uploadNoteAudio(
      client: SupabaseClient,
      userId: string,
      noteId: string,
      file: File,
    ): Promise<string> {
      const path = `${userId}/${noteId}.${audioExtensionFromMimeType(file.type)}`;
      const { error } = await client.storage.from(AUDIO_BUCKET).upload(path, file, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });
      if (error) {
        throw error;
      }
      return path;
    }

    // URL signée de courte durée (60s) — juste le temps que le navigateur charge l'audio suite
    // à la redirection de app/api/notes/[id]/audio/route.ts ; jamais persistée, régénérée à
    // chaque lecture (le bucket reste privé, AD-4/NFR-2 — cf. Dev Notes).
    export async function createNoteAudioSignedUrl(
      client: SupabaseClient,
      path: string,
    ): Promise<string> {
      const { data, error } = await client.storage.from(AUDIO_BUCKET).createSignedUrl(path, 60);
      if (error || !data) {
        throw error ?? new Error("Impossible de générer l'URL de lecture audio.");
      }
      return data.signedUrl;
    }
    ```

- [x] Task 9: `data/remote/sync.ts` — étendre `RemoteNoteRow`/`noteFieldsToColumns` (AC: #1, #2)
  - [x] Étendre `RemoteNoteRow` : ajouter `type: string;` et `audio_path: string | null;` à l'interface existante.
  - [x] Étendre `noteFieldsToColumns` : ajouter, après `if ("projectId" in fields) columns.project_id = fields.projectId;` :
    ```ts
    if ("type" in fields) columns.type = fields.type;
    if ("audioPath" in fields) columns.audio_path = fields.audioPath;
    ```
  - [x] `fetchAllProjectsTasksAndNotes` : aucun changement — `select("*")` récupère déjà les nouvelles colonnes automatiquement.

- [x] Task 10: `data/remote/index.ts` — exporter le nouveau module (AC: #1, #2)
  - [x] Ajouter :
    ```ts
    export { uploadNoteAudio, createNoteAudioSignedUrl } from "./storage";
    ```

- [x] Task 11: `sync/server.ts` — wrappers upload/URL de lecture (AC: #1, #2)
  - [x] Étendre l'import : `import { uploadNoteAudio, createNoteAudioSignedUrl } from "@/data/remote/storage";`.
  - [x] Ajouter, à la suite de `pullRemoteSnapshot` :
    ```ts
    export async function uploadNoteAudioBlob(
      client: SupabaseClient,
      userId: string,
      noteId: string,
      file: File,
    ): Promise<string> {
      return uploadNoteAudio(client, userId, noteId, file);
    }

    // Vérifie que la note appartient bien à l'utilisateur courant via une lecture RLS (client
    // scopé session, jamais le client à privilèges élevés) avant de générer une URL signée —
    // une note inexistante ou sans audio_path renvoie null plutôt que de lever, laissant la
    // route handler répondre 404 (cf. app/api/notes/[id]/audio/route.ts).
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
    ```

- [x] Task 12: `app/api/sync/upload-audio/route.ts` — nouvelle route (AC: #1, #2)
  - [x] Créer `app/api/sync/upload-audio/route.ts` :
    ```ts
    import { createSupabaseServerClient } from "@/data/remote/client";
    import { uploadNoteAudioBlob } from "@/sync/server";

    // app/api/sync/upload-audio/route.ts — reçoit le blob audio d'une note vocale en attente
    // (multipart/form-data, pas JSON : un Blob ne passe pas par JSON.stringify(), cf. Dev Notes
    // de cette story) et le téléverse vers Supabase Storage via sync/server.ts (AD-6). Protégé
    // par proxy.ts comme toute autre route /api/sync/* (cf. Dev Notes Story 3.2).
    export async function POST(request: Request) {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase.auth.getClaims();
      if (!data) {
        return new Response(null, { status: 401 });
      }

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return new Response(null, { status: 400 });
      }

      const noteId = formData.get("noteId");
      const file = formData.get("file");
      if (typeof noteId !== "string" || !(file instanceof File)) {
        return new Response(null, { status: 400 });
      }

      try {
        const path = await uploadNoteAudioBlob(supabase, data.claims.sub as string, noteId, file);
        return Response.json({ path });
      } catch {
        return new Response(null, { status: 500 });
      }
    }
    ```
  - [x] `data.claims.sub` est l'équivalent de `auth.uid()` côté client de session (JWT claims retournés par `getClaims()`, champ standard `sub`) — même utilisateur que celui que Postgres remplit via `default auth.uid()` sur les tables applicatives (cf. migrations précédentes). Ne jamais faire confiance à un `userId` fourni par le corps de la requête.

- [x] Task 13: `app/api/notes/[id]/audio/route.ts` — nouvelle route (AC: #1)
  - [x] Créer `app/api/notes/[id]/audio/route.ts` :
    ```ts
    import { createSupabaseServerClient } from "@/data/remote/client";
    import { getNoteAudioPlaybackUrl } from "@/sync/server";

    // app/api/notes/[id]/audio/route.ts — redirige vers une URL signée de courte durée pour la
    // lecture d'une note vocale (AD-6 : seul le serveur parle à Supabase Storage). Utilisée
    // directement comme `src` d'un élément <audio> (app/projects/[id]/project-view.tsx,
    // NoteDetail) — un <audio> suit une redirection 302 de façon transparente, le client n'a
    // donc jamais besoin de connaître l'URL signée elle-même.
    export async function GET(_request: Request, ctx: RouteContext<"/api/notes/[id]/audio">) {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase.auth.getClaims();
      if (!data) {
        return new Response(null, { status: 401 });
      }

      const { id } = await ctx.params;
      const url = await getNoteAudioPlaybackUrl(supabase, id);
      if (!url) {
        return new Response(null, { status: 404 });
      }

      return Response.redirect(url, 302);
    }
    ```
  - [x] `RouteContext<"/api/notes/[id]/audio">` — helper de typage global généré par Next.js (`next dev`/`next build`/`next typegen`), même convention que `PageProps<"/projects/[id]">` déjà utilisé par `app/projects/[id]/page.tsx` ; aucun import nécessaire.

- [x] Task 14: `sync/client.ts` — pull `type`/`audio_path` + upload différé des blobs (AC: #1, #2)
  - [x] Étendre `PulledNoteRow` : ajouter `type: string;` et `audio_path: string | null;`.
  - [x] Mettre à jour `toLocalNote` :
    ```ts
    // Note n'a aucun champ conflict-tracké dans cette story (cf. domain/note.ts, Dev Notes
    // Story 5.1) — conversion directe, pas de *SyncedAt/*Conflict à peupler (contrairement à
    // toLocalTask). `audioPath` reflète l'état distant tel quel : si non encore uploadé
    // ailleurs, reste null localement aussi (uploadPendingAudio ci-dessous ne le tentera pas
    // depuis cet appareil s'il n'a jamais eu le blob localement, cf. Dev Notes).
    function toLocalNote(row: PulledNoteRow): Note {
      return {
        id: row.id,
        projectId: row.project_id,
        type: row.type as Note["type"],
        content: row.content,
        audioPath: row.audio_path,
        priority: row.priority as Note["priority"],
        provenance: row.provenance as Note["provenance"],
        isNew: row.is_new,
        createdAt: row.created_at,
      };
    }
    ```
  - [x] Étendre le typage du snapshot dans `pullOnce` : `notes: PulledNoteRow[]` (déjà présent, juste le type de `PulledNoteRow` change).
  - [x] Étendre l'import : `import { db, listPendingAndError, markSyncing, markSucceeded, markFailed, resetErrorsToPending, resetStaleSyncingToPending, getNoteAudio, markNoteAudioUploaded } from "@/data/local";`.
  - [x] Rendre le délai de `fetchWithTimeout` paramétrable (troisième argument optionnel, défaut inchangé) :
    ```ts
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
    ```
  - [x] Ajouter, avant `let queueInFlight = false;` :
    ```ts
    // Upload d'un blob volumineux : délai plus généreux que FETCH_TIMEOUT_MS (15s, calibré pour
    // le JSON de la file de synchronisation) — jusqu'à 20 Mo (NFR-10) sur une connexion lente.
    const AUDIO_UPLOAD_TIMEOUT_MS = 60_000;

    // Notes vocales dont le blob local n'a pas encore été téléversé vers Supabase Storage
    // (audioPath encore null) — étape distincte du flux générique de la file de synchronisation
    // (data/local/sync-queue.ts) : un Blob ne peut pas transiter par JSON.stringify() (cf. Dev
    // Notes de cette story, /api/sync/push reçoit du JSON). Appelée dans runSyncCycle avant
    // processQueue() : une fois l'upload réussi, audioPath est mis en file (enqueueField, via
    // markNoteAudioUploaded) et repoussé au serveur par le mécanisme générique existant, au même
    // cycle. Pas de compteur de tentatives dédié (contrairement à data/local/sync-queue.ts
    // attempts/MAX_SYNC_ATTEMPTS) — un simple filtre "audioPath === null" ; NFR-5 (reprise
    // depuis le dernier point réussi pour un upload interrompu) explicitement hors périmètre de
    // cette story, cf. Dev Notes.
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
            AUDIO_UPLOAD_TIMEOUT_MS,
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
    ```
  - [x] Étendre `runSyncCycle` :
    ```ts
    async function runSyncCycle(): Promise<void> {
      if (syncCycleInFlight) {
        return;
      }
      syncCycleInFlight = true;
      try {
        await pullOnce();
        await uploadPendingAudio();
        await processQueue();
      } finally {
        syncCycleInFlight = false;
      }
    }
    ```

- [x] Task 15: `app/capture-flow.tsx` — enregistrement micro (AC: #1, #2, #3)
  - [x] Étendre les imports : `validateAudioSize` au bloc de fonctions `@/domain`, `createVoiceNote` à l'import `@/data/local`.
  - [x] Ajouter les constantes, à côté de `NOTE_CONTENT_REQUIRED_MESSAGE` :
    ```ts
    const MIC_UNAVAILABLE_MESSAGE =
      "Micro indisponible — les autres captures restent possibles.";
    const AUDIO_SIZE_CAPPED_MESSAGE =
      "Enregistrement arrêté : taille maximale de 20 Mo atteinte.";
    const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

    function pickAudioMimeType(): string | undefined {
      if (typeof MediaRecorder === "undefined") {
        return undefined;
      }
      return AUDIO_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    }

    function formatRecordingTime(totalSeconds: number): string {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    ```
  - [x] Ajouter les états/refs, à la suite de `noteContentError` :
    ```ts
    type MicState = "idle" | "requesting" | "recording" | "recorded" | "unavailable";
    const [micState, setMicState] = useState<MicState>("idle");
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [audioSizeCapped, setAudioSizeCapped] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordedBytesRef = useRef(0);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    ```
  - [x] Ajouter, à la suite de `clearSuccessTimeout` :
    ```ts
    function stopRecordingStream() {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
    ```
  - [x] Ajouter un effet de nettoyage au démontage, à la suite de l'effet existant qui nettoie `successTimeoutRef` :
    ```ts
    useEffect(() => {
      return () => {
        stopRecordingStream();
      };
    }, []);
    ```
  - [x] Ajouter un effet créant/révoquant l'URL de prévisualisation, à la suite des effets existants :
    ```ts
    useEffect(() => {
      if (!recordedBlob) {
        setRecordedAudioUrl(null);
        return;
      }
      const url = URL.createObjectURL(recordedBlob);
      setRecordedAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }, [recordedBlob]);
    ```
  - [x] Étendre `resetState()` — ajouter :
    ```ts
    stopRecordingStream();
    setMicState("idle");
    setRecordedBlob(null);
    setRecordingSeconds(0);
    setAudioSizeCapped(false);
    audioChunksRef.current = [];
    recordedBytesRef.current = 0;
    ```
  - [x] Étendre `handleBackToTypeSelection` — ajouter les mêmes lignes que `resetState` ci-dessus (sauf `setStep`), avant `setType(null); setPendingType(null);` existants : ce bouton est aussi utilisé pour abandonner un enregistrement en cours, la capture ne doit jamais continuer en arrière-plan après un "Retour".
  - [x] Étendre la dépendance de l'effet de focus automatique existant : `[open, step, type, success]` → `[open, step, type, success, micState]` (les boutons visibles changent avec `micState` au sein de l'étape 3).
  - [x] Ajouter, à la suite de `handleSubmitNote` :
    ```ts
    async function handleStartRecording() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setMicState("unavailable");
        return;
      }

      setMicState("requesting");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Refus utilisateur (NotAllowedError) ou aucun micro disponible (NotFoundError) — même
        // état dégradé dans les deux cas (AC#3, NFR-4) : aucune distinction utile pour Guillaume.
        setMicState("unavailable");
        return;
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordedBytesRef.current = 0;
      setAudioSizeCapped(false);

      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) {
          return;
        }
        recordedBytesRef.current += event.data.size;
        audioChunksRef.current.push(event.data);
        // Coupure en temps réel au plafond (NFR-10, AD-5 "vérifiée à la capture") — plutôt que
        // de laisser un enregistrement dépasser 20 Mo puis le rejeter entièrement à l'arrêt.
        if (recordedBytesRef.current > MAX_AUDIO_SIZE_BYTES) {
          setAudioSizeCapped(true);
          recorder.stop();
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mimeType ?? audioChunksRef.current[0]?.type ?? "audio/webm",
        });
        setRecordedBlob(blob);
        setMicState("recorded");
        stopRecordingStream();
      };

      recorder.start();
      setMicState("recording");
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    }

    function handleStopRecording() {
      mediaRecorderRef.current?.stop();
    }

    function handleDiscardRecording() {
      setRecordedBlob(null);
      setRecordingSeconds(0);
      setAudioSizeCapped(false);
      audioChunksRef.current = [];
      recordedBytesRef.current = 0;
      setMicState("idle");
    }

    async function handleSubmitVoiceNote() {
      if (pending || !recordedBlob) {
        return;
      }

      setSubmitError(undefined);
      setPending(true);

      try {
        // projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject("voice-note")
        // est true, même garde-fou que pour "note-text" (cf. Story 5.1, handleTypeContinue).
        await createVoiceNote({
          projectId: projectSelection as string,
          priority: priority as Priority,
          provenance: detectProvenance(),
          audioBlob: recordedBlob,
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
  - [x] Dans `stepTitle()`, ajouter avant le `return "Que voulez-vous créer ?";` final : `if (type === "voice-note") { return "Nouvelle note vocale"; }`.
  - [x] Remplacer la condition du bloc "Bientôt disponible." : `type !== "task" && type !== "note-text"` → `type !== "task" && type !== "note-text" && type !== "voice-note"` (ne couvre plus que `document`).
  - [x] Étendre la condition du bloc succès : `(type === "task" || type === "note-text")` → `(type === "task" || type === "note-text" || type === "voice-note")`.
  - [x] Ajouter, après le bloc `{step === 3 && type === "note-text" && !success && (...)}` existant :
    ```tsx
    {step === 3 && type === "voice-note" && !success && (
      <div className={styles.stepBody}>
        {micState === "unavailable" && (
          <p className={styles.error} role="alert">
            {MIC_UNAVAILABLE_MESSAGE}
          </p>
        )}

        {(micState === "idle" || micState === "requesting") && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleStartRecording}
              disabled={pending || micState === "requesting"}
            >
              Démarrer l&apos;enregistrement
            </button>
          </div>
        )}

        {micState === "recording" && (
          <div className={styles.recordingRow}>
            <span className={styles.recordingDot} aria-hidden="true" />
            <span className={styles.recordingTimer} role="status" aria-live="polite">
              {formatRecordingTime(recordingSeconds)}
            </span>
            <button type="button" className={styles.primaryButton} onClick={handleStopRecording}>
              Arrêter
            </button>
          </div>
        )}

        {micState === "recorded" && recordedAudioUrl && (
          <div className={styles.field}>
            {audioSizeCapped && (
              <p className={styles.error} role="alert">
                {AUDIO_SIZE_CAPPED_MESSAGE}
              </p>
            )}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- lecture seule, pas de piste de sous-titres pertinente pour une note vocale personnelle */}
            <audio className={styles.audioPreview} controls src={recordedAudioUrl} />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={handleDiscardRecording}
                disabled={pending}
              >
                Recommencer
              </button>
            </div>
          </div>
        )}

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
          {micState === "recorded" && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSubmitVoiceNote}
              disabled={pending}
            >
              Créer
            </button>
          )}
        </div>
      </div>
    )}
    ```

- [x] Task 16: `app/capture-flow.module.css` — styles de l'enregistrement (AC: #1, #3)
  - [x] Ajouter, à la fin du fichier :
    ```css
    /* Enregistrement en cours (Story 5.2, FR-16) — pastille rouge clignotante + minuteur, pas
       de mockup dédié (comme le formulaire Note texte, Story 5.1) : réutilise field/actions/
       primaryButton/ghostButton existants, seuls le point animé et le minuteur sont nouveaux. */
    .recordingRow {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .recordingDot {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
      background: var(--color-danger);
      animation: recording-pulse 1.2s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .recordingDot {
        animation: none;
      }
    }

    @keyframes recording-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .recordingTimer {
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    .audioPreview {
      width: 100%;
    }
    ```

- [x] Task 17: `app/projects/[id]/project-view.tsx` — carte/détail de note vocale (AC: #1)
  - [x] Étendre l'import `@/data/local` : ajouter `getNoteAudio`.
  - [x] Ajouter la constante, à côté de `NOTES_LOAD_ERROR_MESSAGE` : `const AUDIO_NOT_YET_AVAILABLE_MESSAGE = "Audio en cours de synchronisation.";`.
  - [x] Dans `NoteCard`, remplacer `<span className={styles.noteContent}>{note.content}</span>` par :
    ```tsx
    {note.type === "voice" ? (
      <span className={styles.noteContent}>Note vocale</span>
    ) : (
      <span className={styles.noteContent}>{note.content}</span>
    )}
    ```
  - [x] Dans `NoteDetail`, ajouter un état + effet de lecture locale, à la suite de `closeButtonRef` :
    ```ts
    const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);

    // Lecture locale prioritaire (Story 5.2) : le blob a été enregistré sur cet appareil, la
    // lecture fonctionne hors ligne sans dépendre de l'upload. Un appareil qui n'a jamais eu le
    // blob localement (note créée ailleurs) retombe sur app/api/notes/[id]/audio (cf. Dev Notes).
    useEffect(() => {
      if (!note || note.type !== "voice") {
        setLocalAudioUrl(null);
        return;
      }
      let cancelled = false;
      let objectUrl: string | null = null;
      getNoteAudio(note.id).then((blob) => {
        if (cancelled || !blob) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setLocalAudioUrl(objectUrl);
      });
      return () => {
        cancelled = true;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }, [note?.id, note?.type]);
    ```
  - [x] Remplacer `<p className={styles.detailDescription}>{note.content}</p>` par :
    ```tsx
    {note.type === "voice" ? (
      localAudioUrl || note.audioPath ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- lecture seule, pas de piste de sous-titres pertinente pour une note vocale personnelle
        <audio
          className={styles.audioPreview}
          controls
          src={localAudioUrl ?? `/api/notes/${note.id}/audio`}
        />
      ) : (
        <p className={styles.detailDescription}>{AUDIO_NOT_YET_AVAILABLE_MESSAGE}</p>
      )
    ) : (
      <p className={styles.detailDescription}>{note.content}</p>
    )}
    ```
    (`localAudioUrl` prioritaire sur `note.audioPath` : le second n'est utilisé comme source `<audio>` que si le premier est absent, cf. Dev Notes.)

- [x] Task 18: `app/projects/[id]/project-view.module.css` — style du lecteur (AC: #1)
  - [x] Ajouter, à la suite de `.noteContent` :
    ```css
    .audioPreview {
      width: 100%;
    }
    ```

- [ ] Task 19: Vérification manuelle de bout en bout (AC #1, #2, #3)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Exécuter la migration SQL de la Task 7 sur le projet Supabase avant toute vérification réseau/synchro. *(Exécutée par Guillaume, vérifiée — cf. Debug Log.)*
  - [x] **AC#3** : dans le flux "+", choisir "Note vocale" à l'étape 3, "Démarrer l'enregistrement" → accès micro refusé (bloqué par l'environnement de vérification) → message "Micro indisponible — les autres captures restent possibles." affiché tel quel. "Retour" ramène à la sélection de type, où "Note texte"/"Tâche"/"Document" restent pleinement sélectionnables (non-régression Story 3.1/5.1). **Vérifié en conditions réelles.**
  - [x] **AC#1 (stockage, rattachement au projet, upload, synchronisation)** : la capture réelle d'un enregistrement microphone n'a pas pu être déclenchée par un geste utilisateur dans cette session (accès micro bloqué par l'environnement de vérification, cf. AC#3). Le reste du chemin AC#1 a été vérifié directement contre production, en pilotant les mêmes routes serveur que le code applicatif : écriture locale (note `type: "voice"` + blob dans `db.noteAudio` + entrées `syncQueue`, y compris `type`) ; `POST /api/sync/upload-audio` → fichier réellement déposé dans le bucket Storage `audio` au chemin `{user_id}/{noteId}.webm` ; `POST /api/sync/push` → ligne `notes` réelle créée côté Postgres avec `type = 'voice'`, `project_id` correctement rattaché ; `GET /api/sync/pull` → snapshot distant renvoie la ligne avec `type`/`audio_path` corrects. **Le moteur de synchronisation réel de l'app (`sync/client.ts`, cycle automatique de 30s, code non modifié pour le test) a lui-même détecté la note en attente, réessayé l'upload, et convergé `audioPath` en local sans intervention** — confirmant `uploadPendingAudio`/`markNoteAudioUploaded` en conditions réelles, pas seulement par appel manuel. **Bug réel trouvé et corrigé pendant cette vérification** : le premier essai d'upload répété par le moteur de synchro échouait avec un 500 (`upsert: false` sur un chemin déjà occupé par un envoi précédent) — corrigé dans `data/remote/storage.ts` (cf. Debug Log), revérifié après correction : succès. Reste non vérifiable sans appareil réel : l'enregistrement effectif d'un son audible via `MediaRecorder`/micro physique.
  - [ ] **AC#1 (parité desktop/mobile)** : non testé (aucun accès micro réel disponible pour comparer les deux form factors en conditions réelles).
  - [x] **Lecture croisée entre appareils** : `GET /api/notes/[id]/audio` vérifié directement — `redirect: "manual"` confirme une redirection (`opaqueredirect`), et un `fetch` classique confirme la redirection finale vers `pxdmtnysvglorwchwsmc.supabase.co`, `200 OK`, `content-type: audio/webm`, et les octets reçus identiques (byte pour byte) au fichier uploadé. Rendu UI confirmé aussi : `NoteDetail` affiche un `<audio controls>` fonctionnel pour une note vocale (blob local prioritaire sur cet appareil, cf. capture d'écran). Le cas "aucun blob local, appareil différent" est validé côté route serveur (le contenu vient bien de Supabase Storage, pas d'IndexedDB) mais pas depuis un second profil authentifié distinct.
  - [ ] **AC#2 (hors ligne)** : non basculé en mode Offline dans cette session — l'écriture locale-first (`createVoiceNote` n'effectue aucun appel réseau, uniquement des écritures Dexie) et le déclenchement différé de la synchronisation (`runSyncCycle`, gated par `navigator.onLine`/événement `online`) sont un mécanisme déjà éprouvé par les Stories 3.2/5.1 et vérifié par lecture de code pour cette story ; non re-testé manuellement offline→online spécifiquement pour le chemin audio.
  - [ ] **Plafond de taille (NFR-10)** : non testé avec un enregistrement réel prolongé (pas d'accès micro) — vérifié uniquement par lecture de code (`ondataavailable`/`recordedBytesRef`, cf. Task 15).
  - [x] Vérifier la non-régression : capture de tâche (Story 3.1, tri combinable Story 3.4, statut Story 3.5) et note texte (Story 5.1) confirmées fonctionnelles dans l'onglet Tâches/Notes du projet réel "Test Story 4.1" ; onglet Notes affiche note texte et note vocale mélangées, triées par date ; onglet Documents toujours "Bientôt disponible." ; indicateur de synchronisation "À jour" correct. Aucune erreur console une fois le bug d'upload corrigé (les erreurs 500 observées avant la correction ont cessé après ; un `ChunkLoadError`/des échecs `net::ERR_FAILED` initiaux causés par un service worker (Serwist) obsolète dans cette session de vérification — sans rapport avec cette story, résolu en désenregistrant le service worker).
  - [ ] Vérifier l'accessibilité : non testé exhaustivement (ordre de focus clavier, annonces `aria-live` en conditions réelles) — cible tactile et structure ARIA confirmées correctes par lecture de code et rendu visuel (captures d'écran), mais pas par un parcours clavier/lecteur d'écran réel.
  - [x] **Contrainte connue de cette session, confirmée** : l'environnement de vérification a effectivement bloqué l'accès micro réel (`getUserMedia` rejeté, notifié explicitement par l'outillage) — AC#3 et l'intégralité du pipeline stockage/upload/synchro/lecture ont pu être vérifiés en conditions réelles contre Supabase en pilotant directement les routes serveur ; seule la capture microphone elle-même (geste utilisateur + `MediaRecorder` + son réellement audible) reste à vérifier par Guillaume sur un appareil réel.
  - [x] Supprimer les données de test : note de test (id `63b56478-174f-4420-a38d-63f8f8deb969`) supprimée d'IndexedDB par l'agent en fin de vérification. **Reste à supprimer par Guillaume** (aucune fonctionnalité de suppression de note n'existe dans l'app, même limite que les stories précédentes) : la ligne correspondante dans `public.notes` et le fichier `5dc752f6-1bee-44ce-88ca-0654b7397314/63b56478-174f-4420-a38d-63f8f8deb969.webm` dans le bucket `audio` du dashboard Supabase.

### Review Findings

Revue à trois couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor) contre un diff reconstruit isolant précisément les 17 fichiers de cette story. 14 `patch`, 0 `decision-needed`, 7 `defer`, 2 findings écartés (déjà mitigés ailleurs — cf. détail ci-dessous et `deferred-work.md`).

**Patch**

- [x] [Review][Patch] Coupure "temps réel" à 20 Mo inopérante — `MediaRecorder.start()` sans `timeslice` [app/capture-flow.tsx:~904]
- [x] [Review][Patch] Micro non coupé si le flux est fermé via "✕" pendant l'enregistrement (ou pendant la demande de permission) [app/capture-flow.tsx: `closeFlow`]
- [x] [Review][Patch] Aucun `onerror` sur le `MediaRecorder` — panne mi-enregistrement laisse `micState` bloqué [app/capture-flow.tsx]
- [x] [Review][Patch] `stopRecordingStream()` ne stoppe jamais le `MediaRecorder` lui-même (seulement les pistes) [app/capture-flow.tsx:~754]
- [x] [Review][Patch] Construction de `new MediaRecorder()` non protégée par try/catch — fuite du flux acquis si elle lève [app/capture-flow.tsx:~878]
- [x] [Review][Patch] Aucune garde de réentrance sur `handleStartRecording` (double-clic rapide) [app/capture-flow.tsx:~850]
- [x] [Review][Patch] Résolution tardive de `getUserMedia` après abandon de l'étape (Retour vers un autre type, ou fermeture) rouvre le micro sur une étape déjà quittée [app/capture-flow.tsx]
- [x] [Review][Patch] Message trompeur pour un enregistrement vide (annonce "taille dépassée" au lieu de "vide") [data/local/notes.ts:~235, app/capture-flow.tsx]
- [x] [Review][Patch] `data.claims.sub as string` casté sans validation [app/api/sync/upload-audio/route.ts:~634]
- [x] [Review][Patch] `isAlreadyExistsError` — regex un peu trop large sur `error.message` [data/remote/storage.ts:~402]
- [x] [Review][Patch] Commentaire de `audioExtensionFromMimeType` présente une hypothèse comme une garantie [data/remote/storage.ts:~385]
- [x] [Review][Patch] `db.ts` version(5) sans migration `.upgrade()` pour renseigner `type`/`audioPath` sur les notes texte locales existantes (Story 5.1) [data/local/db.ts]
- [x] [Review][Patch] Validation légère du format UUID de `noteId` avant utilisation dans le chemin de stockage [app/api/sync/upload-audio/route.ts]
- [x] [Review][Patch] Aucun retour visible si `/api/notes/[id]/audio` échoue (404/réseau) sur le lecteur de repli [app/projects/[id]/project-view.tsx:~1222]

**Defer**

- [x] [Review][Defer] Pas de plafond de tentatives sur `uploadPendingAudio` (contrairement à la file de synchro) [sync/client.ts] — déjà documenté comme décision de portée volontaire (NFR-5) dans les Dev Notes de cette story, pas un oubli silencieux.
- [x] [Review][Defer] Boucle d'upload séquentielle bloquante dans le cycle de synchro [sync/client.ts] — inhérent à la simplicité assumée du design, aucune AC n'exige un traitement concurrent.
- [x] [Review][Defer] "Audio en cours de synchronisation" identique pour un upload réellement en cours vs définitivement perdu [app/projects/[id]/project-view.tsx] — cohérent avec l'indicateur de synchro global déjà simple (Story 3.2), aucun état d'échec par élément n'existe ailleurs dans l'app.
- [x] [Review][Defer] Aucun nettoyage du blob local après upload réussi (croissance non bornée) [data/local/note-audio.ts] — cohérent avec l'absence totale de fonctionnalité de suppression de note dans l'app.
- [x] [Review][Defer] Aucune vérification que `noteId` appartient à une note vocale existante avant l'upload [app/api/sync/upload-audio/route.ts] — réel en général, mais l'app est architecturalement mono-utilisateur (AD-9, un seul compte, aucun système de permissions) : aucune exploitation inter-utilisateur possible, tout au plus un objet Storage orphelin auto-infligé.
- [x] [Review][Defer] `toLocalNote` caste `row.type` sans validation [sync/client.ts] — prolonge un pattern déjà établi et déjà consigné en dette (Story 3.2 : `priority`/`provenance`/`status` distants castés sans validation), pas une nouvelle déviation.
- [x] [Review][Defer] `NoteDetail` peut faire basculer la source audio de l'URL distante vers le blob local juste après montage [app/projects/[id]/project-view.tsx] — fenêtre de quelques millisecondes, coupure de lecture cosmétique au pire.

**Écartés (déjà mitigés)**

- Absence de validation de taille côté serveur sur `/api/sync/upload-audio` — en réalité déjà appliquée : le bucket Storage `audio` porte `file_size_limit: 20971520` (migration Task 7), imposé par Supabase Storage lui-même indépendamment du code applicatif.
- Fuite d'URL objet sous StrictMode via le `useMemo` de `recordedAudioUrl` — ne se manifeste qu'en mode développement (double-invocation React), jamais en production ; revenir à un `useEffect` réintroduirait l'erreur de lint `react-hooks/set-state-in-effect` déjà corrigée dans cette même session.

## Dev Notes

**Portée exacte de cette story.** Epic 5 couvre FR-15 à FR-17 en 3 stories : Story 5.1 (faite) couvrait FR-15 (note texte). Cette story (5.2) couvre exactement FR-16 (enregistrement d'une note vocale : capture, stockage local, upload vers Supabase Storage, file de synchronisation hors ligne, dégradation gracieuse si micro refusé). FR-17 (transcription à la demande, Story 5.3) reste explicitement hors périmètre — **ne pas ajouter de champ `transcription` sur `Note` dans cette story**, même si `domain/sync.ts` l'anticipe déjà dans son commentaire d'en-tête ("Note.transcription s'y ajoutera en Epic 5"). Le champ `content` d'une note vocale reste `""` jusqu'à cette story future.

**Pourquoi l'upload du blob audio est un mécanisme séparé de la file de synchronisation générique.** `data/local/sync-queue.ts` sérialise chaque entrée en JSON (`JSON.stringify(entries)`) pour `POST /api/sync/push` — un `Blob` ne survit pas à `JSON.stringify()` (il sérialise en `{}`). AD-5 le confirme explicitement : *"Les blobs (audio de note vocale, fichiers document) sont stockés directement dans Dexie jusqu'à upload réussi vers Supabase Storage par `sync/`."* — un chemin distinct, pas une extension du format d'entrée existant. Décision retenue : le blob est stocké dans une table Dexie séparée (`data/local/note-audio.ts`, jamais dans l'enregistrement `Note` lui-même — `domain/note.ts` reste un type pur sans dépendance Web API, cf. AD-2), téléversé via `multipart/form-data` vers une route dédiée (`POST /api/sync/upload-audio`, jamais JSON), puis — une fois l'upload réussi — le **chemin** de stockage obtenu (une simple chaîne, trivialement sérialisable) est mis en file via le mécanisme `enqueueField` générique existant (`field: "audioPath"`) et repoussé vers Postgres par le chemin déjà en place (`upsertNoteFields`/`noteFieldsToColumns`, étendu ici). Aucune modification du format d'enveloppe de la file (`ARCHITECTURE-SPINE.md` Consistency Conventions) n'était nécessaire — elle continue de ne transporter que des valeurs JSON-sérialisables.

**Pourquoi `audioPath` n'est pas conflict-tracké (pas de `*UpdatedAt`/`*SyncedAt`/`*Conflict`).** AD-3 liste les binds exacts : *"Task.status, priority partagée Task/Note/Document, Note.transcription"* — `audioPath` n'y figure pas et ne devrait jamais y figurer : il n'est écrit qu'une seule fois par le moteur de synchronisation lui-même après un upload réussi (jamais par une action utilisateur), passe de `null` à une valeur définitive, et ne change plus jamais ensuite. Aucun scénario de modification concurrente sur deux appareils n'existe pour ce champ (contrairement à `Task.status`/`priority`, modifiables directement par l'utilisateur sur n'importe quel appareil). Un simple `enqueueField`/`upsertNoteFields` suffit, même mécanisme que `content`/`provenance` à la création.

**Chemin de stockage Supabase Storage : `{user_id}/{noteId}.<ext>`, jamais `{noteId}.<ext>` à la racine.** Le préfixe `user_id` est ce que les policies RLS de `storage.objects` (Task 7) comparent à `auth.uid()` via `(storage.foldername(name))[1]` — c'est le mécanisme RLS standard de Supabase Storage pour restreindre l'accès par dossier, même esprit que les policies `using ((select auth.uid()) = user_id)` des tables Postgres (AD-4), transposé au système de fichiers de Storage qui n'a pas de colonne `user_id` propre. Bucket créé **privé** (`public: false`) — cohérent avec NFR-2 (confidentialité), aucun fichier audio n'est jamais accessible par une URL publique permanente, uniquement par URL signée de 60 secondes régénérée à la demande (cf. ci-dessous).

**Lecture audio : blob local en priorité, URL signée serveur en repli.** Sur l'appareil qui a enregistré la note, le blob existe déjà en local (`data/local/note-audio.ts`) — la lecture fonctionne immédiatement et hors ligne via `URL.createObjectURL()`, sans dépendre du réseau ni de l'upload. Sur un autre appareil (note reçue par pull), aucun blob local n'existe jamais — la lecture passe par `app/api/notes/[id]/audio/route.ts`, qui génère une URL signée côté serveur (AD-6 : seul le code serveur parle à Supabase Storage) et redirige (302) l'élément `<audio>` vers elle. Ce choix (route de redirection plutôt que retourner l'URL signée en JSON puis la réinjecter en `src`) évite tout aller-retour supplémentaire côté client — `<audio src="/api/notes/[id]/audio">` suit la redirection nativement. Sans cette route, une note vocale créée sur un appareil serait définitivement inécoutable depuis tout autre appareil — c'eût été un système "capture ici, jamais consultable ailleurs", contraire à UJ-2 (*"Guillaume... retrouve le vocal de la veille... prêt à être traité"*) et à la promesse même d'Epic 5. Considéré comme faisant partie du périmètre réel de cette story (le système doit rester utilisable de bout en bout, cf. principe déjà appliqué aux Stories précédentes), même si aucune AC littérale de 5.2 ne teste explicitement la lecture cross-appareil.

**NFR-5 (reprise d'un upload interrompu depuis le dernier point réussi) explicitement hors périmètre de cette story.** Le PRD marque cette NFR `[ASSUMPTION]` (non confirmée) et aucune AC de cette story ne teste un scénario de reprise partielle. L'implémentation retenue ici est une reprise "depuis zéro" à chaque cycle de synchronisation tant que `audioPath` reste `null` (`uploadPendingAudio`, `sync/client.ts`) — suffisant pour AC#2 ("mis en file de synchronisation comme tout autre contenu", pas "reprend un upload partiel"). Un vrai upload reprenable nécessiterait un protocole par morceaux (ex. upload resumable TUS, supporté par Supabase Storage via une bibliothèque dédiée non présente dans les dépendances actuelles) — introduire cette dépendance et cette complexité sans AC qui la teste serait une anticipation non demandée (cf. `ARCHITECTURE-SPINE.md` Deferred : la spine elle-même ne fige pas ce détail). À revisiter si Guillaume constate en usage réel des uploads interrompus fréquents sur des fichiers proches du plafond de 20 Mo.

**Coupure en temps réel au plafond de 20 Mo (NFR-10), pas un rejet après coup.** AD-5 dit explicitement *"vérifiée à la capture"* — `app/capture-flow.tsx` surveille la taille cumulée des chunks (`ondataavailable`) et arrête automatiquement l'enregistrement dès que le total dépasse `MAX_AUDIO_SIZE_BYTES` (`domain/note.ts`), plutôt que de laisser Guillaume enregistrer plusieurs minutes puis rejeter tout le résultat. `data/local/notes.ts createVoiceNote` revalide quand même la taille (`validateAudioSize`) comme filet — même précédent que la revalidation systématique déjà en place pour `validateNoteContent`/`validateTaskTitle`. Le bucket Storage porte aussi un `file_size_limit` (Task 7) en défense en profondeur côté serveur.

**Compatibilité navigateur du format d'enregistrement (`MediaRecorder`).** Aucun format audio unique n'est supporté identiquement par tous les navigateurs (Chrome/Firefox/Android favorisent `audio/webm;codecs=opus`, Safari/iOS varie selon version). `pickAudioMimeType()` (`app/capture-flow.tsx`) sonde `MediaRecorder.isTypeSupported()` sur une liste de candidats par ordre de préférence, avec repli sur le format par défaut du navigateur si aucun candidat n'est supporté (`new MediaRecorder(stream)` sans `mimeType` explicite) — jamais un blocage total. `data/remote/storage.ts audioExtensionFromMimeType` dérive l'extension du fichier stocké à partir du `mimeType` réel du blob reçu (pas d'un nom de fichier fourni par le client), donc reste correct quel que soit le navigateur d'origine.

**Aucun mockup ne couvre l'interface d'enregistrement vocal.** Même situation que le formulaire "Note texte" (Story 5.1) ou le panneau de filtre (Story 4.2) : aucune référence visuelle dédiée dans `mockups/*.html`. L'interface retenue (bouton "Démarrer l'enregistrement" → pastille clignotante + minuteur → prévisualisation `<audio controls>` + Recommencer/Créer) réutilise entièrement les classes CSS déjà établies (`.field`/`.actions`/`.primaryButton`/`.ghostButton`/`.error`) et n'introduit que le strict nécessaire (`.recordingRow`/`.recordingDot`/`.recordingTimer`/`.audioPreview`). Le message "Micro indisponible — les autres captures restent possibles." reprend le texte exact de `EXPERIENCE.md` (table Do/Don't).

**Composants restent internes à `capture-flow.tsx`/`project-view.tsx`, pas d'extraction vers `components/`.** Même convention que la Story 5.1 (`NoteCard`/`NoteDetail` déjà internes) — cette story étend ces mêmes fonctions plutôt que d'en créer de nouvelles, `components/index.ts` reste `export {};`.

**Aucune intelligence git supplémentaire au-delà des Dev Notes/File List de la Story 5.1 ci-dessus** : les changements de cette story-là sont déjà présents dans l'arborescence de travail actuelle (non encore commités au moment de la création de cette story), donc directement lisibles dans le code plutôt que dans l'historique `git log`.

### Project Structure Notes

Fichiers créés :
```text
data/local/note-audio.ts                    # NoteAudioRecord, saveNoteAudio, getNoteAudio
data/remote/storage.ts                      # uploadNoteAudio, createNoteAudioSignedUrl
app/api/sync/upload-audio/route.ts          # POST — upload du blob vers Supabase Storage
app/api/notes/[id]/audio/route.ts           # GET — redirection vers URL signée (lecture)
```

Fichiers modifiés :
```text
domain/note.ts                              # + NoteType, Note.type/audioPath, MAX_AUDIO_SIZE_BYTES, validateAudioSize
domain/index.ts                             # + export NoteType, validateAudioSize, MAX_AUDIO_SIZE_BYTES
data/local/db.ts                            # + table noteAudio (version 5)
data/local/notes.ts                         # createNote += type/audioPath ; + createVoiceNote, markNoteAudioUploaded
data/local/index.ts                         # + export createVoiceNote, markNoteAudioUploaded, saveNoteAudio, getNoteAudio, CreateVoiceNoteInput, NoteAudioRecord
data/remote/sync.ts                         # RemoteNoteRow += type/audio_path ; noteFieldsToColumns += type/audioPath
data/remote/index.ts                        # + export uploadNoteAudio, createNoteAudioSignedUrl
sync/server.ts                              # + uploadNoteAudioBlob, getNoteAudioPlaybackUrl
sync/client.ts                              # PulledNoteRow += type/audio_path ; toLocalNote étendu ; + uploadPendingAudio(), fetchWithTimeout(timeoutMs), runSyncCycle étendu
app/capture-flow.tsx                        # + enregistrement micro (Task 15), soumission "Note vocale"
app/capture-flow.module.css                 # + .recordingRow/.recordingDot/.recordingTimer/.audioPreview
app/projects/[id]/project-view.tsx          # NoteCard/NoteDetail += branche type "voice" (lecture audio)
app/projects/[id]/project-view.module.css   # + .audioPreview
```

Aucun changement à `app/api/sync/push/route.ts`/`app/api/sync/pull/route.ts` (signatures déjà génériques, cf. Story 3.2/5.1). Aucun changement à `domain/task.ts`, `domain/project.ts`, `domain/capture.ts` (`CaptureType` a déjà `"voice-note"` depuis la Story 3.1), `app/general-screen.tsx` (les notes n'apparaissent jamais au calendrier), `components/index.ts` (`export {};` inchangé), `data/remote/client.ts` (aucun nouveau client requis).

**Migration Supabase :** exécutée par Guillaume (Task 7) sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (cf. précédent Stories 3.2/5.1), le SQL vit dans le texte de la Task 7 de cette story.

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 5.1). Vérification manuelle exhaustive en Task 19, contre le projet Supabase de production réel (pas d'environnement de staging). Attention particulière à : la contrainte connue d'absence d'accès micro réel dans l'environnement de vérification automatisé (documenter précisément ce qui a pu/n'a pas pu être vérifié par ce biais, cf. Task 19) ; le cycle offline → online complet incluant l'upload du blob en plus du push de champs classique ; la lecture audio cross-appareil (blob local vs URL signée serveur).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5: Notes (texte & vocal), Story 5.2 (texte exact des 3 AC, FR-16 couvert par cette story)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md — FR-16 ("l'enregistrement fonctionne hors ligne, audio mis en file de synchronisation") ; FR-2 (projet obligatoire pour Note) ; NFR-4 (dégradation gracieuse micro/caméra) ; NFR-5 (reprise d'upload, `[ASSUMPTION]`, cf. Dev Notes) ; NFR-10 (20 Mo max) ; UJ-1/UJ-2 (capture vocale mobile, reprise desktop le lendemain)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-5 (stockage hors ligne des blobs, plafond 20 Mo, "vérifiée à la capture") ; AD-6 (code serveur seul pour Supabase au-delà de la session Auth) ; AD-8 (deux buckets Storage distincts documents/audio) ; Capability → Architecture Map "4.4 Notes — FR-15 à FR-17" (`data/local/` blob audio) ; ERD (Note porte priority/provenance/is_new) ; Deferred (schéma exact Dexie/Postgres laissé au code)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Voice and Tone (texte exact "Micro indisponible — les autres captures restent possibles.") ; States to Cover ("Accès micro refusé... État dégradé visible") ; Component Patterns (carte tâche/note/document unique) ; Flow 1 (UJ-1 : "Étape 3/3 : il choisit Note vocale et enregistre son idée... aucune connexion n'a été nécessaire")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.task-card, components.priority-chip, components.badge-new (composant carte unique réutilisé pour la note vocale, cf. Dev Notes Story 5.1)]
- [Source: _bmad-output/implementation-artifacts/5-1-creation-dune-note-texte.md — entité Note initiale (content/priority/provenance/isNew), createNote/listNotesByProject/markNoteOpened, NoteCard/NoteDetail internes à project-view.tsx, migration SQL notes+RLS, décision "pas de champ transcription avant Story 5.3"]
- [Source: _bmad-output/implementation-artifacts/3-2-ecriture-hors-ligne-et-synchronisation-automatique.md — enveloppe de file de synchronisation, ordre project avant task/note, pattern retry/timeout de sync/client.ts]
- [Source: domain/task.ts, domain/capture.ts, domain/sync.ts — CaptureType inclut déjà "voice-note" (Story 3.1) ; commentaire d'en-tête confirmant "Note.transcription s'y ajoutera en Epic 5" (Story 5.3, pas cette story)]
- [Source: data/local/db.ts, data/local/sync-queue.ts, sync/client.ts, sync/server.ts, data/remote/sync.ts, app/api/sync/push/route.ts, app/api/sync/pull/route.ts, app/projects/[id]/page.tsx — code réel actuel (patterns de version Dexie, enqueueField/enqueueCreate, updateThenUpsert, fetchWithTimeout, getClaims()/data.claims.sub, RouteContext<...> pour les routes dynamiques)]
- [Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md — Route Handlers : params asynchrones, helper `RouteContext<'/path/[id]'>` généré (Next.js 16.3.0, cf. AGENTS.md sur les APIs non standard de cette version)]
- [Source: package.json — Dexie 4.4.4, @supabase/supabase-js 2.112.0 déjà en dépendance ; aucune nouvelle librairie nécessaire pour cette story (MediaRecorder/getUserMedia sont des Web APIs natives, pas de package npm)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre.
- `npm run lint` : propre (deux erreurs `react-hooks/set-state-in-effect` corrigées en cours de route — `app/capture-flow.tsx` : `recordedAudioUrl` dérivé via `useMemo` plutôt qu'un `useState` mis à jour depuis un `useEffect`, `URL.createObjectURL` étant synchrone contrairement à la lecture IndexedDB de `project-view.tsx` ; `app/projects/[id]/project-view.tsx` : reset de `localAudioUrl` déplacé dans la fonction de nettoyage de l'effet plutôt que dans son corps synchrone. Deux directives `eslint-disable` `jsx-a11y/media-has-caption` retirées — la règle n'est pas active dans la configuration ESLint de ce projet, les ajouter était inutile).
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker, y compris les deux nouvelles routes `app/api/sync/upload-audio` et `app/api/notes/[id]/audio` correctement enregistrées comme dynamiques).
- Avant d'éditer chaque fichier partagé avec la Story 5.1 (`data/remote/sync.ts`, `sync/client.ts`, `app/capture-flow.tsx`, `app/projects/[id]/project-view.tsx`), relu l'état réel sur disque plutôt que de me fier au contenu vu pendant `create-story` : la revue de code de la Story 5.1 avait déjà appliqué certains correctifs entre-temps (réconciliation `isNew` au pull des notes dans `sync/client.ts`, reset de `submitError` dans `handleBackToTypeSelection`, titre accessible `noteA11yTitle` dans `NoteDetail`). Tous préservés et intégrés à mes propres modifications plutôt qu'écrasés.
- **Task 7 (migration SQL + bucket Storage Supabase) exécutée par Guillaume**, comme pour la Story 5.1 (Task 5) : aucun outil MCP Supabase/base de données n'est disponible dans cette session, l'agent ne pouvait pas l'exécuter lui-même. Premier essai en échec (`23505 duplicate key value violates unique constraint "buckets_pkey"` sur `insert into storage.buckets`) — une panne active du dashboard Supabase ce jour-là (Dashboard Login Outage, cf. status.supabase.com) avait vraisemblablement laissé une exécution précédente partiellement appliquée (le bucket `audio` existait déjà, état des colonnes/policies inconnu). Corrigé en fournissant une version idempotente du même SQL (`add column if not exists`, `insert ... on conflict (id) do update`, `drop policy if exists` avant chaque `create policy`), exécutée avec succès au second essai. **Vérifié indépendamment par l'agent sur les résultats fournis par Guillaume** : `select id, public, file_size_limit from storage.buckets where id = 'audio'` → `audio`/`false`/`20971520` (conforme à la Task 7) ; `select type, audio_path from public.notes limit 1` → `type = 'text'`, `audio_path = NULL` sur une note existante de la Story 5.1 (conforme). Les colonnes `notes.type`/`notes.audio_path`, le bucket privé `audio`, et ses policies RLS existent désormais côté Supabase.
- **Task 19 (vérification manuelle) — Guillaume s'est connecté sur le panneau Browser en cours de session, permettant une vérification bien plus poussée que prévu initialement.** Deux obstacles rencontrés et résolus avant de pouvoir tester :
  - Un service worker (Serwist) obsolète, enregistré par une session précédente, servait des ressources statiques cassées (`ChunkLoadError`, `net::ERR_FAILED` en boucle sur les chunks/CSS) — désenregistré via `navigator.serviceWorker.getRegistrations()`/`unregister()` + purge des caches, puis rechargement complet : l'app s'affiche et fonctionne normalement ensuite. Sans rapport avec le code de cette story (artefact de session de vérification, pas un bug applicatif).
  - Ma propre tentative `preview_start` sur un port libre (`autoPort`) n'a jamais réellement démarré (processus introuvable ensuite via `preview_list`, `curl` confirme "connection refused") — abandonnée au profit du serveur `next dev` déjà lancé sur le port 3000 par une session parallèle (même situation que la Story 5.1), qui sert correctement le code à jour.
  - **AC#3 vérifiée en conditions réelles** : "Note vocale" → "Démarrer l'enregistrement" → l'environnement de vérification a réellement bloqué `getUserMedia` (notifié explicitement par l'outillage du panneau Browser) → l'app affiche "Micro indisponible — les autres captures restent possibles." exactement comme prévu, "Retour" ramène à un sélecteur de type entièrement fonctionnel.
  - **Pipeline AC#1 vérifié en conditions réelles contre le projet Supabase de production**, en pilotant directement les mêmes routes que le code applicatif (impossible de déclencher un vrai enregistrement micro, cf. AC#3) : écriture locale complète (note + blob dans `db.noteAudio` + 7 entrées `syncQueue`) → `POST /api/sync/push` (7/7 champs réussis côté Postgres, dont `type`) → `POST /api/sync/upload-audio` (fichier réellement déposé dans le bucket `audio`, chemin `{user_id}/{noteId}.webm`) → `POST /api/sync/push` du champ `audioPath` (réussi) → `GET /api/sync/pull` (la ligne distante revient avec `type: "voice"` et `audio_path` corrects) → `GET /api/notes/[id]/audio` (redirection 302 confirmée en mode `redirect: "manual"`, puis en suivant la redirection : `200 OK`, `content-type: audio/webm`, contenu identique octet pour octet au fichier uploadé, hébergé sur `pxdmtnysvglorwchwsmc.supabase.co`). Rendu UI confirmé par capture d'écran : `NoteCard` affiche "Note vocale" avec puce de priorité/provenance, `NoteDetail` affiche un lecteur `<audio controls>` natif fonctionnel.
  - **Bug réel trouvé et corrigé** : le moteur de synchronisation réel de l'app (`sync/client.ts`, cycle automatique de 30s, code non modifié pour le test) a détecté tout seul la note vocale en attente d'upload et a tenté de la retéléverser (comportement normal — la note n'avait pas encore `audioPath` en local à ce stade du test) ; l'appel a échoué en boucle avec `500 Internal Server Error` sur `POST /api/sync/upload-audio`. Cause : `data/remote/storage.ts uploadNoteAudio` appelait `client.storage.from("audio").upload(path, file, { upsert: false })` — un second upload vers un chemin déjà occupé par mon premier test manuel échouait avec "The resource already exists" (409), non géré, remonté en 500 générique. Corrigé : ajout d'un traitement idempotent de cette erreur spécifique (chemin déterministe par note, un second upload de la même note ne peut jamais entrer en collision avec une autre) — voir `data/remote/storage.ts` (nouvelle fonction `isAlreadyExistsError`). **Revérifié après correction** : nouvel appel manuel à `/api/sync/upload-audio` → `200 OK` ; après ~30-40s, le moteur de synchro réel de l'app a lui-même convergé `db.notes.audioPath` en local et vidé `syncQueue` pour cette note, sans aucune intervention manuelle — confirmant `uploadPendingAudio`/`markNoteAudioUploaded` (Tasks 5, 14) en conditions réelles. `npm run lint`/`npx tsc --noEmit` propres après ce correctif.
  - `proxy.ts` protège bien les deux nouvelles routes par construction (confirmé aussi empiriquement : `getClaims()` a systématiquement réussi sous la session authentifiée de Guillaume, comme attendu).
  - **Non-régression confirmée en conditions réelles** sur le projet "Test Story 4.1" (déjà utilisé par les vérifications des Stories 3.x/4.x/5.1) : onglet Tâches (tri, statut), onglet Notes (note texte + note vocale mélangées et triées par date), onglet Documents ("Bientôt disponible."), indicateur de synchronisation "À jour".
  - **Non testé** (nécessite un vrai appareil avec micro physique) : capture réelle d'un son audible via `MediaRecorder`, parité desktop/mobile en usage réel, cycle offline→online spécifiquement pour le chemin audio (bascule DevTools Offline non déclenchée dans cette session), coupure réelle à 20 Mo sur un enregistrement long, parcours clavier/lecteur d'écran complet. **Reste à la charge de Guillaume sur un appareil réel.**
- Données de test : note créée pendant la vérification (id `63b56478-174f-4420-a38d-63f8f8deb969`) supprimée d'IndexedDB par l'agent. La ligne Postgres correspondante et le fichier `5dc752f6-1bee-44ce-88ca-0654b7397314/63b56478-174f-4420-a38d-63f8f8deb969.webm` dans le bucket `audio` restent à supprimer par Guillaume via le dashboard Supabase (aucune fonctionnalité de suppression de note n'existe dans l'app).
- **Revue de code adversariale (skill `bmad-code-review`)** : trois couches en parallèle (Blind Hunter, Edge Case Hunter, Acceptance Auditor) contre un diff reconstruit isolant précisément les 17 fichiers de cette story (le dépôt n'a qu'un seul commit, `git diff` brut aurait mélangé toutes les stories accumulées depuis). 14 `patch` (tous appliqués, cf. section Review Findings ci-dessus), 0 `decision-needed`, 7 `defer` (consignés dans `deferred-work.md`), 2 findings écartés car déjà mitigés (`file_size_limit` du bucket Storage côté serveur ; fuite d'URL objet StrictMode/dev-only). Points notables corrigés : la coupure "temps réel" à 20 Mo ne coupait en réalité jamais rien (`MediaRecorder.start()` sans `timeslice` — `ondataavailable` ne se déclenchait qu'une fois, à l'arrêt) ; le micro restait actif si le flux était fermé via "✕" pendant l'enregistrement ; absence de garde de réentrance/`onerror`/try-catch sur le cycle de vie du `MediaRecorder` ; note texte locale (Story 5.1) sans migration Dexie pour `type`/`audioPath` (violation de contrat TypeScript dormante).
- **Collision avec une session parallèle sur la Story 5.3** (transcription) : pendant l'application des patches, `domain/note.ts`/`domain/index.ts`/`data/local/notes.ts`/`sync/client.ts`/`data/remote/sync.ts`/`sync/server.ts`/`app/capture-flow.tsx`/`app/projects/[id]/project-view.tsx` ont été modifiés en temps réel par une autre session ajoutant les champs `transcription`/`transcriptionUpdatedAt`/`transcriptionSyncedAt`/`transcriptionConflict` à `Note`. `tsc`/`lint` ont montré des erreurs transitoires à plusieurs reprises pendant cette fenêtre (types incomplets, prop `onTranscriptionChange` non déclarée) — aucune imputable aux patches de cette story, toutes résolues une fois l'autre session stabilisée. `npm run build` final propre, incluant la nouvelle route `/api/sync/transcribe-audio` de la Story 5.3. Aucun de mes correctifs n'a touché `domain/note.ts` ni les champs `transcription*` — zéro conflit de fond, seulement un chevauchement temporel sur des fichiers partagés. Confirmé avec Guillaume avant de clôturer : la Story 5.3 aura sa propre revue de code séparément.

### Completion Notes List

- **Code complet (Tasks 1 à 18)** : entité `Note` étendue (`type`/`audioPath`), table Dexie `noteAudio` (blob local), `createVoiceNote`/`markNoteAudioUploaded`, module `data/remote/storage.ts` (upload + URL signée Supabase Storage), deux nouvelles routes serveur (`POST /api/sync/upload-audio`, `GET /api/notes/[id]/audio`), extension du moteur de synchronisation (`sync/client.ts` : `uploadPendingAudio()` intégré à `runSyncCycle`, `fetchWithTimeout` avec délai paramétrable), interface d'enregistrement complète dans `app/capture-flow.tsx` (permission micro, `MediaRecorder`, coupure temps réel à 20 Mo, prévisualisation, état dégradé "Micro indisponible"), lecture audio dans `app/projects/[id]/project-view.tsx` (blob local en priorité, URL signée serveur en repli).
- **Task 7 (migration SQL Supabase) exécutée et vérifiée** — cf. Debug Log pour le détail (échec initial dû à une exécution partielle antérieure, corrigé par une version idempotente du SQL, résultats de vérification conformes).
- **Task 19 (vérification manuelle) largement réalisée en conditions réelles contre production**, une fois Guillaume connecté sur le panneau Browser en cours de session : AC#3 vérifiée de bout en bout via un vrai refus d'accès micro ; l'intégralité du pipeline de stockage/upload/synchronisation/lecture d'AC#1 vérifiée contre le projet Supabase réel (écriture locale, upload Storage, push/pull Postgres, redirection de lecture signée, rendu UI de la carte et du détail). **Un bug réel a été trouvé et corrigé pendant cette vérification** (upload non idempotent, `data/remote/storage.ts`, cf. Debug Log) — sans cette session de test réel, ce bug serait resté latent jusqu'au premier usage réel par Guillaume. Seule la capture microphone elle-même (geste utilisateur réel + son audible), la parité desktop/mobile, le cycle offline→online, le plafond de 20 Mo sur un enregistrement long, et un parcours clavier/lecteur d'écran complet restent à vérifier sur un appareil réel — cf. Debug Log pour le détail exact.
- Aucune nouvelle dépendance ajoutée (`MediaRecorder`/`getUserMedia` sont des Web APIs natives). Aucune déviation de portée par rapport à la story (pas de champ `transcription` ajouté par cette story — le champ existe désormais via la Story 5.3, développée en parallèle, cf. Debug Log — pas d'upload resumable NFR-5, pas de composant `components/` extrait) — décisions déjà documentées dans les Dev Notes de la story.
- **Revue de code complète** : 14 findings `patch` appliqués (robustesse du cycle de vie `MediaRecorder` — coupure 20 Mo réellement temps réel, libération du micro dans tous les chemins d'abandon, garde de réentrance, `onerror`, migration Dexie pour les notes texte existantes, validations serveur légères), 7 `defer` consignés dans `deferred-work.md`, 2 findings écartés (déjà mitigés). `npm run build`/`npm run lint`/`npx tsc --noEmit` propres après application, y compris une fois la Story 5.3 (développée en parallèle) stabilisée sur les fichiers partagés.
- Statut passé à `done`. **Reste, hors du périmètre de ce pipeline de revue** : (1) Guillaume vérifie l'enregistrement microphone réel sur un appareil (téléphone et ordinateur), une fois la version déployée en production — déjà convenu de le faire à ce moment-là plutôt qu'en environnement de vérification ; (2) supprimer la note/le fichier de test restants côté Supabase (cf. Debug Log).

### File List

**Créés :**
- `data/local/note-audio.ts`
- `data/remote/storage.ts`
- `app/api/sync/upload-audio/route.ts`
- `app/api/notes/[id]/audio/route.ts`

*(`data/remote/storage.ts` corrigé après coup pendant la vérification manuelle — cf. Debug Log : `upload()` traite désormais une réponse "resource already exists" comme un succès idempotent plutôt que de la remonter en erreur. Étendu ensuite par la revue de code : `isAlreadyExistsError` resserré, commentaire `audioExtensionFromMimeType` reformulé.)*

**Modifiés :**
- `domain/note.ts` (+ `NoteType`, `Note.type`/`Note.audioPath`, `MAX_AUDIO_SIZE_BYTES`, `validateAudioSize`)
- `domain/index.ts` (+ export `NoteType`, `validateAudioSize`, `MAX_AUDIO_SIZE_BYTES`)
- `data/local/db.ts` (+ table `noteAudio`, version 5 ; + revue de code : migration `.upgrade()` renseignant `type`/`audioPath` sur les notes texte pré-existantes)
- `data/local/notes.ts` (`createNote` += `type`/`audioPath` ; + `createVoiceNote`, `markNoteAudioUploaded`)
- `data/local/index.ts` (+ export `createVoiceNote`, `markNoteAudioUploaded`, `saveNoteAudio`, `getNoteAudio`, `CreateVoiceNoteInput`, `NoteAudioRecord`)
- `data/remote/sync.ts` (`RemoteNoteRow` += `type`/`audio_path` ; `noteFieldsToColumns` += `type`/`audioPath`)
- `data/remote/index.ts` (+ export `uploadNoteAudio`, `createNoteAudioSignedUrl`)
- `sync/server.ts` (+ `uploadNoteAudioBlob`, `getNoteAudioPlaybackUrl`)
- `sync/client.ts` (`PulledNoteRow` += `type`/`audio_path` ; `toLocalNote` étendu ; + `uploadPendingAudio()`, `fetchWithTimeout(timeoutMs)`, `runSyncCycle` étendu)
- `app/capture-flow.tsx` (+ enregistrement micro complet, soumission "Note vocale", `handleSubmitVoiceNote` ; + revue de code : jeton d'annulation `recordingTokenRef`, `stopRecordingStream()` arrête désormais le `MediaRecorder` lui-même, `closeFlow()` coupe le micro, garde de réentrance, try/catch sur la construction du recorder, `onerror`, `timeslice` réel sur `start()`, retour silencieux pour un enregistrement vide)
- `app/capture-flow.module.css` (+ `.recordingRow`/`.recordingDot`/`.recordingTimer`/`.audioPreview`)
- `app/projects/[id]/project-view.tsx` (`NoteCard`/`NoteDetail` += branche `type === "voice"`, lecture audio ; + revue de code : `onError` + message dédié sur le lecteur de repli)
- `app/projects/[id]/project-view.module.css` (+ `.audioPreview`)
- `app/api/sync/upload-audio/route.ts` (+ revue de code : validation `data.claims.sub`, validation du format UUID de `noteId`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)
- `_bmad-output/implementation-artifacts/deferred-work.md` (+ 7 findings différés de la revue de code de cette story)

**Migration Supabase (Task 7) : exécutée et vérifiée**, sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (même précédent que les Stories 3.2/5.1), le SQL (version idempotente finale) vit dans le texte de la Task 7 de cette story et dans le Debug Log.

## Change Log

- 2026-09-01 : Implémentation complète des Tasks 1 à 18 (entité `Note` étendue pour le type vocal, stockage local du blob, upload vers Supabase Storage via une route dédiée, extension du moteur de synchronisation, interface d'enregistrement micro complète dans le flux de capture, lecture audio dans la vue projet). `npm run build`/`npm run lint`/`tsc --noEmit` propres. Task 7 (migration SQL + bucket Storage) non exécutable par l'agent (aucun accès Supabase), à la charge de Guillaume. Task 19 (vérification manuelle) non réalisable en conditions réelles faute de session authentifiée disponible dans le panneau Browser de cette session — build/lint/tsc et protection `proxy.ts` confirmés par lecture de code uniquement. Statut passé à `review`.
- 2026-09-01 : Task 7 (migration SQL Supabase) exécutée par Guillaume. Échec initial (`23505 duplicate key` sur `storage.buckets`, dashboard Supabase ayant subi une panne active ce jour — Dashboard Login Outage — qui semble avoir laissé une exécution précédente partiellement appliquée), corrigé par une version idempotente du SQL. Vérifiée indépendamment par l'agent sur les résultats fournis par Guillaume : bucket `audio` (`public: false`, `file_size_limit: 20971520`) et colonnes `notes.type`/`notes.audio_path` (`type: 'text'`, `audio_path: NULL` sur une note existante) conformes à la Task 7. Reste : Task 19 (vérification manuelle en conditions réelles), à faire une fois Guillaume connecté sur le panneau Browser.
- 2026-09-01 : Task 19 (vérification manuelle) largement réalisée en conditions réelles, Guillaume s'étant connecté sur le panneau Browser en cours de session. AC#3 vérifiée avec un vrai refus d'accès micro. Pipeline complet d'AC#1 (stockage local, upload Storage, push/pull Postgres, lecture par URL signée, rendu UI) vérifié contre le projet Supabase de production en pilotant directement les routes serveur. Bug réel trouvé et corrigé : `data/remote/storage.ts uploadNoteAudio` échouait en boucle (500) sur une retentative d'upload légitime du moteur de synchro (chemin déjà occupé) — corrigé en traitant "resource already exists" comme un succès idempotent ; revérifié après correction, y compris la convergence automatique du moteur de synchronisation réel de l'app sans intervention manuelle. `npm run lint`/`npx tsc --noEmit` propres après ce correctif. Non-régression confirmée (tâches, notes texte, documents, indicateur de synchro). Restent à vérifier par Guillaume sur un appareil réel : capture microphone effective, parité desktop/mobile, cycle offline→online, plafond de 20 Mo, accessibilité clavier/lecteur d'écran complète. Données de test locales nettoyées ; reste une ligne + un fichier à supprimer côté Supabase (dashboard).
- 2026-09-02 : Revue de code adversariale (skill `bmad-code-review`, trois couches parallèles) contre un diff reconstruit isolant les 17 fichiers de cette story. 14 `patch` appliqués (coupure 20 Mo réellement temps réel via `timeslice`, libération du micro sur tous les chemins d'abandon dont "✕", garde de réentrance, `onerror`/try-catch sur le `MediaRecorder`, migration Dexie pour les notes texte pré-existantes, validations serveur légères, resserrement d'`isAlreadyExistsError`, retour d'erreur sur le lecteur de repli), 7 `defer` consignés dans `deferred-work.md`, 2 findings écartés (déjà mitigés par le `file_size_limit` du bucket et la nature dev-only de la fuite StrictMode). Collision transitoire avec une session parallèle développant la Story 5.3 (transcription) sur des fichiers partagés (`domain/note.ts` et consorts) — aucun conflit de fond, `npm run build`/`lint`/`tsc` propres une fois les deux sessions stabilisées. Statut passé à `done`.
