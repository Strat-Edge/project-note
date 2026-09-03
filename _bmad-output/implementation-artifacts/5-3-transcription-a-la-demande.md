---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 5.3: Transcription à la demande

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want demander la transcription texte d'une note vocale, à la création ou après coup,
so that certaines de mes notes vocales deviennent cherchables en texte, sans que ce soit systématique.

## Acceptance Criteria

1. **Given** une note vocale **When** je déclenche "Générer la transcription" (à la création ou depuis le détail) **Then** une transcription texte est générée via l'API `gpt-transcribe`, appelée uniquement côté serveur
2. **Given** une note vocale sans transcription demandée **When** je la consulte **Then** elle reste pleinement valide et consultable (lecture audio), dans un état visuellement distinct d'une note transcrite

## Tasks / Subtasks

- [x] Task 1: `domain/note.ts` — champs conflict-trackés `transcription`/`transcriptionUpdatedAt`/`transcriptionSyncedAt`/`transcriptionConflict`, `setNoteTranscription` (AC: #1, #2 ; AD-3)
  - [x] `AD-3` liste explicitement les binds : *"Task.status, priority partagée Task/Note/Document, Note.transcription"* — `Note.transcription` est donc un champ conflict-tracké au même titre que `Task.status`/`Task.priority` (Story 3.6), avec exactement la même mécanique `*UpdatedAt`/`*SyncedAt`/`*Conflict`. Importer `FieldConflict` depuis `./sync` (légitime — les deux fichiers restent dans `domain/`, cf. AD-2) et étendre `Note` :
    ```ts
    // domain/note.ts — entité Note et validations pures associées. FR-15 (texte, Story 5.1),
    // FR-16 (vocal, Story 5.2) et FR-17 (transcription à la demande, cette story) partagent la
    // même entité Note, distinguées par `type`. Ne dépend d'aucun module HORS domain/ (cf. AD-2).
    import type { Priority } from "./capture";
    import type { Provenance } from "./task";
    import type { FieldConflict } from "./sync";

    export type NoteType = "text" | "voice";

    export interface Note {
      id: string;
      projectId: string;
      type: NoteType;
      content: string; // texte libre pour type "text" (FR-15) ; toujours "" pour type "voice" —
        // la transcription (FR-17) vit dans son propre champ `transcription` ci-dessous, jamais
        // dans `content` (cf. Dev Notes Story 5.1/5.2 : décision déjà prise et confirmée ici).
      audioPath: string | null;
      transcription: string | null; // null = jamais transcrite (état par défaut, y compris pour
        // type "text" où ce champ n'est jamais renseigné) ; texte généré par `gpt-transcribe`
        // (FR-17) une fois la transcription demandée, ou choisi lors d'une résolution de conflit.
      transcriptionUpdatedAt: string; // ISO 8601 UTC — dernière modification LOCALE de `transcription`
        // (AD-3, même mécanique que Task.statusUpdatedAt, Story 3.6)
      transcriptionSyncedAt: string | null; // valeur de transcription_updated_at au dernier sync réussi ; null si jamais synchronisé
      transcriptionConflict: FieldConflict<string | null> | null; // non-null = conflit réel non résolu
      priority: Priority;
      provenance: Provenance;
      isNew: boolean;
      createdAt: string;
    }
    ```
  - [x] Ajouter, à la suite d'`openNote` :
    ```ts
    // FR-17 : écrit le résultat d'une transcription réussie (gpt-transcribe), ou la valeur
    // choisie lors d'une résolution de conflit (AD-3) — même rôle que setTaskStatus/
    // setTaskPriority (Story 3.6) : efface systématiquement tout conflit en attente sur ce
    // champ, une écriture explicite valant arbitrage implicite. `updatedAt` en paramètre (pas
    // de `new Date()` interne) pour rester pure/déterministe, même précédent que Story 3.6.
    export function setNoteTranscription(
      note: Note,
      transcription: string | null,
      updatedAt: string,
    ): Note {
      return { ...note, transcription, transcriptionUpdatedAt: updatedAt, transcriptionConflict: null };
    }
    ```
  - [x] `domain/index.ts` : ajouter `setNoteTranscription` au bloc d'export de `./note` (à la suite de `validateAudioSize, MAX_AUDIO_SIZE_BYTES`).
  - [x] Aucune nouvelle version de schéma Dexie nécessaire (`data/local/db.ts` inchangé) — mêmes propriétés d'objet ordinaires, non indexées, que les champs `*UpdatedAt`/`*SyncedAt`/`*Conflict` de `Task` (Story 3.6, précédent explicite : "une nouvelle version de store n'est nécessaire que pour ajouter/modifier des index, pas pour étendre la forme des objets stockés").

- [x] Task 2: `data/local/notes.ts` — amorçage des nouveaux champs à la création, `updateNoteTranscription` (AC: #1, #2)
  - [x] **Différence délibérée avec `audioPath` (Story 5.2) : `transcription` DOIT être poussé dès la création, pas laissé en dehors d'`enqueueCreate`.** `audioPath` n'est pas conflict-tracké (écrit une seule fois par le moteur de synchro, jamais comparé via `resolveFieldSync`) — l'exclure d'`enqueueCreate` était donc sans risque. `transcription` l'est : si son premier push (avec sa vraie valeur `null`) n'est jamais confirmé synchronisé, `transcriptionSyncedAt` reste bloqué à `null` indéfiniment sur l'appareil d'origine, et `resolveFieldSync` traite `localSyncedAt === null` comme "les deux ont changé" par défaut (cf. `domain/sync.ts`) — **tout premier pull d'une transcription générée sur un AUTRE appareil serait alors systématiquement classé "conflit" au lieu d'un "adopt-remote" légitime**, même si l'appareil d'origine n'a lui-même jamais touché ce champ. Pousser `transcription: null` à la création (comme `Task.status`/`priority`, jamais comme `audioPath`) établit `transcriptionSyncedAt` dès la confirmation du premier push et évite ce piège. Cf. Dev Notes pour le détail du raisonnement.
  - [x] Dans `createNote`, étendre le littéral `Note` (après `audioPath: null,`) :
    ```ts
    transcription: null,
    transcriptionUpdatedAt: now,
    transcriptionSyncedAt: null,
    transcriptionConflict: null,
    ```
    et ajouter `transcription: note.transcription,` au dictionnaire de champs passé à `enqueueCreate` (à la suite de `audioPath` — non, `audioPath` n'y figure justement pas ; ajouter après `provenance: note.provenance,`). Même changement dans `createVoiceNote` (les deux fonctions construisent un littéral `Note` quasi identique).
  - [x] Ajouter, à la suite de `markNoteAudioUploaded` :
    ```ts
    // Persiste le résultat d'une transcription (FR-17) — appelée par app/ après un appel réseau
    // réussi à /api/sync/transcribe-audio (jamais par ce module directement : data/local/ ne
    // dépend que de domain/, cf. AD-2, en-tête de fichier). Réutilisée aussi pour la résolution
    // d'un conflit de transcription (choix entre les deux valeurs, cf. ConflictBanner côté UI) —
    // même précédent qu'updateTaskStatus/updateTaskPriority (Story 3.6) : la garde d'idempotence
    // ne court-circuite pas quand un conflit est en attente, pour permettre de "trancher" même
    // en choisissant la valeur déjà affichée localement.
    export async function updateNoteTranscription(
      id: string,
      transcription: string | null,
    ): Promise<Note> {
      return db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
        const existing = await getNoteOrThrow(id);
        if (existing.transcription === transcription && existing.transcriptionConflict === null) {
          return existing;
        }
        const now = new Date().toISOString();
        const updated = setNoteTranscription(existing, transcription, now);
        await db.notes.put(updated);
        await enqueueField(
          {
            entity: "note",
            entityId: id,
            field: "transcription",
            operation: "update",
            value: updated.transcription,
            deviceId: getDeviceId(),
            updatedAt: now,
          },
          tx,
        );
        return updated;
      });
    }
    ```
  - [x] Étendre l'import `@/domain` du fichier : ajouter `setNoteTranscription` à côté de `validateNoteContent, validateAudioSize, openNote`.
  - [x] Mettre à jour le commentaire d'en-tête du fichier — remplacer *"Le champ conflict-tracké de Note sera `transcription` (Story 5.3)"* par une phrase au passé (le champ existe désormais) et retirer la phrase *"`audioPath`... n'est pas non plus conflict-tracké"* de toute ambiguïté avec `transcription` (qui l'est, lui).
  - [x] `data/local/index.ts` : ajouter `updateNoteTranscription` au bloc d'export de `./notes` (à la suite de `markNoteAudioUploaded`).

- [x] Task 3: Schéma Supabase — colonnes `transcription`/`transcription_updated_at` sur `public.notes` (AC: #1, #2 ; AD-3)
  - [x] Guillaume exécute cette migration dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc` (aucun changement RLS/policy/grant — même précédent que la Story 3.6 Task 3, les policies existantes s'appliquent déjà à la ligne entière) :
    ```sql
    alter table public.notes
      add column transcription text,
      add column transcription_updated_at timestamptz not null default now();
    ```
    `default now()` n'amorce que d'éventuelles lignes déjà présentes en base (données de test résiduelles) — tout nouvel upsert (Task 4) fournit désormais systématiquement cette colonne explicitement (y compris `null` à la création, cf. Task 2), le défaut n'est jamais exercé en usage normal après cette migration.
  - [x] Vérifier après exécution : `select id, transcription, transcription_updated_at from public.notes limit 1;` retourne une valeur non nulle pour `transcription_updated_at` (et `transcription` à `null` pour une note existante des Stories 5.1/5.2). **Exécutée et vérifiée par Guillaume** — résultat conforme (`transcription: NULL`, `transcription_updated_at: 2026-09-02 07:00:41.254056+00`).

- [x] Task 4: `data/remote/sync.ts` — `RemoteNoteRow`, `noteFieldsToColumns`, nouvelle signature d'`upsertNoteFields` (AC: #1, #2 ; AD-3, AD-6)
  - [x] `RemoteNoteRow` : ajouter `transcription: string | null; transcription_updated_at: string;`.
  - [x] `noteFieldsToColumns` : ajouter, après `if ("audioPath" in fields) columns.audio_path = fields.audioPath;` :
    ```ts
    if ("transcription" in fields) columns.transcription = fields.transcription;
    ```
  - [x] Changer la signature d'`upsertNoteFields` pour recevoir les entrées de file brutes du groupe (pas seulement le dictionnaire de valeurs aplati) — **même changement qu'`upsertTaskFields` en Story 3.6**, nécessaire pour accéder à l'`updatedAt` par champ et peupler `transcription_updated_at` :
    ```ts
    // Reçoit désormais les entrées de file brutes du groupe (pas seulement le dictionnaire de
    // valeurs aplati) — même changement qu'upsertTaskFields (Story 3.6), nécessaire pour peupler
    // transcription_updated_at (AD-3, cette story). Note a désormais un champ dans le périmètre
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
    ```
    Retirer le commentaire devenu faux au-dessus de l'ancienne signature (*"Note n'a aucun champ conflict-tracké dans cette story"*).

- [x] Task 5: `data/remote/storage.ts` — exporter `audioExtensionFromMimeType` (AC: #1)
  - [x] Ajouter `export` devant `function audioExtensionFromMimeType(...)` — réutilisée telle quelle par `data/remote/transcription.ts` (Task 6) pour construire un nom de fichier avec la bonne extension avant l'appel à l'API OpenAI (qui valide le format audio via l'extension du nom de fichier, cf. Dev Notes — pas seulement le `Content-Type`). Aucun autre changement à ce fichier.

- [x] Task 6: `data/remote/transcription.ts` — nouveau module, appel à l'API de transcription OpenAI (AC: #1 ; AD-6)
  - [x] Ajouter la dépendance `openai` (version constatée au moment de la création de cette story : `7.8.0` — vérifier la dernière version stable au moment de l'implémentation) :
    ```bash
    npm install openai@^7.8.0
    ```
  - [x] Créer `data/remote/transcription.ts` :
    ```ts
    import "server-only";
    import OpenAI from "openai";
    import { requireEnv } from "@/lib/env";
    import { audioExtensionFromMimeType } from "./storage";

    // data/remote/transcription.ts — appel à l'API de transcription OpenAI (FR-17, AD-6). Séparé
    // de data/remote/storage.ts (Supabase Storage) et data/remote/sync.ts (tables Postgres) : ce
    // fichier ne parle qu'à l'API OpenAI, jamais à Supabase. Garde "server-only" (AD-2, AD-6) :
    // ce module ne doit jamais atteindre le bundle client, même transitivement.

    // AD-8 : gpt-transcribe remplace whisper-1, dé-priorisé par OpenAI au profit de ce nouveau
    // modèle (cf. ARCHITECTURE-SPINE.md Stack). Constante plutôt que littéral inline — un seul
    // point de mise à jour si le modèle change à nouveau.
    const TRANSCRIPTION_MODEL = "gpt-transcribe";

    // L'API valide le format audio via l'extension du nom de fichier fourni (pas seulement via
    // le Content-Type) — un nom sans extension reconnue ("recording" seul) est rejeté avec
    // "Invalid file format" même pour un audio parfaitement valide. Réutilise
    // audioExtensionFromMimeType (data/remote/storage.ts, Task 5) plutôt que d'en dupliquer une
    // copie : même mapping mimeType -> extension que l'upload vers Supabase Storage, un seul
    // point de mise à jour si de nouveaux formats MediaRecorder apparaissent.
    export async function transcribeAudio(file: Blob): Promise<string> {
      const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
      const named = new File(
        [file],
        `recording.${audioExtensionFromMimeType(file.type)}`,
        { type: file.type || "audio/webm" },
      );
      const transcription = await client.audio.transcriptions.create({
        file: named,
        model: TRANSCRIPTION_MODEL,
      });
      return transcription.text;
    }
    ```
    Signature en `Blob` (pas `File`) : le seul appelant (`sync/server.ts`, Task 7) reçoit un corps de requête brut (`request.blob()`, cf. Task 8) — construire le `File` nommé avec la bonne extension est la responsabilité de CE module, pas de l'appelant.
  - [x] `data/remote/index.ts` : ajouter `export { transcribeAudio } from "./transcription";` à la suite de l'export de `./storage` (barrel non consommé aujourd'hui par aucun fichier réel, cf. `sync/server.ts` qui importe chaque module directement — mis à jour par cohérence avec le reste du dossier, même précédent que les Stories précédentes).

- [x] Task 7: `sync/server.ts` — `pushQueueEntries` (groupe brut pour "note"), `transcribeNoteAudio` (AC: #1, #2 ; AD-3, AD-6)
  - [x] Remplacer la branche `note` de `pushQueueEntries` (elle aplatissait les champs avant cette story) :
    ```ts
    } else if (entity === "note") {
      // Groupe brut (pas aplati) : upsertNoteFields a désormais besoin de l'updatedAt par champ
      // pour peupler transcription_updated_at (AD-3, cette story) — même raison qu'upsertTaskFields
      // depuis la Story 3.6.
      await upsertNoteFields(client, entityId, group);
    } else {
    ```
  - [x] Étendre l'import : `import { transcribeAudio } from "@/data/remote/transcription";`.
  - [x] Ajouter, à la suite de `getNoteAudioPlaybackUrl` :
    ```ts
    // Wrapper fin, même précédent qu'uploadNoteAudioBlob ci-dessus (Story 5.2) : sync/server.ts
    // reste le seul point d'entrée que les route handlers app/api/* importent pour atteindre
    // data/remote/ (AD-2, AD-6) — jamais un import direct de data/remote/ depuis app/api/*.
    export async function transcribeNoteAudio(file: Blob): Promise<string> {
      return transcribeAudio(file);
    }
    ```

- [x] Task 8: `app/api/sync/transcribe-audio/route.ts` — nouvelle route (AC: #1 ; AD-6)
  - [x] Créer `app/api/sync/transcribe-audio/route.ts` :
    ```ts
    import { createSupabaseServerClient } from "@/data/remote/client";
    import { transcribeNoteAudio } from "@/sync/server";

    // app/api/sync/transcribe-audio/route.ts — reçoit l'audio brut d'une note vocale (corps de
    // requête = Blob, Content-Type audio/*, pas de FormData/JSON : plus simple qu'upload-audio
    // ici, ce module ne persiste rien lui-même — il ne fait que transcrire et retourner le
    // texte) et appelle l'API OpenAI via sync/server.ts (AD-6). Stateless côté serveur : ne lit
    // ni n'écrit aucune ligne "notes" — c'est l'appelant (app/, après réception du texte) qui
    // persiste le résultat via updateNoteTranscription (Dexie + file de synchro, AD-1). Aucun
    // segment [id] dans le chemin : rien ici n'est scopé à une note particulière côté serveur,
    // contrairement à app/api/notes/[id]/audio (qui lit audio_path pour CETTE note précise).
    // Protégé par proxy.ts comme toute autre route (cf. Dev Notes Story 3.2).
    export async function POST(request: Request) {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase.auth.getClaims();
      if (!data) {
        return new Response(null, { status: 401 });
      }

      let blob: Blob;
      try {
        blob = await request.blob();
      } catch {
        return new Response(null, { status: 400 });
      }
      if (blob.size === 0) {
        return new Response(null, { status: 400 });
      }

      try {
        const text = await transcribeNoteAudio(blob);
        return Response.json({ text });
      } catch {
        return new Response(null, { status: 500 });
      }
    }
    ```

- [x] Task 9: `sync/client.ts` — pull/merge du champ `transcription`, `markNoteFieldsSynced` (AC: #1, #2 ; AD-3)
  - [x] `PulledNoteRow` : ajouter `transcription: string | null; transcription_updated_at: string;`.
  - [x] `toLocalNote` (insertion d'une note encore inconnue localement) — le snapshot distant devient la vérité locale de référence, donc `transcriptionSyncedAt = transcription_updated_at` normalisé (même précédent que `toLocalTask`, Story 3.6 — normalisation `toIsoZ` obligatoire, cf. Dev Notes de cette story-là sur le suffixe `+00:00` vs `Z`) :
    ```ts
    function toLocalNote(row: PulledNoteRow): Note {
      const transcriptionUpdatedAt = toIsoZ(row.transcription_updated_at);
      return {
        id: row.id,
        projectId: row.project_id,
        type: row.type as Note["type"],
        content: row.content,
        audioPath: row.audio_path,
        transcription: row.transcription,
        transcriptionUpdatedAt,
        transcriptionSyncedAt: transcriptionUpdatedAt,
        transcriptionConflict: null,
        priority: row.priority as Note["priority"],
        provenance: row.provenance as Note["provenance"],
        isNew: row.is_new,
        createdAt: row.created_at,
      };
    }
    ```
  - [x] Ajouter, à la suite de `mergeExistingTask` — fusionne une ligne distante avec une note déjà connue localement, remplace l'ancienne réconciliation "isNew seulement" (insuffisante depuis que `transcription` est conflict-tracké) :
    ```ts
    // Fusionne une ligne distante avec une note déjà connue localement (AD-3, cette story) —
    // remplace l'ancienne réconciliation "isNew seulement" (Story 5.1), insuffisante maintenant
    // que transcription est un champ conflict-tracké. Même repli que mergeExistingTask pour les
    // enregistrements locaux antérieurs à cette story (transcriptionUpdatedAt/SyncedAt
    // potentiellement `undefined`, jamais `null`, cf. Dev Notes Story 3.6).
    async function mergeExistingNote(existing: Note, row: PulledNoteRow): Promise<void> {
      const localTranscriptionUpdatedAt = existing.transcriptionUpdatedAt ?? existing.createdAt;
      const localTranscriptionSyncedAt = existing.transcriptionSyncedAt ?? null;
      const remoteTranscriptionUpdatedAt = toIsoZ(row.transcription_updated_at);

      const transcriptionDecision = resolveFieldSync(
        existing.transcription,
        localTranscriptionUpdatedAt,
        localTranscriptionSyncedAt,
        row.transcription,
        remoteTranscriptionUpdatedAt,
      );

      const transcriptionNeedsWrite =
        transcriptionDecision === "adopt-remote" ||
        transcriptionDecision === "conflict" ||
        (transcriptionDecision === "noop" &&
          localTranscriptionSyncedAt !== remoteTranscriptionUpdatedAt);

      // isNew : transition à sens unique (true -> false), jamais recréée à true — même
      // réconciliation qu'avant cette story (cf. Dev Notes Story 5.1), désormais regroupée dans
      // cette même fonction plutôt que dans une branche séparée de pullOnce.
      const isNewNeedsWrite = existing.isNew && !row.is_new;

      if (!transcriptionNeedsWrite && !isNewNeedsWrite) {
        return;
      }

      await db.transaction("rw", db.notes, db.syncQueue, async (tx) => {
        const patch: Partial<Note> = {};

        if (transcriptionDecision === "adopt-remote") {
          patch.transcription = row.transcription;
          patch.transcriptionUpdatedAt = remoteTranscriptionUpdatedAt;
          patch.transcriptionSyncedAt = remoteTranscriptionUpdatedAt;
          patch.transcriptionConflict = null;
        } else if (transcriptionDecision === "conflict") {
          patch.transcriptionConflict = { local: existing.transcription, remote: row.transcription };
          // Annule le push en attente sur ce champ — sans ça, le prochain processQueue()
          // écraserait silencieusement la valeur distante avec la valeur locale conflictuelle
          // (AD-3). La valeur locale reste consultable dans transcriptionConflict.local.
          await tx.table("syncQueue").delete(syncQueueEntryId(existing.id, "transcription"));
        } else if (transcriptionNeedsWrite) {
          patch.transcriptionSyncedAt = remoteTranscriptionUpdatedAt;
          patch.transcriptionConflict = null;
        }

        if (isNewNeedsWrite) {
          patch.isNew = false;
        }

        await db.notes.update(existing.id, patch);
      });
    }
    ```
  - [x] Dans `pullOnce()`, remplacer la boucle sur `snapshot.notes` :
    ```ts
    for (const row of snapshot.notes) {
      try {
        const existing = await db.notes.get(row.id);
        if (!existing) {
          await db.notes.add(toLocalNote(row));
        } else {
          await mergeExistingNote(existing, row);
        }
      } catch {
        // idem
      }
    }
    ```
    Retirer le commentaire devenu faux juste au-dessus (*"Insertion seule pour les champs conflict-trackés (aucun sur Note dans cette story...)"*).
  - [x] Ajouter, à la suite de `markTaskFieldsSynced` :
    ```ts
    // Fait avancer le point de synchro (transcriptionSyncedAt) sur Note pour le champ
    // transcription dont le push vient de réussir (AD-3, cette story) — même rôle que
    // markTaskFieldsSynced pour status/priority (Story 3.6). S'applique aussi bien à l'entrée
    // "create" initiale (transcription: null poussée à la création, cf. Task 2) qu'à une
    // "update" ultérieure (résultat d'une vraie transcription) — aucun filtre sur `operation`,
    // même précédent que markTaskFieldsSynced.
    async function markNoteFieldsSynced(succeeded: readonly SyncQueueEntry[]): Promise<void> {
      const relevant = succeeded.filter(
        (entry) => entry.entity === "note" && entry.field === "transcription",
      );
      if (relevant.length === 0) {
        return;
      }

      await db.transaction("rw", db.notes, async () => {
        for (const entry of relevant) {
          const note = await db.notes.get(entry.entityId);
          if (!note) continue;

          if (note.transcriptionUpdatedAt === entry.updatedAt) {
            await db.notes.update(entry.entityId, { transcriptionSyncedAt: entry.updatedAt });
          }
        }
      });
    }
    ```
  - [x] Dans `processQueue()`, après `await markTaskFieldsSynced(succeededEntries);`, ajouter `await markNoteFieldsSynced(succeededEntries);`.

- [x] Task 10: `app/capture-flow.tsx` + `app/capture-flow.module.css` — transcription à la création (AC: #1)
  - [x] **Décision de conception (aucun mockup ne couvre cette interface, cf. Dev Notes) : une case à cocher, pas un second bouton.** À l'étape 3, la note n'existe pas encore tant que "Créer" n'a pas été cliqué — `updateNoteTranscription` exige un `id` de note existante (Task 2), donc un "bouton Générer la transcription" séparé et cliquable AVANT "Créer" n'aurait rien à quoi s'attacher. La case à cocher "Générer la transcription" (décochée par défaut, cohérent avec FR-17 "à la demande plutôt que systématique") transforme "Créer" en une action combinée création + transcription — reste un choix explicite de l'utilisateur (jamais déclenché automatiquement), juste reporté d'un clic distinct à une case cochée avant le même clic sur "Créer".
  - [x] Ajouter l'état, à la suite de `audioSizeCapped` : `const [transcribeAtCreation, setTranscribeAtCreation] = useState(false);`.
  - [x] Ajouter `setTranscribeAtCreation(false);` dans `resetState()` et dans `handleBackToTypeSelection()` (mêmes emplacements que les autres états liés à l'enregistrement, cf. Story 5.2).
  - [x] Ajouter, à la suite de `formatRecordingTime` :
    ```ts
    const TRANSCRIBE_AUDIO_ENDPOINT = "/api/sync/transcribe-audio";

    // POST le blob brut (Content-Type = son type MIME réel) vers la route de transcription et
    // retourne le texte — réutilisée à l'identique dans app/projects/[id]/project-view.tsx
    // (NoteDetail), dupliquée plutôt que partagée via un nouveau module (cf. Dev Notes : même
    // précédent que MAX_AUDIO_SIZE_BYTES/openNote, duplication assumée pour une poignée de
    // lignes utilisées par exactement deux call sites).
    async function requestTranscription(blob: Blob): Promise<string> {
      const response = await fetch(TRANSCRIBE_AUDIO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!response.ok) {
        throw new Error("transcription request failed");
      }
      const result = (await response.json()) as { text: string };
      return result.text;
    }
    ```
  - [x] Étendre `handleSubmitVoiceNote` — capturer la note créée, déclencher la transcription en tâche de fond si la case est cochée :
    ```ts
    async function handleSubmitVoiceNote() {
      if (pending || !recordedBlob) {
        return;
      }

      setSubmitError(undefined);
      setPending(true);

      let createdNote: Note;
      try {
        createdNote = await createVoiceNote({
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

      // Transcription à la création (FR-17) : best-effort, ne bloque jamais la création
      // elle-même ni la fermeture du flux (SUCCESS_CLOSE_DELAY_MS, 800ms — largement plus court
      // que l'aller-retour réseau + inférence OpenAI dans l'immense majorité des cas). Le
      // résultat arrive après la fermeture de la modale ; en cas d'échec (hors ligne, erreur
      // API), la note reste "audio seul", récupérable depuis le détail (Task 11). Réutilise le
      // blob déjà en mémoire (recordedBlob), pas de relecture Dexie.
      if (transcribeAtCreation) {
        const noteId = createdNote.id;
        void requestTranscription(recordedBlob)
          .then((text) => updateNoteTranscription(noteId, text))
          .catch(() => {
            // Échec silencieux assumé (cf. Dev Notes) — récupérable depuis le détail.
          });
      }

      setPending(false);
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        setOpen(false);
      }, SUCCESS_CLOSE_DELAY_MS);
    }
    ```
    Étendre l'import `@/data/local` : ajouter `updateNoteTranscription` à côté de `createNote, createVoiceNote`. Étendre l'import `@/domain` : ajouter le type `Note` (import type déjà groupé avec les autres imports `type` de ce fichier — `type Priority, type Project` existent déjà, ajouter `type Note`).
  - [x] Dans le bloc `{micState === "recorded" && recordedAudioUrl && (...)}`, ajouter la case à cocher entre l'élément `<audio>` et le `<div className={styles.actions}>` (Recommencer) :
    ```tsx
    <label className={styles.transcribeOption}>
      <input
        type="checkbox"
        className={styles.checkboxInput}
        checked={transcribeAtCreation}
        onChange={(event) => setTranscribeAtCreation(event.target.checked)}
        disabled={pending}
      />
      <span className={styles.checkboxBox} aria-hidden="true" />
      Générer la transcription
    </label>
    ```
  - [x] `app/capture-flow.module.css` — ajouter, à la fin du fichier (réplique exacte de `.filter`/`.checkboxInput`/`.checkboxBox` de `app/projects/[id]/project-view.module.css`, Story 3.4 — dupliquée plutôt que partagée cross-module, convention établie depuis la Story 2.3 pour ce type de style, cf. commentaire existant en tête du fichier ligne 25-27) :
    ```css
    /* Case à cocher "Générer la transcription" (Story 5.3, FR-17) — réplique exacte de
       .filter/.checkboxInput/.checkboxBox (app/projects/[id]/project-view.module.css,
       Story 3.4/DESIGN.md.components.checkbox), dupliquée cross-module (convention établie). */
    .transcribeOption {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 44px;
      color: var(--color-muted);
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      cursor: pointer;
    }

    .checkboxInput {
      composes: visuallyHidden;
    }

    .visuallyHidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .checkboxBox {
      flex-shrink: 0;
      position: relative;
      width: 13px;
      height: 13px;
      border: 1.5px solid var(--color-muted);
      border-radius: 4px;
      background: var(--color-bg);
    }

    .checkboxInput:checked + .checkboxBox {
      border-color: var(--color-primary);
      background: var(--color-primary);
    }

    .checkboxInput:checked + .checkboxBox::after {
      content: "";
      position: absolute;
      left: 3px;
      top: 0.5px;
      width: 4px;
      height: 7px;
      border: solid var(--color-on-primary);
      border-width: 0 1.6px 1.6px 0;
      transform: rotate(45deg);
    }

    .checkboxInput:focus-visible + .checkboxBox {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
    ```
    Pas de variante `@media (prefers-color-scheme: dark)` pour `.transcribeOption`/`.checkboxBox` (contrairement à l'original de `project-view.module.css`, qui assombrit `--color-muted`) : ce fichier n'a jusqu'ici aucune règle `dark` sur `--color-muted`/`--color-border` (vérifié — `capture-flow.module.css` actuel n'a que 3 blocs `dark`, tous sur des couleurs différentes), et `--color-muted`/`--color-primary`/`--color-bg` sont déjà des tokens qui s'adaptent nativement au thème (cf. `app/globals.css`) — la version originale les surcharge uniquement pour un cas de contraste spécifique (`--color-muted-dark`) non requis ici tant qu'aucun problème de contraste réel n'est constaté en vérification manuelle.

- [x] Task 11: `app/projects/[id]/project-view.tsx` — bouton/bandeau/affichage de la transcription (AC: #1, #2)
  - [x] Étendre l'import `@/data/local` : ajouter `updateNoteTranscription` à côté de `markNoteOpened`.
  - [x] Ajouter les constantes, à côté de `AUDIO_NOT_YET_AVAILABLE_MESSAGE` :
    ```ts
    const AUDIO_ONLY_LABEL = "Audio seul — aucune transcription.";
    const GENERATE_TRANSCRIPTION_LABEL = "Générer la transcription";
    const TRANSCRIBING_LABEL = "Transcription en cours…";
    const TRANSCRIPTION_FAILED_MESSAGE = "La transcription a échoué. Réessayez.";
    const NO_TRANSCRIPTION_LABEL = "Audio seul (pas de transcription)";
    const TRANSCRIBE_AUDIO_ENDPOINT = "/api/sync/transcribe-audio";
    ```
  - [x] Ajouter, au niveau module (même fonction qu'`app/capture-flow.tsx`, dupliquée — cf. Dev Notes de cette story et de la Task 10) :
    ```ts
    async function requestTranscription(blob: Blob): Promise<string> {
      const response = await fetch(TRANSCRIBE_AUDIO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!response.ok) {
        throw new Error("transcription request failed");
      }
      const result = (await response.json()) as { text: string };
      return result.text;
    }
    ```
  - [x] Dans `ProjectView`, ajouter le handler (même précédent que `handleStatusChange`/`handlePriorityChange`) :
    ```ts
    async function handleTranscriptionChange(note: Note, transcription: string | null) {
      try {
        await updateNoteTranscription(note.id, transcription);
      } catch {
        // Échec silencieux assumé — écriture Dexie locale, pas réseau (AD-1), même rationale
        // que handleStatusChange/handlePriorityChange.
      }
    }
    ```
    Passer `onTranscriptionChange={handleTranscriptionChange}` à `<NoteDetail>`.
  - [x] `NoteCard` — remplacer le libellé statique "Note vocale" par la transcription quand elle existe (rend la note effectivement "cherchable" visuellement, cf. FR-17 ; `.noteContent` tronque déjà sur 2 lignes, réutilisé tel quel) et ajouter la puce de conflit (même précédent que `TaskCard`, Story 3.6) :
    ```tsx
    function NoteCard({
      note,
      onOpen,
    }: {
      note: Note;
      onOpen: (note: Note) => void;
    }) {
      return (
        <li className={styles.taskCard}>
          <button
            type="button"
            className={styles.taskCardButton}
            onClick={() => onOpen(note)}
          >
            {note.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {note.isNew ? "Nouveau" : ""}
            </span>
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {note.transcriptionConflict ? "Conflit de synchronisation détecté" : ""}
            </span>

            <div className={styles.taskCardRow}>
              <PriorityChip priority={note.priority} />
              {note.type === "voice" ? (
                <span className={styles.noteContent}>{note.transcription ?? "Note vocale"}</span>
              ) : (
                <span className={styles.noteContent}>{note.content}</span>
              )}
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[note.provenance]}
              </span>
              {note.transcriptionConflict && (
                <span className={styles.metaPill} data-conflict="true">
                  Conflit de synchronisation — à vérifier
                </span>
              )}
            </div>
          </button>
        </li>
      );
    }
    ```
  - [x] `NoteDetail` — ajouter la prop `onTranscriptionChange`, l'état local de la requête de transcription, le bandeau de conflit et le bouton :
    ```tsx
    function NoteDetail({
      note,
      onClose,
      onTranscriptionChange,
    }: {
      note: Note | null;
      onClose: () => void;
      onTranscriptionChange: (note: Note, transcription: string | null) => void;
    }) {
      const closeButtonRef = useRef<HTMLButtonElement>(null);
      const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
      const [transcribing, setTranscribing] = useState(false);
      const [transcribeError, setTranscribeError] = useState<string | undefined>();

      useEffect(() => {
        setTranscribeError(undefined);
        setTranscribing(false);
      }, [note?.id]);

      // ... effets de focus et de blob local audio existants (inchangés) ...
    ```
    (Les deux `useEffect` existants — focus et blob local audio — restent inchangés ; le nouvel effet ci-dessus est un troisième effet indépendant, à ajouter à leur suite : évite de mélanger la réinitialisation de l'état de transcription avec la logique de focus/blob, qui a sa propre dépendance et son propre cleanup.)
  - [x] Ajouter, à la suite du `if (!note) return null;` (dans le corps de la fonction, avant `handleKeyDown`) :
    ```ts
    async function handleGenerateTranscription() {
      if (transcribing) {
        return;
      }
      setTranscribeError(undefined);
      setTranscribing(true);
      try {
        // Blob local en priorité (même précédent que la lecture audio, cf. Story 5.2) — sur
        // l'appareil qui a enregistré la note, évite un aller-retour réseau inutile. Sur un
        // autre appareil (aucun blob local), retombe sur la même route déjà utilisée pour la
        // lecture (app/api/notes/[id]/audio) : elle suit déjà la redirection signée vers
        // Supabase Storage et retourne les octets audio.
        const localBlob = await getNoteAudio(note.id);
        const blob =
          localBlob ??
          (await fetch(`/api/notes/${note.id}/audio`).then((response) => {
            if (!response.ok) {
              throw new Error("audio fetch failed");
            }
            return response.blob();
          }));
        const text = await requestTranscription(blob);
        onTranscriptionChange(note, text);
      } catch {
        setTranscribeError(TRANSCRIPTION_FAILED_MESSAGE);
      } finally {
        setTranscribing(false);
      }
    }
    ```
  - [x] Dans le JSX de `NoteDetail`, ajouter le bandeau de conflit juste après `.detailHeader` (même emplacement que `TaskDetail`, avant le rendu du contenu) :
    ```tsx
    {note.transcriptionConflict && (
      <ConflictBanner
        label="Transcription"
        localLabel={note.transcriptionConflict.local ?? NO_TRANSCRIPTION_LABEL}
        remoteLabel={note.transcriptionConflict.remote ?? NO_TRANSCRIPTION_LABEL}
        onChoose={(choice) =>
          onTranscriptionChange(
            note,
            choice === "local"
              ? note.transcriptionConflict!.local
              : note.transcriptionConflict!.remote,
          )
        }
      />
    )}
    ```
  - [x] Remplacer le bloc `{note.type === "voice" ? (...) : (...)}` existant :
    ```tsx
    {note.type === "voice" ? (
      localAudioUrl || note.audioPath ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- lecture seule, pas de piste
              de sous-titres pertinente pour une note vocale personnelle (cf. Story 5.2) */}
          <audio
            className={styles.audioPreview}
            controls
            src={localAudioUrl ?? `/api/notes/${note.id}/audio`}
          />
          {note.transcription ? (
            <p className={styles.detailDescription} data-transcribed="true">
              {note.transcription}
            </p>
          ) : (
            <>
              {/* État "audio seul" visuellement distinct de "transcrit" (AC#2, EXPERIENCE.md
                  State Patterns) — présence/absence du bloc texte + bouton ci-dessous, pas une
                  couleur ou un badge supplémentaire (cohérent avec le principe déjà appliqué à
                  la puce de conflit, Story 3.6 : réutiliser la structure plutôt qu'inventer). */}
              <p className={styles.empty}>{AUDIO_ONLY_LABEL}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={handleGenerateTranscription}
                  disabled={transcribing}
                >
                  {transcribing ? TRANSCRIBING_LABEL : GENERATE_TRANSCRIPTION_LABEL}
                </button>
              </div>
              {transcribeError && (
                <p className={styles.error} role="alert">
                  {transcribeError}
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <p className={styles.detailDescription}>{AUDIO_NOT_YET_AVAILABLE_MESSAGE}</p>
      )
    ) : (
      <p className={styles.detailDescription}>{note.content}</p>
    )}
    ```
    Le bouton "Générer la transcription" n'est rendu que si l'audio est déjà disponible (local ou distant) — jamais tenté sur une note dont l'audio est encore "en cours de synchronisation" (échec certain sinon).
  - [x] Aucun nouveau style dans `app/projects/[id]/project-view.module.css` — réutilise intégralement `.metaPill[data-conflict]`, `.conflictBanner`/`.conflictBannerLabel`/`.conflictOption` (`ConflictBanner`, générique depuis la Story 3.6), `.actions`, `.ghostButton`, `.empty`, `.error`, `.detailDescription`, `.audioPreview`.

- [x] Task 12: `package.json` + `.env.example` — dépendance `openai`, variable d'environnement (AC: #1)
  - [x] `package.json` : `openai` déjà ajouté aux dépendances par la commande `npm install` de la Task 6 (insérée alphabétiquement entre `next` et `react` par npm) — vérifier que c'est bien le cas après coup.
  - [x] `.env.example` : remplacer le bloc
    ```
    # Ajoutées par Epic 5 (transcription) :
    # OPENAI_API_KEY=
    ```
    par
    ```
    # OpenAI (transcription à la demande des notes vocales — FR-17, AD-6)
    OPENAI_API_KEY=
    ```
    (décommentée : cette story implémente effectivement Epic 5/FR-17, contrairement à quand ce bloc a été écrit en prévision, Story 1.1). Guillaume doit renseigner `OPENAI_API_KEY` (clé API OpenAI, projet personnel) dans les variables d'environnement Render **et** dans son `.env` local avant toute vérification manuelle réseau de cette story — sans elle, `requireEnv("OPENAI_API_KEY")` lève systématiquement (`data/remote/transcription.ts`), la route `/api/sync/transcribe-audio` répond 500 à chaque appel.

- [ ] Task 13: Vérification manuelle de bout en bout (AC: #1, #2)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Exécuter la migration SQL de la Task 3 avant toute vérification réseau/synchro.
  - [x] **Guillaume renseigne `OPENAI_API_KEY`** (Task 12) avant toute vérification de cette story qui appelle réellement l'API OpenAI — sans elle, seule la vérification "audio seul reste consultable" (AC#2) est possible. **Renseignée dans `.env` local** (présence confirmée sans lecture de la valeur) ; **Render (production) reste à renseigner séparément avant tout déploiement**, non requis pour la vérification manuelle locale.
  - [x] **AC#1 (à la création)** : flux "+", "Note vocale", enregistrer un court audio, cocher "Générer la transcription", "Créer". Vérifier : la modale se ferme normalement ("Enregistré.") sans attendre la transcription ; après un délai (quelques secondes, latence OpenAI), rouvrir le détail de la note depuis l'onglet Notes — la transcription apparaît (texte affiché à la place du bouton "Générer la transcription"). Vérifier côté Supabase (Table Editor) que `notes.transcription`/`notes.transcription_updated_at` sont bien renseignés après convergence de la synchro. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [x] **AC#1 (depuis le détail)** : créer une note vocale SANS cocher la case. Ouvrir son détail, cliquer "Générer la transcription" — état "Transcription en cours…" affiché, bouton désactivé pendant l'appel ; à la réussite, le texte transcrit remplace le bouton. **Vérifié par Guillaume en conditions réelles — bug réel trouvé et corrigé en cours de vérification (transcription vide traitée comme "audio seul", cf. Debug Log), revérifié après correction : fonctionne.**
  - [x] **AC#1 (échec réseau)** : couper le réseau (DevTools Offline) avant de cliquer "Générer la transcription" depuis le détail — message d'erreur affiché ("La transcription a échoué. Réessayez."), la note reste par ailleurs pleinement consultable (audio toujours lisible). **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [x] **AC#2 (état "audio seul" distinct)** : une note vocale jamais transcrite affiche "Audio seul — aucune transcription." + le bouton "Générer la transcription" dans le détail (jamais le texte transcrit) ; sur la carte, elle affiche "Note vocale" (jamais un texte de transcription vide/tronqué). L'audio reste lisible dans les deux cas (transcrite ou non) — non-régression Story 5.2. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [ ] **Non vérifié — bloqué par l'incident Supabase externe (cf. Debug Log)**, la synchronisation elle-même étant en échec (`GET /api/sync/pull` → 500, `PGRST303` "JWT issued at future"), sans rapport avec le code de cette story. **Conflit de transcription (AD-3)** : deux profils navigateur (même précédent que la Story 3.6, Task 8), authentifiés avec le même compte. Créer une note vocale dans le Profil 1, attendre "À jour" dans les deux profils (la note existe des deux côtés). Passer les deux profils hors ligne. Dans le Profil 1, générer une transcription (le texte reste local tant que hors ligne). Dans le Profil 2, générer une transcription DIFFÉRENTE de la même note (même procédé — mais si `OPENAI_API_KEY` n'est disponible que côté serveur unique, simuler le "device 2" par un appel direct `fetch("/api/sync/push", ...)` avec un `deviceId`/`entityId`/`field: "transcription"`/`value`/`updatedAt` arbitraires depuis la console, même précédent que la vérification manuelle de la Story 3.6). Repasser le Profil 2 en ligne en premier (sa valeur atteint Supabase). Repasser le Profil 1 en ligne : la puce "Conflit de synchronisation — à vérifier" apparaît sur la carte ET dans le détail (bandeau "Transcription" avec les deux valeurs) ; taper l'une des deux options efface le conflit et repousse la valeur choisie (vérifier dans Supabase).
  - [ ] **Non vérifié — même blocage que ci-dessus (incident Supabase).** **AC#3 de la Story 3.6, étendu à Note (champs différents, pas de conflit)** : vérifier qu'un changement de `priority`/`isNew` sur une note en parallèle d'une transcription sur l'autre appareil ne déclenche jamais de conflit (résolution indépendante par champ, déjà garantie par `resolveFieldSync`).
  - [x] Vérifier la non-régression : capture de tâche/note texte/note vocale (Stories 3.1/5.1/5.2), tri combinable, conflit de statut/priorité sur les tâches (Story 3.6 — aucun changement de comportement attendu), indicateur de synchronisation, lecture audio locale/distante. **Partiellement vérifié par Guillaume** : capture tâche/note texte/note vocale, onglet Documents, aucune régression constatée pendant les Points 1-4. **Non vérifiable pour la partie "indicateur de synchronisation en bonne santé"** — bloqué par un incident Supabase externe en cours (rejet des jetons JWT par PostgREST, `PGRST303`, confirmé sur status.supabase.com, sans rapport avec le code de cette story), cf. Debug Log.
  - [x] Vérifier le clavier : la case à cocher de l'étape 3 est atteignable au Tab, activable à l'Espace, anneau de focus visible ; le bouton "Générer la transcription" du détail de même. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [ ] Supprimer les données de test (notes créées pour la vérification) en IndexedDB **et** dans le dashboard Supabase (Table Editor), dans les deux profils, en fin de session. **Reporté** : à faire par Guillaume une fois l'incident Supabase résolu et les données effectivement synchronisées côté serveur.

## Dev Notes

**Le champ `transcription` est conflict-tracké, contrairement à `audioPath` (Story 5.2) — c'est la décision structurante de cette story.** AD-3 liste explicitement les binds : *"Task.status, priority partagée Task/Note/Document, Note.transcription"* — `transcription` y figure nommément, `audioPath` n'y a jamais figuré. Conséquence directe et non négociable : `Note.transcription` porte exactement la même mécanique `*UpdatedAt`/`*SyncedAt`/`*Conflict` que `Task.status`/`Task.priority` (Story 3.6), avec `resolveFieldSync` (`domain/sync.ts`, déjà écrit et réutilisé tel quel — rien à modifier dans ce fichier pour cette story). Le piège à éviter (et la raison pour laquelle `transcription: null` DOIT être poussé dès `enqueueCreate`, contrairement à `audioPath`, cf. Task 2) : sans cette poussée initiale, `transcriptionSyncedAt` resterait bloqué à `null` sur l'appareil d'origine, et `resolveFieldSync` traite `localSyncedAt === null` comme "les deux ont changé" par défaut — tout premier pull d'une transcription générée ailleurs serait alors systématiquement classé "conflit" au lieu d'un "adopt-remote" légitime, même si l'appareil d'origine n'a lui-même jamais touché ce champ. C'est exactement le même risque que celui documenté dans les Dev Notes de la Story 3.6 pour `Task.status`/`priority` ("le piège le plus probable d'une implémentation partielle"), transposé à `Note`.

**Pourquoi `content` ne porte jamais la transcription (confirmation d'une décision déjà prise en Story 5.1/5.2).** `domain/note.ts` documentait déjà, avant cette story, que `content` reste `""` pour une note vocale "jusqu'à transcription à la demande (FR-17, Story 5.3)" — formulation ambiguë a posteriori (elle pouvait laisser penser que `content` allait ACCUEILLIR la transcription). Ce n'est pas le cas : `transcription` est un champ à part entière, jamais fusionné dans `content`. Raisons : (1) `content` sert de "titre" affiché tronqué sur les cartes de note TEXTE (`NoteCard`, `noteContent`) — y écrire la transcription d'une note vocale casserait la distinction visuelle type texte/vocal sur la carte, déjà résolue autrement par cette story (`note.transcription ?? "Note vocale"`) ; (2) AD-3 nomme explicitement `Note.transcription`, pas `Note.content`, comme champ conflict-tracké — les binds de la spine font autorité sur le nom du champ.

**Pourquoi une case à cocher à l'étape 3, pas un second bouton "Générer la transcription" à côté de "Créer".** `EXPERIENCE.md` décrit un "Bouton explicite 'Générer la transcription'... disponible à la création (étape 3) ou après coup depuis le détail" — sans mockup dédié pour préciser la mécanique exacte à l'étape 3 (aucun `mockups/*.html` ne couvre l'enregistrement vocal, cf. Dev Notes Story 5.2, situation inchangée ici). Un second bouton cliquable AVANT "Créer" n'aurait rien à quoi attacher la transcription : `updateNoteTranscription` (Task 2) exige un `id` de note déjà créée, et l'architecture locale-first (AD-1) interdit d'inventer un id "provisoire" pré-création pour contourner ça. La case à cocher (décochée par défaut — cohérent avec "à la demande plutôt que systématique", FR-17) reste un choix explicite unique avant le clic sur "Créer", qui déclenche alors les deux actions (création + transcription) en une seule intention utilisateur, sans jamais transcrire automatiquement une note dont la case n'a pas été cochée.

**La transcription à la création est "best-effort" et fire-and-forget — ne bloque jamais la fermeture du flux.** `SUCCESS_CLOSE_DELAY_MS` (800ms, Story 3.1) ferme la modale bien avant qu'un aller-retour réseau + inférence OpenAI n'ait eu la moindre chance d'aboutir dans l'immense majorité des cas. Bloquer "Créer" sur la transcription violerait le paradigme local-first (AD-1 : la capture doit rester quasi-instantanée et fonctionner hors ligne) — FR-16 (Story 5.2) reste garanti : la capture d'une note vocale ne dépend jamais du réseau, la transcription est une amélioration strictement additive et différée. Le résultat (succès ou échec) arrive après coup ; en cas d'échec (hors ligne, quota OpenAI, erreur API), la note reste "audio seul", récupérable manuellement depuis le détail (bouton "Générer la transcription", Task 11) — aucune perte, aucun état bloqué.

**Pourquoi la route `/api/sync/transcribe-audio` est stateless (ne lit ni n'écrit aucune ligne `notes`).** Contrairement à `/api/sync/upload-audio` (Story 5.2, qui écrit dans Supabase Storage ET a besoin du `noteId` pour construire le chemin `{user_id}/{noteId}.<ext>`), la transcription ne persiste rien côté serveur — elle prend un blob audio en entrée, retourne du texte en sortie, un point. Le lien "quelle note a été transcrite" est géré exclusivement côté client (`updateNoteTranscription`, appelée juste après la réponse), qui écrit d'abord en local (Dexie) puis met le résultat en file de synchronisation comme n'importe quel autre champ (AD-1 : toute écriture initiée par l'utilisateur passe par Dexie d'abord). Ce choix évite d'avoir à faire porter un `noteId` (et donc un segment `[id]` dynamique) à une route qui n'en a structurellement pas besoin — plus simple que de suivre exactement le patron de `/api/notes/[id]/audio`.

**Pourquoi le nom de fichier envoyé à OpenAI porte une extension dérivée du `Content-Type`, pas un nom générique.** L'API de transcription OpenAI valide le format audio via l'extension du nom de fichier fourni (recherche technique, Step 4 de ce workflow — confirmé par la documentation et plusieurs rapports de l'erreur "Invalid file format" causée par un nom sans extension reconnue, même pour un audio parfaitement valide). `audioExtensionFromMimeType` (`data/remote/storage.ts`, déjà écrite en Story 5.2 pour dériver l'extension du chemin Supabase Storage) est exportée et réutilisée telle quelle plutôt que dupliquée — même mapping, un seul point de mise à jour si `pickAudioMimeType` (`app/capture-flow.tsx`) gagne de nouveaux candidats.

**`gpt-transcribe` (pas `whisper-1`) — confirmé par recherche web (Step 4).** AD-8 documente déjà cette bascule au niveau de l'architecture ("whisper-1... dé-priorisé par OpenAI au profit de ce nouveau modèle"). Recherche complémentaire pour cette story : `gpt-transcribe` est un modèle réel, disponible sur l'endpoint standard `/v1/audio/transcriptions` (SDK Node `openai.audio.transcriptions.create({ file, model: "gpt-transcribe" })`), released 2026-08-05, coexistant avec `whisper-1`/`gpt-4o-transcribe`/`gpt-4o-mini-transcribe` sur le même endpoint — la réponse par défaut (`response_format` omis) retourne `{ text: "..." }`, exactement ce que `transcribeAudio` consomme. Le SDK Node accepte un objet `File` natif (Web API, disponible globalement en Node 20+, déjà utilisé sans import explicite ailleurs dans ce projet — cf. `app/api/sync/upload-audio/route.ts`, `formData.get("file")`) directement comme paramètre `file`, sans nécessiter de flux filesystem (`fs.createReadStream`) ni de conversion `Buffer`/`Readable` intermédiaire.

**`openai` est une toute nouvelle dépendance — premier vrai appel à une API tierce non-Supabase de ce projet.** Contrairement à `web-push` (dans `ARCHITECTURE-SPINE.md` Stack depuis le début, mais toujours absent de `package.json` — Epic 7 pas encore implémenté), `openai` doit être installé par cette story puisque FR-17 en dépend directement. Version constatée au moment de la création de cette story (recherche web, Step 4) : `7.8.0` — à vérifier/mettre à jour au moment de l'implémentation réelle si une version plus récente est disponible (`npm install openai@latest`).

**Aucun changement à `domain/sync.ts`.** `resolveFieldSync`/`FieldConflict`/`FieldSyncDecision` (Story 3.6) sont génériques et déjà entièrement suffisants pour `Note.transcription` — le commentaire de ce fichier annonçait déjà *"Note.transcription s'y ajoutera en Epic 5"*, c'est désormais chose faite sans qu'aucune ligne de ce fichier n'ait besoin de changer.

**Aucune nouvelle version de schéma Dexie.** Mêmes raisons que la Story 3.6 pour `Task` : les nouveaux champs de `Note` sont des propriétés d'objet ordinaires, jamais utilisées comme index Dexie.

**Compatibilité avec les notes locales antérieures à cette story.** Une note créée par les Stories 5.1/5.2 (avant ce déploiement) n'a pas les nouveaux champs en IndexedDB — `existing.transcriptionUpdatedAt`/`existing.transcriptionSyncedAt` y seraient `undefined`, pas `null` (Dexie ne force aucun schéma sur des propriétés non indexées). `mergeExistingNote` applique le même repli que `mergeExistingTask` (`?? existing.createdAt` / `?? null`) — comportement déjà couvert et documenté par la Story 3.6 (même risque, même filet de sécurité). Comme pour cette story-là : si ce cas se présente en vérification manuelle, traiter comme un signal de donnée de test oubliée plutôt qu'un bug (aucune note de test ne devrait subsister d'une session à l'autre, cf. Debug Log des stories précédentes).

### Project Structure Notes

Fichiers créés :
```text
data/remote/transcription.ts                # transcribeAudio (appel OpenAI gpt-transcribe)
app/api/sync/transcribe-audio/route.ts      # POST — transcrit un blob audio, stateless
```

Fichiers modifiés :
```text
domain/note.ts                              # + transcription/transcriptionUpdatedAt/transcriptionSyncedAt/transcriptionConflict, setNoteTranscription
domain/index.ts                             # + export setNoteTranscription
data/local/notes.ts                         # createNote/createVoiceNote += transcription (poussée à la création) ; + updateNoteTranscription
data/local/index.ts                         # + export updateNoteTranscription
data/remote/sync.ts                         # RemoteNoteRow += transcription/transcription_updated_at ; noteFieldsToColumns += transcription ; upsertNoteFields (nouvelle signature, entries bruts)
data/remote/storage.ts                      # audioExtensionFromMimeType exportée (réutilisée par transcription.ts)
data/remote/index.ts                        # + export transcribeAudio
sync/server.ts                              # pushQueueEntries (note : group brut) ; + transcribeNoteAudio
sync/client.ts                              # PulledNoteRow += transcription/transcription_updated_at ; toLocalNote étendu ; + mergeExistingNote (remplace la réconciliation isNew-only) ; pullOnce ; + markNoteFieldsSynced ; + retryPendingTranscriptions (revue de code) ; processQueue/runSyncCycle étendus
app/capture-flow.tsx                        # + case "Générer la transcription", requestTranscription, handleSubmitVoiceNote étendu (+ marqueur pending, revue de code)
app/capture-flow.module.css                 # + .transcribeOption/.checkboxInput/.checkboxBox/.visuallyHidden
app/projects/[id]/project-view.tsx          # NoteCard (transcription + puce conflit), NoteDetail (+onTranscriptionChange, bandeau conflit, bouton/états transcription, correctifs de revue : garde currentNoteIdRef, blob local réutilisé, hasVoiceAudio, restructuration audio/transcription), ProjectView (+handleTranscriptionChange)
data/local/db.ts                            # + table pendingTranscriptions, version 6 (revue de code)
package.json                                # + dépendance openai
.env.example                                # OPENAI_API_KEY décommentée
```

Fichier créé pendant la revue de code (voir Change Log) :
```text
data/local/pending-transcription.ts         # markTranscriptionPending/clearTranscriptionPending/isTranscriptionPending/listPendingTranscriptionNoteIds — marqueur local durable, corrige une perte silencieuse de transcription trouvée en revue
```

Aucun changement à `domain/sync.ts` (déjà suffisant), `app/api/notes/[id]/audio/route.ts` (réutilisée telle quelle pour récupérer l'audio distant en fallback), `app/api/sync/push/route.ts`/`app/api/sync/pull/route.ts` (signatures déjà génériques), `data/remote/client.ts`, `proxy.ts` (protège déjà `/api/sync/*` par construction du matcher).

**Migration Supabase :** exécutée par Guillaume (Task 3) sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (cf. précédent Stories 3.2/3.6/5.1/5.2), le SQL vit dans le texte de la Task 3 de cette story.

**Variable d'environnement :** `OPENAI_API_KEY` doit être renseignée par Guillaume (Render + `.env` local) avant toute vérification réseau réelle de cette story (Task 12/13).

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 5.2). Vérification manuelle exhaustive en Task 13, contre le projet Supabase de production réel (pas d'environnement de staging) ET l'API OpenAI réelle (pas de mock — `OPENAI_API_KEY` doit être configurée au préalable). Attention particulière à : la fermeture de la modale de capture qui n'attend jamais la transcription (comportement fire-and-forget attendu, pas un bug) ; la simulation de conflit à deux profils navigateur (même précédent que la Story 3.6, Task 8) appliquée cette fois à `Note.transcription` plutôt qu'à `Task.status`/`priority` ; l'état "audio seul" qui doit rester pleinement fonctionnel et visuellement distinct, jamais bloquant (AC#2, non-régression explicite de FR-16).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5: Notes (texte & vocal), Story 5.3 (texte exact des 2 AC, FR-17 couvert par cette story)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#FR-17 ("Pour toute note vocale, l'utilisateur choisit — à la création ou après coup — de générer une transcription texte (via Whisper) ou de garder l'audio seul... La transcription n'est jamais générée automatiquement sans action explicite de l'utilisateur... Une note vocale sans transcription reste pleinement valide et consultable (lecture audio)") ; §2 Glossaire ("Note vocale — ... avec transcription textuelle optionnelle générée à la demande (Whisper)")]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-3 (binds exacts "Task.status, priority partagée Task/Note/Document, Note.transcription" — algorithme exact de résolution de conflit par champ, réutilisé sans modification) ; AD-6 (binds "FR-17, FR-36, FR-38, data/remote/" — "Les appels à l'API OpenAI (transcription)... ne s'exécutent que dans du code serveur") ; AD-8 (Stack — "OpenAI — transcription | gpt-transcribe (remplace whisper-1, dé-priorisé par OpenAI au profit de ce nouveau modèle)") ; Capability → Architecture Map "4.4 Notes — FR-15 à FR-17 | data/local/ (blob audio), app/ route handler (transcription serveur) | AD-5, AD-6, AD-3" ; Consistency Conventions (variables d'environnement serveur uniquement — OPENAI_API_KEY)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Contrôle de transcription | Détail d'une note vocale | Bouton explicite 'Générer la transcription' — jamais déclenché automatiquement ; disponible à la création (étape 3) ou après coup depuis le détail") ; State Patterns ("Note vocale sans transcription | Détail note | État 'audio seul' visuellement distinct de 'transcrit' — pas une erreur, un choix assumé de l'utilisateur")]
- [Source: _bmad-output/implementation-artifacts/3-6-resolution-de-conflit-de-synchronisation-par-champ.md — patron complet de résolution de conflit par champ réutilisé à l'identique pour Note.transcription : resolveFieldSync/FieldConflict (domain/sync.ts, inchangés), setTaskStatus/setTaskPriority → setNoteTranscription (même rôle), mergeExistingTask → mergeExistingNote, markTaskFieldsSynced → markNoteFieldsSynced, upsertTaskFields (signature entries bruts) → upsertNoteFields, ordre pull-puis-push déjà garanti par runSyncCycle (sync/client.ts, Story 5.2, inchangé par cette story), ConflictBanner (générique, réutilisé tel quel sans modification), piège documenté du `*SyncedAt` jamais mis à jour deux fois]
- [Source: _bmad-output/implementation-artifacts/5-2-enregistrement-dune-note-vocale.md — Note.type/audioPath, createVoiceNote, getNoteAudio (data/local/note-audio.ts, réutilisée pour la lecture locale-prioritaire du blob avant transcription), app/api/notes/[id]/audio/route.ts (réutilisée en fallback), audioExtensionFromMimeType (data/remote/storage.ts, exportée et réutilisée par cette story), pickAudioMimeType (app/capture-flow.tsx), décision déjà actée "pas de champ transcription séparé avant cette story-là" (désormais réalisée)]
- [Source: domain/sync.ts, domain/task.ts — resolveFieldSync/FieldConflict/FieldSyncDecision/syncQueueEntryId existants (Story 3.6), réutilisés sans aucune modification par cette story]
- [Source: recherche web (Step 4 de ce workflow, 2026-09) — OpenAI "gpt-transcribe" : modèle réel, released 2026-08-05, endpoint /v1/audio/transcriptions, coexiste avec whisper-1/gpt-4o-transcribe/gpt-4o-mini-transcribe ; SDK Node `openai` (paquet npm, dernière version constatée 7.8.0) accepte un objet File natif directement en paramètre `file` de `client.audio.transcriptions.create({ file, model })` ; réponse par défaut `{ text: string }` ; l'API valide le format audio via l'extension du nom de fichier fourni (formats supportés incluant webm/m4a/ogg/mp3/wav), pas seulement le Content-Type — source de l'erreur "Invalid file format" si le nom de fichier est générique sans extension reconnue]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre.
- `npm run lint` : propre (une erreur `react-hooks/set-state-in-effect` corrigée en cours de route — l'effet de reset de `transcribeError`/`transcribing` dans `NoteDetail` appelait `setState` directement dans le corps de l'effet ; corrigé en déplaçant ces deux appels dans la fonction de nettoyage de l'effet, même précédent que l'effet de reset d'`audioLoadError` déjà présent dans ce même composant, fixé pendant la revue de la Story 5.2).
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker, y compris la nouvelle route `app/api/sync/transcribe-audio` correctement enregistrée comme dynamique).
- Deux erreurs TypeScript corrigées en cours de route dans `app/projects/[id]/project-view.tsx` (`NoteDetail`) : (1) `note` restait typé `Note | null` à l'intérieur de `handleGenerateTranscription` malgré le garde `if (!note) return null;` précédent — converti la fonction d'une déclaration (`function handleGenerateTranscription() {}`, hoistée) en une expression assignée à une constante (`const handleGenerateTranscription = async () => {}`), seule forme pour laquelle TypeScript propage le rétrécissement de type d'un paramètre capturé par une fonction imbriquée ; (2) l'expression `localBlob ?? (await fetch(...).then(...))` pour obtenir le blob audio (local en priorité, distant en repli) s'inférait en `Blob | undefined` au lieu de `Blob` — remplacée par une forme séquentielle plus simple (`let blob = await getNoteAudio(...); if (!blob) { ... blob = await response.blob(); }`), plus lisible et sans ambiguïté d'inférence.
- Une erreur de build CSS Modules corrigée dans `app/capture-flow.module.css` : `composes: visuallyHidden;` levait "referenced class name 'visuallyHidden' in composes not found" — la résolution de `composes` par `css-loader` est sensible à l'ordre de déclaration dans le fichier (contrairement à une règle CSS normale), et `.visuallyHidden` avait été placée après `.checkboxInput` qui la référence. Corrigé en réordonnant (`.visuallyHidden` avant `.checkboxInput`), conforme à l'ordre déjà utilisé dans `app/projects/[id]/project-view.module.css` (source de la réplique).
- Version `openai` constatée au moment de l'installation réelle (`npm view openai version`) : `7.8.0`, identique à celle anticipée dans la story — aucun ajustement nécessaire.
- Confirmé directement dans `node_modules/openai` (types `.d.ts` du paquet installé, pas seulement la recherche web de la story) : `gpt-transcribe` est une valeur acceptée par `TranscriptionCreateParams.model`, `Uploadable` inclut `File` nativement (pas de conversion `Buffer`/stream nécessaire), et le SDK n'a pas besoin d'annotation de type supplémentaire pour `client.audio.transcriptions.create({ file, model })`.
- **Travail concurrent détecté en cours de session** : `app/projects/[id]/project-view.tsx` et `data/remote/storage.ts` ont été modifiés par une session parallèle (revue de code de la Story 5.2, dev server déjà actif sur le port 3000) pendant l'implémentation de cette story — notamment l'ajout d'un état `audioLoadError`/`AUDIO_LOAD_ERROR_MESSAGE` dans `NoteDetail` (gestion d'un échec de chargement de l'élément `<audio>`) et un resserrement du message d'erreur `isAlreadyExistsError` dans `data/remote/storage.ts`. Les changements de cette story ont été intégrés par-dessus ces modifications sans les écraser (relu l'état réel sur disque avant chaque édition de ces deux fichiers, plutôt que de se fier au contenu vu pendant `create-story` — même précédent que la Story 5.2 avec les fichiers partagés de la Story 5.1).
- **Tentative de `preview_start` sur un port libre (autoPort) infructueuse** (port 3000 déjà occupé par le serveur `next dev` de la session parallèle) — même situation que documentée dans le Debug Log de la Story 5.2 : le processus n'apparaît plus dans `preview_list` juste après son démarrage, la navigation échoue. Abandonné — aucune vérification dans le panneau Browser n'a donc été possible pour cette story (aucune session authentifiée disponible non plus, contrairement à la Story 5.2 où Guillaume s'était connecté en cours de session).
- **Task 3 (migration SQL Supabase) non exécutable par l'agent** : aucun outil MCP Supabase/base de données disponible dans cette session (vérifié explicitement), même situation que toutes les stories précédentes touchant le schéma Postgres (3.2, 3.6, 5.1, 5.2). Le SQL est prêt dans le texte de la Task 3 ; reste à exécuter par Guillaume dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc`.
- **Bug réel trouvé et corrigé pendant la vérification manuelle de Guillaume (Point 2, depuis le détail)** : `POST /api/sync/transcribe-audio` réussissait (`200`, confirmé par les logs serveur), mais l'UI retombait immédiatement sur l'état "audio seul" avec le bouton "Générer la transcription" au lieu d'afficher le texte transcrit. Cause : un enregistrement de test très court/silencieux a fait renvoyer une transcription **vide** (`""`) par `gpt-transcribe` — `note.transcription ? (...transcrit...) : (...audio seul...)` (`NoteDetail`, `app/projects/[id]/project-view.tsx`) traitait `""` comme faux au même titre que `null`, donnant l'illusion que la requête avait échoué silencieusement alors qu'elle avait réussi. Corrigé en remplaçant la vérification de véracité par `note.transcription !== null` (le domaine distingue déjà `null` = "jamais transcrite" de `""` = "transcrite mais vide", cf. `domain/note.ts`), avec un message de repli dédié (`TRANSCRIPTION_EMPTY_LABEL`, "Transcription vide — aucune parole détectée.") pour l'affichage d'une chaîne vide. Même correction de robustesse sur `NoteCard` (`??` → `||`, pour qu'un titre de carte ne reste jamais vide). `npx tsc --noEmit`/`npm run lint` propres après ce correctif. Ajout au passage d'un `console.error` dans `app/api/sync/transcribe-audio/route.ts` sur l'échec de l'appel OpenAI (absent initialement ; conforme à `ARCHITECTURE-SPINE.md` Consistency Conventions — "logging technique serveur limité aux erreurs... d'appels API externes" — utilisé pour écarter une première hypothèse d'échec serveur pendant le diagnostic).
- **Incident Supabase externe bloquant la fin de la vérification manuelle** : à partir du Point 5 (conflit de transcription), toute synchro échoue (`GET /api/sync/pull` → 500) avec l'erreur PostgREST `PGRST303` ("JWT issued at future"). Diagnostiqué avec Guillaume : horloge Windows vérifiée correcte (02.09.2026, 10:06), cookies de session supprimés et reconnexion effectuée (nouveau jeton), projet Supabase redémarré depuis le dashboard (Project Settings → Restart project) — aucune de ces actions n'a résolu le problème. Confirmé par Guillaume sur status.supabase.com : incident actif et documenté côté Supabase (rejet de jetons JWT par PostgREST, plusieurs mises à jour entre le 14 et le 31 août 2026, dernière mise à jour indiquant un retour à PostgREST 14.5 après des effets de bord de la version 14.17, enquête toujours en cours). **Confirmé sans rapport avec le code de cette story** — bloque également toute autre fonctionnalité de synchro (Task, Project), pas seulement Note/transcription. Points 5 (conflit), une partie du Point 6 (indicateur de synchronisation), et Point 8 (nettoyage des données de test côté Supabase) restent non vérifiés pour cette raison — à reprendre par Guillaume une fois l'incident résolu côté Supabase.
- **Task 13 (vérification manuelle) non réalisable par l'agent au-delà de `build`/`lint`/`tsc`** : nécessite (1) la migration SQL de la Task 3 exécutée au préalable, (2) `OPENAI_API_KEY` renseignée (aucune clé disponible dans cette session), (3) un accès micro réel ou au minimum une session authentifiée dans un navigateur pour piloter le flux de capture/détail, (4) une simulation à deux profils navigateur pour le scénario de conflit — aucun de ces prérequis n'était réuni dans cette session. Reste intégralement à la charge de Guillaume.

### Completion Notes List

- **Code complet (Tasks 1, 2, 4 à 12)** : `Note.transcription` étendue avec la mécanique de conflit par champ complète (AD-3) — `transcriptionUpdatedAt`/`transcriptionSyncedAt`/`transcriptionConflict`, `setNoteTranscription`, poussée dès la création (contrairement à `audioPath`, décision documentée dans les Dev Notes de la story pour éviter le piège du faux conflit sur un `transcriptionSyncedAt` jamais initialisé) ; `updateNoteTranscription` (persistance locale + file de synchro, réutilisée pour l'écriture normale et la résolution de conflit) ; migration du schéma Supabase distant (`RemoteNoteRow`, `noteFieldsToColumns`, `upsertNoteFields` — nouvelle signature à entrées brutes, même changement qu'`upsertTaskFields` en Story 3.6) ; nouveau module `data/remote/transcription.ts` (appel OpenAI `gpt-transcribe`, AD-6) ; nouvelle route stateless `POST /api/sync/transcribe-audio` ; extension complète du moteur de synchronisation côté client (`mergeExistingNote` remplace l'ancienne réconciliation "isNew seulement", `markNoteFieldsSynced`, `toLocalNote` étendu) ; interface complète côté capture (case à cocher "Générer la transcription" à l'étape 3, transcription en tâche de fond fire-and-forget après création) et côté détail de note (bouton "Générer la transcription", états "en cours"/erreur, bandeau de conflit, affichage distinct audio-seul/transcrite, transcription affichée sur la carte à la place de "Note vocale").
- **Décision de conception documentée et appliquée telle quelle** : case à cocher plutôt que second bouton à l'étape 3 de la capture (aucun mockup ne couvre ce cas ; un bouton "Générer la transcription" cliquable avant "Créer" n'aurait aucun id de note existant auquel s'attacher, cf. Dev Notes de la story).
- Aucune nouvelle dépendance au-delà de `openai` (prévue et documentée par la story ; version installée `7.8.0`, conforme). Aucune déviation de portée par rapport à la story (pas de nouveau composant `components/`, aucun changement à `domain/sync.ts` — déjà suffisant, aucune modification du schéma Dexie).
- **Task 3 (migration SQL) exécutée et vérifiée par Guillaume** — conforme (cf. Debug Log/Change Log).
- **Task 13 (vérification manuelle) largement réalisée en conditions réelles par Guillaume** : AC#1 "à la création" et "depuis le détail", échec réseau, état "audio seul" distinct, navigation clavier — tous vérifiés et fonctionnels (un bug réel trouvé et corrigé en cours de route, cf. Debug Log). **Reste, une fois l'incident Supabase externe résolu** (cf. Debug Log) : le scénario de conflit de transcription à deux profils (AD-3), la partie "indicateur de synchronisation" de la non-régression, et le nettoyage des données de test côté Supabase. Statut passé à `review`.

### File List

**Créés :**
- `data/remote/transcription.ts`
- `app/api/sync/transcribe-audio/route.ts`
- `data/local/pending-transcription.ts` (revue de code — marqueur local durable, cf. Change Log)

**Modifiés :**
- `domain/note.ts` (+ `transcription`/`transcriptionUpdatedAt`/`transcriptionSyncedAt`/`transcriptionConflict`, `setNoteTranscription`)
- `domain/index.ts` (+ export `setNoteTranscription`)
- `data/local/notes.ts` (`createNote`/`createVoiceNote` += `transcription` poussée à la création ; + `updateNoteTranscription`)
- `data/local/index.ts` (+ export `updateNoteTranscription`, `markTranscriptionPending`/`clearTranscriptionPending`/`isTranscriptionPending`/`listPendingTranscriptionNoteIds` (revue de code))
- `data/local/db.ts` (+ table `pendingTranscriptions`, version 6 — revue de code)
- `data/remote/sync.ts` (`RemoteNoteRow` += `transcription`/`transcription_updated_at` ; `noteFieldsToColumns` += `transcription` ; `upsertNoteFields` nouvelle signature à entrées brutes)
- `data/remote/storage.ts` (`audioExtensionFromMimeType` exportée)
- `data/remote/index.ts` (+ export `transcribeAudio`)
- `sync/server.ts` (`pushQueueEntries` — branche "note" passe le groupe brut ; + `transcribeNoteAudio`)
- `sync/client.ts` (`PulledNoteRow` += `transcription`/`transcription_updated_at` ; `toLocalNote` étendu ; + `mergeExistingNote` (remplace la réconciliation isNew-only) ; `pullOnce` étendu ; + `markNoteFieldsSynced` ; + `retryPendingTranscriptions` (revue de code) ; `processQueue`/`runSyncCycle` étendus)
- `app/capture-flow.tsx` (+ case à cocher "Générer la transcription", `requestTranscription`, `handleSubmitVoiceNote` étendu ; revue de code : marqueur `pendingTranscriptions` posé/retiré autour de l'appel immédiat)
- `app/capture-flow.module.css` (+ `.transcribeOption`/`.checkboxInput`/`.visuallyHidden`/`.checkboxBox`)
- `app/projects/[id]/project-view.tsx` (`NoteCard` += transcription/puce de conflit ; `NoteDetail` += `onTranscriptionChange`, bandeau de conflit, bouton/états de transcription ; `ProjectView` += `handleTranscriptionChange` ; revue de code : `hasVoiceAudio`, `localAudioBlob` réutilisé, `currentNoteIdRef` contre les callbacks obsolètes, bandeau de conflit et affichage audio/transcription corrigés — cf. Change Log)
- `package.json` (+ dépendance `openai@^7.8.0`)
- `.env.example` (`OPENAI_API_KEY` décommentée)

**Migration Supabase (Task 3) : SQL prêt, exécution en attente de Guillaume**, sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (même précédent que les Stories 3.2/3.6/5.1/5.2), le SQL vit dans le texte de la Task 3 de cette story.

## Change Log

- 2026-09-02 : Implémentation complète des Tasks 1, 2, 4 à 12 (mécanique de conflit par champ complète pour `Note.transcription` selon AD-3, module de transcription OpenAI `gpt-transcribe` côté serveur, route stateless dédiée, extension du moteur de synchronisation, interface de capture et de détail). `npm run build`/`npm run lint`/`tsc --noEmit` propres. Task 3 (migration SQL Supabase) non exécutable par l'agent (aucun accès Supabase dans cette session), à la charge de Guillaume. Task 13 (vérification manuelle en conditions réelles) non réalisable au-delà de build/lint/tsc, faute d'accès Supabase/OpenAI/micro/navigateur authentifié dans cette session. Statut passé à `review`.
- 2026-09-02 : Task 3 (migration SQL) exécutée et vérifiée par Guillaume — colonnes `transcription`/`transcription_updated_at` conformes. `OPENAI_API_KEY` renseignée en local (Render reste à faire avant tout déploiement). Task 13 en cours, en conditions réelles : AC#1 "à la création" vérifiée avec succès du premier coup. AC#1 "depuis le détail" a révélé un bug réel — un appel de transcription réussi côté serveur (`200`) avec un résultat vide (`""`, enregistrement de test court) était affiché comme un échec silencieux côté UI (`note.transcription ? ... : ...` traitait `""` comme `null`). Corrigé (`note.transcription !== null`, message dédié pour une transcription vide, même correctif sur `NoteCard`) et revérifié par Guillaume : fonctionne. `console.error` ajouté sur l'échec serveur de l'appel OpenAI (absent initialement, conforme aux Consistency Conventions de l'architecture). `npx tsc --noEmit`/`npm run lint` propres après ces correctifs.
- 2026-09-02 : AC#1 "échec réseau", AC#2 "audio seul" distinct, et navigation clavier vérifiés par Guillaume — tous conformes. Suite de la Task 13 (conflit de transcription à deux profils) bloquée par un incident Supabase externe : `GET /api/sync/pull` échoue systématiquement (`500`, `PGRST303` "JWT issued at future"), confirmé par Guillaume comme un incident actif documenté sur status.supabase.com (rejet de jetons JWT par PostgREST), reproductible même après horloge système vérifiée correcte, reconnexion complète (nouveau jeton) et redémarrage du projet Supabase depuis le dashboard — aucun rapport avec le code de cette story, affecte toute synchro (Task/Project/Note). Non-régression vérifiée partiellement (capture tâche/note texte/note vocale, onglet Documents — aucun souci constaté), la partie "indicateur de synchronisation en bonne santé" restant impossible à confirmer tant que l'incident persiste. Conflit de transcription (AD-3) et nettoyage des données de test côté Supabase reportés à la résolution de l'incident. Statut confirmé `review` — le code est complet et conforme à l'architecture (AD-3, AD-6) ; seule la démonstration bout-en-bout du scénario de conflit distant reste en attente d'un facteur externe.
- 2026-09-02 : Revue de code adversariale (8 angles indépendants — scan ligne par ligne, comportements supprimés, traçage inter-fichiers, réutilisation, simplification, efficacité, altitude, conventions CLAUDE.md — puis vérification à un votant par candidat). 9 findings retenus (5 correctness, 2 efficiency, 2 simplification), tous corrigés sauf un jugé sans changement pertinent possible (blob retenu en mémoire le temps d'un appel réseau — inhérent à l'opération) :
  - **Requêtes de transcription concurrentes dupliquées** (création + détail pouvaient lancer deux appels OpenAI simultanés pour la même note) et **perte silencieuse d'une transcription réussie si l'onglet se ferme avant l'écriture Dexie** : corrigées ensemble par un nouveau mécanisme de marqueur local durable (`data/local/pending-transcription.ts`, nouvelle table Dexie `pendingTranscriptions`, version 6) posé avant chaque appel immédiat et retiré après écriture réussie — `sync/client.ts` (`retryPendingTranscriptions`, appelée dans `runSyncCycle`) retente automatiquement toute note encore marquée au cycle suivant, même précédent qu'`uploadPendingAudio` (Story 5.2). `handleGenerateTranscription` vérifie désormais ce marqueur avant de démarrer un nouvel appel.
  - **Bandeau de conflit de transcription affichant un libellé vide** pour un côté transcrit-mais-vide (`??` ne traitait pas `""`) : corrigé avec le même motif `!== null` + `TRANSCRIPTION_EMPTY_LABEL` déjà utilisé pour l'affichage non-conflictuel.
  - **Un échec de chargement audio masquait une transcription déjà réussie** : `audioLoadError` ne remplace plus que le lecteur `<audio>` lui-même, la transcription reste un bloc frère toujours affiché.
  - **État de transcription (erreur/en cours) qui pouvait fuiter d'une note à l'autre** (`NoteDetail` n'est jamais démonté entre deux notes) : corrigé par un `currentNoteIdRef` tenu à jour via un `useEffect` sans dépendances, vérifié avant chaque écriture d'état dans les callbacks asynchrones.
  - **Re-lecture IndexedDB inutile du blob audio** (jusqu'à 20 Mo) déjà résolu par un effet existant : le blob brut est désormais conservé (`localAudioBlob`) et réutilisé.
  - **Ternaire imbriqué à 4 niveaux** et **condition d'affichage audio mêlée à la logique de `src`** : simplifiés en même temps que le correctif `audioLoadError` (nesting réduit) et via une nouvelle fonction nommée `hasVoiceAudio`.
  - `npx tsc --noEmit`/`npm run lint`/`npm run build` propres après tous les correctifs (un problème ESLint `react-hooks/refs` corrigé au passage : écriture d'un ref pendant le rendu, remplacée par un `useEffect` sans dépendances).
  - Non re-vérifié manuellement par Guillaume (nécessiterait de repasser par les Points 1-2 de la Task 13, actuellement bloqués par l'incident Supabase externe) — code validé par build/lint/tsc et par la revue elle-même uniquement à ce stade.
- 2026-09-02 : Guillaume clôt la story en `done` et reprend le suivi dans une autre session. **Restent non vérifiés, à sa charge** : le scénario de conflit de transcription à deux profils (Task 13, Point 5), la partie "indicateur de synchronisation en bonne santé" de la non-régression (Point 6), le nettoyage des données de test côté Supabase (Point 8) — tous bloqués par l'incident Supabase externe (`PGRST303`, cf. Debug Log) et sans lien avec le code de cette story. Les 9 findings de la revue de code du même jour n'ont pas non plus été re-vérifiés manuellement (validés par build/lint/tsc uniquement).
