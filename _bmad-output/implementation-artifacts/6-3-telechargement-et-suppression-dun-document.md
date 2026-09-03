---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 6.3: Téléchargement et suppression d'un document

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want télécharger ou supprimer un document,
so that je récupère un fichier sur mon appareil ou nettoie un projet.

## Acceptance Criteria

1. **Given** un document dans la liste **When** je déclenche le téléchargement **Then** le fichier est enregistré sur mon appareil
2. **Given** un document dans la liste **When** je déclenche la suppression **Then** une modale de confirmation s'affiche avec un bouton destructif clairement identifié (couleur dédiée), distincte d'une simple annulation
3. **Given** je confirme la suppression **When** l'action est validée **Then** le document est supprimé définitivement du projet et de Supabase Storage

## Scope boundary (important)

Cette story couvre **uniquement téléchargement et suppression** (FR-20/FR-21) — dernière story de l'Epic 6 (Documents), FR-18/FR-19 déjà livrés (Stories 6.1/6.2, `done`/`review`). Elle est la **première story de tout le projet à implémenter une suppression** (aucune Task/Note/Project n'a jamais été supprimable) : elle établit le premier usage réel de `SyncOperation: "delete"`/`DELETE_FIELD` (déjà présents dans l'enveloppe `domain/sync.ts` depuis la Story 3.2, jamais produits jusqu'ici) et de la clause AD-3 sur la suppression concurrente. Elle est aussi la première à exposer un chemin de **lecture/téléchargement** d'un fichier Storage `documents` (Story 6.1 n'avait créé que la policy `insert`). Ne pas toucher à `app/capture-flow.tsx` (ajout de document, Story 6.1, hors périmètre) ni à la liste/consultation déjà fonctionnelle (Story 6.2) au-delà de l'ajout des deux actions Télécharger/Supprimer.

## Tasks / Subtasks

- [x] Task 1: `domain/sync.ts` — activer `DELETE_FIELD` (AC: #3)
  - [x] Remplacer le commentaire au-dessus de `DELETE_FIELD` :
    ```ts
    // Valeur exacte de la convention pour une entrée de suppression — non utilisée par cette story
    // (aucune suppression de Task/Project n'existe encore), documentée pour la story qui en aura besoin.
    export const DELETE_FIELD = "__record__";
    ```
    par :
    ```ts
    // Valeur exacte de la convention pour une entrée de suppression (ARCHITECTURE-SPINE.md
    // Consistency Conventions). Premier producteur réel : deleteDocument (data/local/documents.ts,
    // Story 6.3, FR-21) — la constante existait depuis la Story 3.2 mais n'avait jamais été
    // produite jusqu'ici.
    export const DELETE_FIELD = "__record__";
    ```
  - [x] Aucun autre changement à ce fichier — `SyncOperation` inclut déjà `"delete"`.

- [x] Task 2: `data/local/sync-queue.ts` — `enqueueDelete` (AC: #3)
  - [x] Étendre l'import `@/domain` : ajouter `DELETE_FIELD` à côté de `syncQueueEntryId, hasExhaustedRetries`.
  - [x] Ajouter, à la suite d'`enqueueCreate` :
    ```ts
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
    ```

- [x] Task 3: `data/local/documents.ts` — `deleteDocument` (AC: #3)
  - [x] Étendre l'import `./sync-queue` : ajouter `enqueueDelete` à côté de `enqueueCreate, enqueueField`.
  - [x] Ajouter, à la suite de `markDocumentOpened` :
    ```ts
    // Suppression définitive (FR-21) — écriture optimiste immédiate en local (AD-1, même
    // position que createDocument) : retire la ligne `documents` ET son blob `documentFiles`
    // dans la même transaction, puis met en file une suppression (enqueueDelete) pour que
    // sync/ la propage à Supabase (ligne Postgres + fichier Storage, cf. sync/server.ts
    // deleteDocumentAndFile). L'appareil qui n'a jamais eu ce document localement (un autre
    // appareil de Guillaume) le découvre au pull suivant (cf. sync/client.ts pullOnce,
    // réconciliation par storagePath — Story 6.3).
    export async function deleteDocument(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.transaction("rw", db.documents, db.documentFiles, db.syncQueue, async (tx) => {
        await tx.table("documents").delete(id);
        await tx.table("documentFiles").delete(id);
        await enqueueDelete("document", id, getDeviceId(), now, tx);
      });
    }
    ```
  - [x] Mettre à jour le commentaire d'en-tête du fichier (ligne 1 actuelle, "FR-18 à FR-19, Stories 6.1/6.2") pour inclure "FR-20/FR-21, Story 6.3".

- [x] Task 4: `data/local/index.ts` — exports (AC: #3)
  - [x] Remplacer :
    ```ts
    export {
      createDocument,
      markDocumentUploaded,
      listDocumentsByProject,
      markDocumentOpened,
    } from "./documents";
    ```
    par :
    ```ts
    export {
      createDocument,
      markDocumentUploaded,
      listDocumentsByProject,
      markDocumentOpened,
      deleteDocument,
    } from "./documents";
    ```
  - [x] Remplacer :
    ```ts
    export {
      enqueueField,
      enqueueCreate,
      listPendingAndError,
      markSyncing,
      markSucceeded,
      markFailed,
      resetErrorsToPending,
      resetStaleSyncingToPending,
    } from "./sync-queue";
    ```
    par :
    ```ts
    export {
      enqueueField,
      enqueueCreate,
      enqueueDelete,
      listPendingAndError,
      markSyncing,
      markSucceeded,
      markFailed,
      resetErrorsToPending,
      resetStaleSyncingToPending,
    } from "./sync-queue";
    ```

- [x] Task 5: `data/remote/document-storage.ts` — URL signée de téléchargement + retrait Storage (AC: #1, #3 ; AD-5, AD-6, AD-8)
  - [x] Mettre à jour le commentaire d'en-tête (lignes 10-11 actuelles, *"Pas de fonction de lecture/URL signée ici... aucune AC de cette story n'expose de téléchargement (FR-20, Story 6.3...)"*) — cette story est ce moment annoncé, supprimer la phrase devenue fausse.
  - [x] Ajouter, à la suite d'`uploadDocumentFile` :
    ```ts
    // URL signée de courte durée (60s) — juste le temps que le navigateur suive la redirection
    // de app/api/documents/[id]/download/route.ts ; jamais persistée, régénérée à chaque
    // téléchargement (le bucket reste privé, AD-4/NFR-2 — même précédent que
    // createNoteAudioSignedUrl, data/remote/storage.ts, Story 5.2). `download: fileName` force
    // un en-tête Content-Disposition: attachment sur la réponse Supabase Storage — le
    // navigateur enregistre systématiquement le fichier plutôt que de tenter un rendu inline,
    // quel que soit le content-type stocké côté Storage. Ceci répond explicitement au risque
    // consigné dans deferred-work.md ("code review of story-6.1" : le mimeType fourni par le
    // client à l'upload n'est pas validé contre le contenu réel — "Story 6.2/6.3 ... ne
    // devraient pas hériter silencieusement de ce risque") : un content-type usurpé ne peut
    // plus jamais s'exécuter/s'afficher inline dans le navigateur via ce chemin, seulement être
    // enregistré tel quel sur le disque de l'utilisateur.
    export async function createDocumentSignedUrl(
      client: SupabaseClient,
      path: string,
      fileName: string,
    ): Promise<string> {
      const { data, error } = await client.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(path, 60, { download: fileName });
      if (error || !data) {
        throw error ?? new Error("Impossible de générer l'URL de téléchargement.");
      }
      return data.signedUrl;
    }

    // Retire le fichier du bucket Storage (FR-21) — appelée par sync/server.ts
    // (deleteDocumentAndFile) après lecture du storage_path, jamais avant (cf. Dev Notes).
    // `.remove()` sur un chemin déjà absent ne lève pas d'erreur côté Supabase Storage
    // (contrairement à l'upload avec upsert:false, cf. isAlreadyExistsError ci-dessus) —
    // naturellement idempotent, aucun traitement d'erreur "déjà supprimé" à ajouter ici.
    export async function removeDocumentFile(client: SupabaseClient, path: string): Promise<void> {
      const { error } = await client.storage.from(DOCUMENT_BUCKET).remove([path]);
      if (error) {
        throw error;
      }
    }
    ```

- [x] Task 6: `data/remote/sync.ts` — lecture du chemin Storage + suppression de la ligne `documents` (AC: #3)
  - [x] Mettre à jour le commentaire d'en-tête (ligne 5-6 actuelle) pour mentionner FR-20/FR-21.
  - [x] Ajouter, à la suite de `fetchAllProjectsTasksNotesAndDocuments` :
    ```ts
    // Lit le storage_path courant d'un document (RLS "documents_owner" restreint déjà à
    // auth.uid() via le client scopé session) — null si la ligne n'existe pas (déjà supprimée,
    // ou jamais synchronisée depuis cet appareil) ou si storage_path est encore null (upload
    // jamais terminé, cf. AC#3/AC#4 Story 6.1). Étape séparée de deleteDocumentRow ci-dessous :
    // sync/server.ts a besoin du chemin AVANT de supprimer la ligne, pour pouvoir aussi retirer
    // le fichier Supabase Storage (AD-5, AD-8) — même ordre "lecture puis action" que
    // getNoteAudioPlaybackUrl (sync/server.ts, Story 5.2).
    export async function getDocumentStoragePath(
      client: SupabaseClient,
      entityId: string,
    ): Promise<string | null> {
      const { data, error } = await client
        .from("documents")
        .select("storage_path")
        .eq("id", entityId)
        .maybeSingle();

      if (error || !data) {
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
    ```

- [x] Task 7: `data/remote/index.ts` — exports (AC: #1, #3)
  - [x] Remplacer :
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
    par :
    ```ts
    export {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      upsertDocumentFields,
      fetchAllProjectsTasksNotesAndDocuments,
      getDocumentStoragePath,
      deleteDocumentRow,
    } from "./sync";
    export { uploadNoteAudio, createNoteAudioSignedUrl } from "./storage";
    export { transcribeAudio } from "./transcription";
    export { uploadDocumentFile, createDocumentSignedUrl, removeDocumentFile } from "./document-storage";
    ```

- [x] Task 8: Migration SQL Supabase — policies `storage.objects` select/delete (AC: #1, #3 ; AD-4, AD-5, AD-8)
  - [x] Guillaume exécute cette migration SQL dans l'éditeur SQL Supabase du projet dédié (`pxdmtnysvglorwchwsmc`) — complète les policies `storage.objects` du bucket `documents` (seule `documents_owner_insert` existait depuis la Story 6.1, aucune AC de cette story-là n'exposait de lecture/suppression, cf. son Scope boundary). Aucune policy de table n'est nécessaire : `documents_owner` (Story 6.1, `for all`) couvre déjà DELETE sur `public.documents`.
    ```sql
    -- "documents_owner_select" est nécessaire à createSignedUrl (AC#1, FR-20,
    -- data/remote/document-storage.ts createDocumentSignedUrl) — même rôle qu'
    -- "audio_owner_select" (Story 5.2, bucket "audio"). "documents_owner_delete" est nécessaire
    -- à .remove() (AC#3, FR-21, removeDocumentFile) — première policy delete de storage.objects
    -- dans ce projet, aucun bucket n'exposait encore de suppression avant cette story.
    -- `drop policy if exists` + `create policy` (idempotent) — même précédent que la correction
    -- post-review de la Task 8, Story 6.1.
    drop policy if exists "documents_owner_select" on storage.objects;
    create policy "documents_owner_select" on storage.objects for select
      using (bucket_id = 'documents' and (select auth.uid())::text = (storage.foldername(name))[1]);

    drop policy if exists "documents_owner_delete" on storage.objects;
    create policy "documents_owner_delete" on storage.objects for delete
      using (bucket_id = 'documents' and (select auth.uid())::text = (storage.foldername(name))[1]);
    ```
  - [x] Vérifier après exécution : `select policyname from pg_policies where tablename = 'objects' and policyname like 'documents_owner%';` renvoie 3 lignes (`insert`, `select`, `delete`). Exécuté et vérifié par Guillaume — succès confirmé (téléchargement fonctionnel en conditions réelles).

- [x] Task 9: `sync/server.ts` — `deleteDocumentAndFile`, `getDocumentDownloadUrl`, routage `delete` dans `pushQueueEntries` (AC: #1, #3)
  - [x] Étendre les imports :
    ```ts
    import {
      upsertProjectFields,
      upsertTaskFields,
      upsertNoteFields,
      upsertDocumentFields,
      fetchAllProjectsTasksNotesAndDocuments,
      getDocumentStoragePath,
      deleteDocumentRow,
    } from "@/data/remote/sync";
    import { uploadNoteAudio, createNoteAudioSignedUrl } from "@/data/remote/storage";
    import {
      uploadDocumentFile,
      createDocumentSignedUrl,
      removeDocumentFile,
    } from "@/data/remote/document-storage";
    import { transcribeAudio } from "@/data/remote/transcription";
    ```
  - [x] Dans `pushQueueEntries`, remplacer la branche `document` :
    ```ts
    } else if (entity === "document") {
      // Document n'a aucun champ conflict-tracké (AD-3 ne s'y applique pas, cf. Dev Notes
      // Story 6.1) — fields aplatis, même précédent que la branche "project" ci-dessus.
      const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
      await upsertDocumentFields(client, entityId, fields);
    } else {
    ```
    par :
    ```ts
    } else if (entity === "document") {
      if (group[0].operation === "delete") {
        // FR-21 : l'entrée de suppression prime sur tout champ (AD-3, cf. enqueueDelete,
        // data/local/sync-queue.ts) — le groupe ne contient jamais plus d'une entrée dans ce cas.
        await deleteDocumentAndFile(client, entityId);
      } else {
        // Document n'a aucun champ conflict-tracké (AD-3 ne s'y applique pas, cf. Dev Notes
        // Story 6.1) — fields aplatis, même précédent que la branche "project" ci-dessus.
        const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
        await upsertDocumentFields(client, entityId, fields);
      }
    } else {
    ```
  - [x] Ajouter, à la suite d'`uploadDocumentBlob` :
    ```ts
    // Suppression définitive d'un document (FR-21) — retire d'abord le fichier Storage (si un
    // upload avait réussi), puis la ligne `documents`. Cet ordre rend l'opération idempotente
    // en cas de retry après échec partiel : si la ligne existe encore au prochain essai,
    // storage_path est relu et le retrait Storage retenté (naturellement idempotent, cf.
    // removeDocumentFile) avant une nouvelle tentative de suppression de ligne ; si la ligne a
    // déjà disparu (première tentative allée jusqu'au bout), storagePath vaut null et rien
    // n'est retenté côté Storage.
    export async function deleteDocumentAndFile(
      client: SupabaseClient,
      entityId: string,
    ): Promise<void> {
      const storagePath = await getDocumentStoragePath(client, entityId);
      if (storagePath) {
        await removeDocumentFile(client, storagePath);
      }
      await deleteDocumentRow(client, entityId);
    }

    // Même précédent que getNoteAudioPlaybackUrl ci-dessus (Story 5.2) : vérifie l'appartenance
    // via une lecture RLS (client scopé session) avant de générer une URL signée — un document
    // inexistant, non possédé, ou pas encore uploadé (storage_path encore null, AC#3/#4 Story
    // 6.1) renvoie null plutôt que de lever, laissant la route handler répondre 404.
    export async function getDocumentDownloadUrl(
      client: SupabaseClient,
      documentId: string,
    ): Promise<string | null> {
      const { data, error } = await client
        .from("documents")
        .select("storage_path, file_name")
        .eq("id", documentId)
        .maybeSingle();

      if (error || !data || !data.storage_path) {
        return null;
      }

      return createDocumentSignedUrl(client, data.storage_path, data.file_name);
    }
    ```

- [x] Task 10: `app/api/documents/[id]/download/route.ts` — nouvelle route (AC: #1 ; AD-6)
  - [x] Créer `app/api/documents/[id]/download/route.ts` (copie conforme d'`app/api/notes/[id]/audio/route.ts`, adaptée à Document) :
    ```ts
    import { createSupabaseServerClient } from "@/data/remote/client";
    import { getDocumentDownloadUrl } from "@/sync/server";

    // app/api/documents/[id]/download/route.ts — redirige vers une URL signée de courte durée
    // pour le téléchargement d'un document (AD-6 : seul le serveur parle à Supabase Storage).
    // Utilisée directement comme `href` d'un <a> (app/projects/[id]/project-view.tsx,
    // DocumentCard/DocumentDetail) — un <a> suit une redirection 302 de façon transparente ; le
    // Content-Disposition: attachment de l'URL signée (cf. createDocumentSignedUrl,
    // data/remote/document-storage.ts) déclenche l'enregistrement sur l'appareil (AC#1, FR-20)
    // sans que le client ait jamais besoin de connaître l'URL signée elle-même. Protégée par
    // proxy.ts comme toute autre route (redirection non authentifiée vers /login) + vérification
    // explicite ci-dessous (défense en profondeur, même précédent qu'app/api/notes/[id]/audio).
    export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]/download">) {
      const supabase = await createSupabaseServerClient();

      const { data } = await supabase.auth.getClaims();
      if (!data) {
        return new Response(null, { status: 401 });
      }

      const { id } = await ctx.params;
      const url = await getDocumentDownloadUrl(supabase, id);
      if (!url) {
        return new Response(null, { status: 404 });
      }

      return Response.redirect(url, 302);
    }
    ```

- [x] Task 11: `sync/client.ts` — réconciliation de suppression cross-appareil dans `pullOnce` (AC: #3)
  - [x] Ajouter, à la suite de la boucle `for (const row of snapshot.documents) { ... }` existante, à l'intérieur du même bloc `try` de `pullOnce()` :
    ```ts
    // Réconciliation de suppression cross-appareil (FR-21) — deleteDocument()
    // (data/local/documents.ts) retire déjà la ligne locale immédiatement sur l'appareil qui
    // supprime (écriture optimiste, AD-1) ; ce bloc couvre l'AUTRE appareil, qui doit
    // découvrir la suppression au prochain pull. fetchAllProjectsTasksNotesAndDocuments
    // (data/remote/sync.ts) renvoie l'état complet des documents restants (RLS, pas de filtre
    // incrémental) — tout document encore présent en local mais absent du snapshot a donc été
    // supprimé côté serveur. Garde `storagePath !== null` : un document créé hors ligne sur CET
    // appareil et jamais encore poussé au serveur (storagePath encore null, upload pas
    // terminé) n'apparaît pas non plus dans le snapshot distant, mais ne doit surtout pas être
    // traité comme "supprimé ailleurs" — il n'a tout simplement jamais existé côté serveur. Un
    // document synchronisé au moins une fois (storagePath non null) qui manque au snapshot n'a,
    // lui, qu'une seule explication possible : une suppression réussie entre-temps (par cet
    // appareil ou un autre).
    const remoteDocumentIds = new Set(snapshot.documents.map((row) => row.id));
    const localDocuments = await db.documents.toArray();
    for (const document of localDocuments) {
      if (document.storagePath !== null && !remoteDocumentIds.has(document.id)) {
        try {
          await db.transaction("rw", db.documents, db.documentFiles, db.syncQueue, async (tx) => {
            await tx.table("documents").delete(document.id);
            await tx.table("documentFiles").delete(document.id);
            // Purge toute entrée de file orpheline pour ce document (ex. un champ modifié sur
            // un appareil avant que l'autre ne le supprime) — rien à pousser pour un document
            // qui n'existe plus nulle part, même rationale qu'enqueueDelete.
            await tx.table("syncQueue").where("entityId").equals(document.id).delete();
          });
        } catch {
          // idem — rattrapé au prochain pull si cette écriture échoue.
        }
      }
    }
    ```

- [x] Task 12: `components/confirm-dialog.tsx`/`.module.css` — variante destructive (AC: #2)
  - [x] Mettre à jour le commentaire d'en-tête (lignes 4-5 actuelles) : "Story 6.3 (suppression de document)" passe de "pourront le réutiliser" à "le réutilise, en ajoutant une variante destructive".
  - [x] Étendre `ConfirmDialogProps` :
    ```ts
    interface ConfirmDialogProps {
      open: boolean;
      title: string;
      description?: string;
      confirmLabel: string;
      cancelLabel: string;
      onConfirm: () => void;
      onCancel: () => void;
      pending?: boolean;
      variant?: "default" | "destructive";
    }
    ```
  - [x] Étendre la signature du composant :
    ```ts
    export function ConfirmDialog({
      open,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm,
      onCancel,
      pending = false,
      variant = "default",
    }: ConfirmDialogProps) {
    ```
  - [x] Dans le JSX, ajouter la description optionnelle et le bouton de confirmation selon la variante :
    ```tsx
    <h2 id="confirm-dialog-title" className={styles.title}>
      {title}
    </h2>
    {description && <p className={styles.description}>{description}</p>}
    <div className={styles.actions}>
      <button
        ref={cancelButtonRef}
        type="button"
        className={styles.ghostButton}
        onClick={onCancel}
        disabled={pending}
      >
        {cancelLabel}
      </button>
      <button
        ref={confirmButtonRef}
        type="button"
        className={variant === "destructive" ? styles.destructiveButton : styles.primaryButton}
        onClick={onConfirm}
        disabled={pending}
      >
        {confirmLabel}
      </button>
    </div>
    ```
  - [x] Ajouter, à la fin de `components/confirm-dialog.module.css` :
    ```css
    .description {
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-text);
    }

    /* components.button-destructive (DESIGN.md) — première utilisation réelle (Story 6.3,
       suppression de document). Réservée exclusivement à cette confirmation (UX-DR15/Do's and
       Don'ts DESIGN.md) — ne jamais réutiliser cette classe ailleurs. */
    .destructiveButton {
      min-height: 48px;
      padding: 0 var(--space-4);
      border: none;
      border-radius: var(--radius-md);
      background: var(--color-danger);
      color: var(--color-danger-text);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      cursor: pointer;
    }

    .destructiveButton:disabled {
      opacity: 0.6;
      cursor: default;
    }
    ```

- [x] Task 13: `app/projects/[id]/project-view.tsx` — actions Télécharger/Supprimer sur `DocumentCard`/`DocumentDetail`, état et handlers (AC: #1, #2, #3)
  - [x] Ajouter l'import : `import { ConfirmDialog } from "@/components/confirm-dialog";` (à la suite des imports de types/valeurs existants).
  - [x] Étendre l'import `@/data/local` : ajouter `deleteDocument` à la suite de `markDocumentOpened`.
  - [x] Ajouter la constante, à côté de `DOCUMENTS_LOAD_ERROR_MESSAGE` :
    ```ts
    const DOCUMENT_DELETE_ERROR_MESSAGE = "La suppression a échoué. Réessayez.";
    ```
  - [x] Ajouter l'état, à la suite de `selectedDocumentId`/`sortFilters` :
    ```ts
    const [confirmDeleteDocument, setConfirmDeleteDocument] = useState<Document | null>(null);
    const [documentActionPendingId, setDocumentActionPendingId] = useState<string | null>(null);
    const [documentActionError, setDocumentActionError] = useState<string | undefined>();
    ```
  - [x] Ajouter les handlers, à la suite de `handleOpenDocument` :
    ```ts
    function handleRequestDeleteDocument(documentItem: Document) {
      if (documentActionPendingId) {
        return;
      }
      setDocumentActionError(undefined);
      setConfirmDeleteDocument(documentItem);
    }

    function handleCancelDeleteDocument() {
      setConfirmDeleteDocument(null);
    }

    async function handleConfirmDeleteDocument() {
      const target = confirmDeleteDocument;
      if (!target || documentActionPendingId) {
        return;
      }

      setDocumentActionPendingId(target.id);
      try {
        await deleteDocument(target.id);
      } catch {
        // deleteDocument() est une écriture Dexie locale pure (AD-1) — un échec ici est rare
        // (ex. IndexedDB indisponible) mais doit rester visible, contrairement à
        // handleStatusChange/handlePriorityChange (écritures de champ non destructives où
        // l'UI retombe simplement sur l'état précédent) : une suppression manquée sans retour
        // laisserait Guillaume croire à tort que le document a disparu.
        setDocumentActionError(DOCUMENT_DELETE_ERROR_MESSAGE);
        setDocumentActionPendingId(null);
        setConfirmDeleteDocument(null);
        return;
      }

      setDocumentActionPendingId(null);
      setConfirmDeleteDocument(null);
      // `documents` se met à jour seule via l'abonnement liveQuery existant (deleteDocument()
      // écrit directement dans Dexie) — referme aussi le détail si le document supprimé y
      // était affiché (sinon DocumentDetail resterait ouvert sur un documentItem qui vient de
      // disparaître de `documents`, cf. selectedDocument dérivée).
      setSelectedDocumentId((current) => (current === target.id ? null : current));
    }
    ```
  - [x] Dans le rendu de l'onglet "documents", remplacer :
    ```tsx
    {activeTab === "documents" &&
      (documentsLoadError ? (
        <p className={styles.error} role="alert">
          {DOCUMENTS_LOAD_ERROR_MESSAGE}
        </p>
      ) : documents.length === 0 ? (
        <p className={styles.empty}>{EMPTY_DOCUMENTS_MESSAGE}</p>
      ) : (
        <ul className={styles.taskList}>
          {sortDocuments(documents).map((documentItem) => (
            <DocumentCard
              key={documentItem.id}
              documentItem={documentItem}
              onOpen={handleOpenDocument}
            />
          ))}
        </ul>
      ))}
    ```
    par :
    ```tsx
    {activeTab === "documents" &&
      (documentsLoadError ? (
        <p className={styles.error} role="alert">
          {DOCUMENTS_LOAD_ERROR_MESSAGE}
        </p>
      ) : (
        <>
          {documentActionError && (
            <p className={styles.error} role="alert">
              {documentActionError}
            </p>
          )}
          {documents.length === 0 ? (
            <p className={styles.empty}>{EMPTY_DOCUMENTS_MESSAGE}</p>
          ) : (
            <ul className={styles.taskList}>
              {sortDocuments(documents).map((documentItem) => (
                <DocumentCard
                  key={documentItem.id}
                  documentItem={documentItem}
                  onOpen={handleOpenDocument}
                  onDelete={handleRequestDeleteDocument}
                />
              ))}
            </ul>
          )}
        </>
      ))}
    ```
  - [x] Passer `onDelete={handleRequestDeleteDocument}` à `<DocumentDetail ... />` (déjà rendu à la suite de `<NoteDetail />`).
  - [x] Ajouter, à la suite de `<DocumentDetail ... />` (avant la fermeture de `<main>`) :
    ```tsx
    <ConfirmDialog
      open={confirmDeleteDocument !== null}
      title="Supprimer ce document ?"
      description={`${confirmDeleteDocument?.fileName || "Document"} sera définitivement supprimé et ne pourra pas être récupéré.`}
      confirmLabel="Supprimer"
      cancelLabel="Annuler"
      variant="destructive"
      onConfirm={handleConfirmDeleteDocument}
      onCancel={handleCancelDeleteDocument}
      pending={
        confirmDeleteDocument !== null && documentActionPendingId === confirmDeleteDocument.id
      }
    />
    ```
  - [x] Remplacer la signature et le corps de `DocumentCard` — ajouter les actions Télécharger/Supprimer en sibling du bouton d'ouverture (jamais imbriquées dedans : un bouton dans un bouton est du HTML invalide, même précédent que `StatusRow`/`TaskCard`, Story 3.5). `EXPERIENCE.md` "Actions document" liste ces deux actions sur la carte ET le détail ; `mockups/key-delete-confirmation.html` les place directement sur la carte :
    ```tsx
    function DocumentCard({
      documentItem,
      onOpen,
      onDelete,
    }: {
      documentItem: Document;
      onOpen: (documentItem: Document) => void;
      onDelete: (documentItem: Document) => void;
    }) {
      return (
        <li className={styles.taskCard}>
          <button
            type="button"
            className={styles.taskCardButton}
            onClick={() => onOpen(documentItem)}
          >
            {documentItem.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {documentItem.isNew ? "Nouveau" : ""}
            </span>

            <div className={styles.taskCardRow}>
              <PriorityChip priority={documentItem.priority} />
              <span className={styles.documentFileName}>{documentItem.fileName || "Document"}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{documentItem.mimeType}</span>
              <span className={styles.metaPill}>{formatFileSize(documentItem.sizeBytes)}</span>
              <span className={styles.metaPill}>{formatDueDate(documentItem.createdAt)}</span>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[documentItem.provenance]}
              </span>
            </div>
          </button>

          <div className={styles.documentActions}>
            {documentItem.storagePath ? (
              <a
                className={styles.ghostButton}
                href={`/api/documents/${documentItem.id}/download`}
              >
                Télécharger
              </a>
            ) : (
              <button type="button" className={styles.ghostButton} disabled>
                Télécharger
              </button>
            )}
            <button
              type="button"
              className={styles.destructiveButton}
              onClick={() => onDelete(documentItem)}
            >
              Supprimer
            </button>
          </div>
        </li>
      );
    }
    ```
  - [x] Remplacer la signature et le corps de `DocumentDetail` — ajouter `onDelete`, les mêmes deux actions dans `.actions`, et un piège à focus à 3 éléments (remplace le piège à 1 élément de la Story 6.2, qui ne connaissait que "Fermer" et le reforçait à chaque Tab) :
    ```tsx
    function DocumentDetail({
      documentItem,
      onClose,
      onDelete,
    }: {
      documentItem: Document | null;
      onClose: () => void;
      onDelete: (documentItem: Document) => void;
    }) {
      const closeButtonRef = useRef<HTMLButtonElement>(null);
      const downloadLinkRef = useRef<HTMLAnchorElement>(null);
      const deleteButtonRef = useRef<HTMLButtonElement>(null);

      useEffect(() => {
        if (!documentItem) {
          return;
        }
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();
        return () => {
          previouslyFocused?.focus();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [documentItem?.id]);

      if (!documentItem) {
        return null;
      }

      // Piège à focus à N éléments (Fermer, Télécharger, Supprimer) — généralise le piège à 1
      // élément de la Story 6.2 (qui reforçait le focus sur "Fermer" à chaque Tab, seul élément
      // focalisable à l'époque) via une liste construite dynamiquement plutôt que des cas figés,
      // même précédent de cycle Tab/Maj+Tab que components/confirm-dialog.tsx (2 éléments).
      // `downloadLinkRef` n'est jamais attaché quand le téléchargement n'est pas encore
      // disponible (bouton natif `disabled` ci-dessous, pas de ref) — `.current` reste alors
      // `null` et sort naturellement de `focusable` sans logique conditionnelle supplémentaire.
      function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== "Tab") {
          return;
        }
        const focusable = [
          closeButtonRef.current,
          downloadLinkRef.current,
          deleteButtonRef.current,
        ].filter((el): el is HTMLElement => el !== null);
        if (focusable.length === 0) {
          return;
        }
        event.preventDefault();
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey) {
          const previousIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
          focusable[previousIndex].focus();
        } else {
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
          focusable[nextIndex].focus();
        }
      }

      return (
        <div className={styles.backdrop}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-detail-title"
            onKeyDown={handleKeyDown}
          >
            <div className={styles.detailHeader}>
              <h2 id="document-detail-title" className={styles.title}>
                {documentItem.fileName || "Document"}
              </h2>
              <PriorityChip priority={documentItem.priority} />
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{documentItem.mimeType}</span>
              <span className={styles.metaPill}>{formatFileSize(documentItem.sizeBytes)}</span>
              <span className={styles.metaPill}>{formatDueDate(documentItem.createdAt)}</span>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[documentItem.provenance]}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.ghostButton}
                onClick={onClose}
              >
                Fermer
              </button>
              {documentItem.storagePath ? (
                <a
                  ref={downloadLinkRef}
                  className={styles.ghostButton}
                  href={`/api/documents/${documentItem.id}/download`}
                >
                  Télécharger
                </a>
              ) : (
                <button type="button" className={styles.ghostButton} disabled>
                  Télécharger
                </button>
              )}
              <button
                ref={deleteButtonRef}
                type="button"
                className={styles.destructiveButton}
                onClick={() => onDelete(documentItem)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      );
    }
    ```
  - [x] Mettre à jour le commentaire d'en-tête du fichier (lignes 3-7 actuelles) : Document devient complet (ajout/liste/téléchargement/suppression, Epic 6 clos).

- [x] Task 14: `app/projects/[id]/project-view.module.css` — styles des nouvelles actions (AC: #1, #2)
  - [x] Remplacer `.ghostButton` :
    ```css
    .ghostButton {
      min-height: 48px;
      padding: 0 var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      cursor: pointer;
    }
    ```
    par (ajoute le centrage flex + `text-decoration: none` requis maintenant que cette classe s'applique aussi à un `<a>` — voir `DocumentCard`/`DocumentDetail`, Task 13 — sans effet visuel sur les usages `<button>` existants ; ajoute l'état `:disabled`, absent jusqu'ici bien qu'utilisé, cf. bouton "Générer la transcription") :
    ```css
    .ghostButton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      text-decoration: none;
      cursor: pointer;
    }

    .ghostButton:disabled {
      opacity: 0.6;
      cursor: default;
    }
    ```
  - [x] Ajouter, à la suite de `.ghostButton`/`.ghostButton:disabled` :
    ```css
    /* components.button-destructive (DESIGN.md) — réservée exclusivement à Télécharger/
       Supprimer un document (UX-DR15/Do's and Don'ts DESIGN.md), jamais réutilisée ailleurs. */
    .destructiveButton {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 var(--space-4);
      border: none;
      border-radius: var(--radius-md);
      background: var(--color-danger);
      color: var(--color-danger-text);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      cursor: pointer;
    }

    .destructiveButton:disabled {
      opacity: 0.6;
      cursor: default;
    }

    /* Actions Télécharger/Supprimer de DocumentCard — sibling du bouton d'ouverture de la
       carte (EXPERIENCE.md "Actions document"). Répartition 50/50 via > *, pas de classe
       dédiée par bouton. */
    .documentActions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }

    .documentActions > * {
      flex: 1;
    }
    ```
  - [x] Ajouter `flex-wrap: wrap;` à `.actions` (défense pour 3 boutons — Fermer/Télécharger/Supprimer — sur un panneau mobile étroit ; aucun effet sur les usages à 2 boutons existants) :
    ```css
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-3);
    }
    ```

- [ ] Task 15: Vérification manuelle de bout en bout (AC #1, #2, #3)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Exécuter la migration SQL de la Task 8 avant toute vérification réseau. Exécutée par Guillaume.
  - [x] **AC#1** : ouvrir un projet ayant un document déjà synchronisé (`storagePath` non null) → onglet Documents → "Télécharger" sur la carte ET dans le détail → le fichier s'enregistre sur l'appareil (nom d'origine conservé, cf. `download: fileName`). Vérifier qu'un document dont `storagePath` est encore `null` (upload en cours) affiche "Télécharger" désactivé plutôt qu'un lien cassé. **Vérifié par Guillaume en conditions réelles — fonctionne.**
  - [ ] **AC#2** : "Supprimer" (carte ou détail) → modale de confirmation "Supprimer ce document ?" avec le nom du fichier, bouton "Supprimer" en rouge (`--color-danger`) visuellement distinct du bouton "Annuler" (bordure seule) → "Annuler" ferme sans rien supprimer.
  - [ ] **AC#3** : confirmer la suppression → le document disparaît immédiatement de la liste (et le détail se ferme s'il était ouvert) → vérifier en IndexedDB que `documents`/`documentFiles` ne portent plus l'entrée, qu'une entrée `syncQueue` `field: "__record__", operation: "delete"` est apparue puis a disparu après synchro → vérifier côté Supabase que la ligne `public.documents` ET le fichier du bucket `documents` ont disparu.
  - [ ] **Cross-appareil (AD-3)** : supprimer un document depuis un second profil/appareil → sur le premier appareil (qui avait déjà ce document en local), vérifier qu'il disparaît de la liste après le pull suivant sans action manuelle (réconciliation `sync/client.ts`, Task 11).
  - [ ] Non-régression : onglets Tâches/Notes inchangés ; liste/consultation de documents (Story 6.2 — nom, type, taille, date, badge "nouveau", priorité, provenance) inchangée ; ajout de document (Story 6.1) inchangé.
  - [ ] Vérifier le clavier : dans `DocumentDetail`, Tab/Maj+Tab cycle correctement entre Fermer/Télécharger/Supprimer (ou seulement Fermer/Supprimer si Télécharger est désactivé) ; dans `ConfirmDialog`, cycle Annuler/Supprimer inchangé.
  - [ ] Nettoyage des données de test en fin de session (IndexedDB + Supabase, si applicable) — cette story elle-même fournit enfin l'outil pour le faire (contrairement aux Stories 6.1/6.2, qui devaient le reporter faute de fonctionnalité de suppression).

### Review Findings

- [x] [Review][Patch] Boutons "Supprimer" toujours visibles (carte + détail) utilisent le style plein `--color-danger` réservé exclusivement à la confirmation de suppression — contredit DESIGN.md ("réservé à la confirmation... jamais ailleurs") et le mockup source `key-delete-confirmation.html` (`.doc-actions .action.delete` = contour/texte danger, pas fond plein ; seul `.btn-destructive` de la modale est plein). [app/projects/[id]/project-view.tsx (DocumentCard, DocumentDetail) ; app/projects/[id]/project-view.module.css (.destructiveButton)]
- [x] [Review][Patch] `/api/documents/[id]/preview` n'a aucune garde de type MIME côté serveur — n'importe quel document (quel que soit son type déclaré) peut être rendu inline via navigation directe vers la route, contournant la restriction client `documentPreviewKind` qui est la seule protection contre le risque déjà connu (mimeType client non validé à l'upload). [sync/server.ts:getDocumentPreviewUrl, data/remote/document-storage.ts:createDocumentPreviewUrl]
- [x] [Review][Patch] `getDocumentStoragePath` traite une erreur réseau/Postgres transitoire de la même façon qu'une ligne absente (retourne `null` sur `error`) — `deleteDocumentAndFile` saute alors le retrait Storage mais supprime quand même la ligne Postgres, orphelinant le fichier Storage de façon permanente sous ce mode d'échec précis. [data/remote/sync.ts:getDocumentStoragePath]
- [x] [Review][Patch] `getDocumentDownloadUrl` transmet `data.file_name` tel quel à `createDocumentSignedUrl` sans repli si vide/absent, contrairement au repli `|| "Document"` déjà utilisé partout ailleurs dans l'UI pour ce même champ. [sync/server.ts:getDocumentDownloadUrl]
- [x] [Review][Patch] `getDocumentDownloadUrl`/`getDocumentPreviewUrl` laissent une exception de `createDocumentSignedUrl`/`createDocumentPreviewUrl` se propager non interceptée jusqu'au route handler (500 générique du framework) au lieu de dégrader proprement en 404, contrairement au précédent `getNoteAudioPlaybackUrl` (Story 5.2) sur lequel elles sont pourtant modelées. [sync/server.ts:getDocumentDownloadUrl, getDocumentPreviewUrl]
- [x] [Review][Patch] Les boutons "Télécharger"/"Supprimer" de `DocumentCard`/`DocumentDetail` n'ont aucun libellé accessible différenciant par élément (juste "Télécharger"/"Supprimer" littéral) — un utilisateur de lecteur d'écran tabulant une liste de documents ne peut pas savoir quel fichier chaque contrôle affecte. [app/projects/[id]/project-view.tsx (DocumentCard, DocumentDetail)]
- [x] [Review][Patch] La `description` de `ConfirmDialog` n'est reliée à aucun `aria-describedby` sur la modale — le nom du fichier définitivement supprimé n'est pas annoncé aux technologies d'assistance, sur l'usage le plus critique de ce composant à ce jour. [components/confirm-dialog.tsx]
- [x] [Review][Patch] `pushQueueEntries` décide suppression vs upsert en n'inspectant que `group[0].operation` — invariante maintenue par convention ailleurs (`enqueueDelete` purge les autres entrées) plutôt que vérifiée localement ; rendre robuste à peu de frais en cherchant explicitement l'entrée `delete` du groupe. [sync/server.ts:pushQueueEntries]
- [x] [Review][Defer] Piège à focus de `DocumentDetail` ne tient pas compte de l'`<iframe>` d'aperçu PDF comme 4e élément focalisable ; limitation fondamentale d'un contenu iframe cross-origin (les événements clavier qu'il reçoit ne remontent jamais au parent) — même classe de lacune déjà acceptée pour `app/capture-flow.tsx` (Story 3.1, signalée par deux revues à l'époque aussi). [app/projects/[id]/project-view.tsx:DocumentDetail] — deferred, pre-existing pattern
- [x] [Review][Defer] `deleteDocument(id)` sur un id sans ligne locale correspondante (référence en mémoire périmée après suppression concurrente) est un no-op inoffensif qui enfile et pousse quand même une suppression pour rien — fenêtre de course étroite, aucune conséquence visible pour l'utilisateur. [data/local/documents.ts:deleteDocument] — deferred, narrow race
- [x] [Review][Defer] Fenêtre de course étroite : `removeDocumentFile` réussit mais `deleteDocumentRow` échoue ensuite — la ligne Postgres reste avec un `storage_path` pointant vers un fichier déjà disparu ; un téléchargement/aperçu concurrent pendant cette fenêtre reçoit une erreur Storage brute plutôt qu'un message in-app. [sync/server.ts:deleteDocumentAndFile] — deferred, narrow race
- [x] [Review][Defer] Le lien `<a href>` de téléchargement/l'aperçu n'a aucune gestion in-app d'un 401/404 — le navigateur navigue réellement vers la réponse d'erreur et sort l'utilisateur de la SPA. 401 pratiquement inatteignable (proxy.ts intercepte déjà les sessions expirées) ; 404 nécessite la fenêtre de course ci-dessus. [app/projects/[id]/project-view.tsx (DocumentCard, DocumentDetail)] — deferred, narrow race
- [x] [Review][Defer] `fetchAllProjectsTasksNotesAndDocuments` n'a aucune pagination — risque de troncature silencieuse à la limite par défaut de PostgREST pour un très grand volume de documents. Caractéristique préexistante de cette fonction (utilisée par tout pull, pas introduite par cette story), même famille que plusieurs autres risques déjà acceptés dans ce code base pour un outil mono-utilisateur. [data/remote/sync.ts:fetchAllProjectsTasksNotesAndDocuments] — deferred, pre-existing
- [x] [Review][Defer] La réconciliation de suppression cross-appareil (`pullOnce`) purge silencieusement toute entrée de champ en attente pour un document supprimé ailleurs, sans conflit visible — AD-3 cite explicitement "priorité changée sur un appareil, document supprimé sur l'autre" comme son propre exemple à ne jamais silencier. Correspond toutefois à la décision déjà établie et documentée (Story 6.1 Dev Notes AD-3) que `Document.priority` n'est pas conflict-tracké et qu'aucune UI d'édition n'existe — inatteignable aujourd'hui via l'UI. [sync/client.ts:pullOnce (réconciliation)] — deferred, consistent with established Story 6.1 interpretation
- [x] [Review][Defer] `documentActionError` reste affiché indéfiniment après un échec de suppression tant qu'aucune nouvelle suppression n'est tentée, y compris après changement d'onglet, alors que la modale de confirmation se ferme immédiatement au même moment — léger papillon UX, faible probabilité de déclenchement (écriture Dexie locale pure, échec rare). [app/projects/[id]/project-view.tsx:handleConfirmDeleteDocument] — deferred, low-probability UX papercut
- [x] [Review][Defer] Aucun attribut `sandbox` sur l'`<iframe>` d'aperçu PDF — durcissement défense-en-profondeur plausible, mais non vérifiable sans test réel qu'il ne casserait pas le rendu PDF natif du navigateur ; risque déjà très faible (isolation cross-origin déjà effective par nature, app mono-utilisateur AD-9, bucket RLS). [app/projects/[id]/project-view.tsx:DocumentDetail (iframe)] — deferred, unverified without live testing

**Trouvailles rejetées comme bruit** : course entre `enqueueDelete` (purge sans filtre de statut) et une entrée "syncing" en vol — déjà couverte par la garde de réédition existante de `markSucceeded`/`markFailed` (no-op gracieux sur une entrée disparue) · transactions Dexie séparées par document dans la boucle de réconciliation de `pullOnce` — même précédent que toutes les autres boucles de la fonction (projects/tasks/notes, un try/catch par ligne) · absence de tests automatisés — convention établie et documentée du projet · absence de vérification de propriété applicative au-delà de RLS sur les nouvelles fonctions `data/remote/` — même modèle de confiance que tout le reste du code base, décision d'architecture documentée (AD-4/AD-9, mono-utilisateur) · deux `useEffect` séquentiels sur `documentItem?.id` dans `DocumentDetail` — même précédent déjà en place dans `NoteDetail` (4 effets distincts sur `note?.id`/`note?.type`) · absence de `onError` sur l'`<iframe>` PDF — choix délibéré, l'événement `error` d'un iframe cross-origin ne se déclenche pas de façon fiable pour un statut HTTP en erreur (contrairement à `<img>`) · sensibilité à la casse du mimeType dans `documentPreviewKind` — `File.type` est garanti en minuscules ASCII par la spec File API, inatteignable via le flux de capture réel de l'app (Story 6.1) · clic sur "Télécharger" hors ligne affichant une erreur navigateur brute — aucun précédent de garde `navigator.onLine` ailleurs dans ce code base (transcription, push), et un téléchargement distant est intrinsèquement impossible hors ligne quelle que soit la qualité du message.

## Dev Notes

**Cette story introduit deux primitives nouvelles pour tout le projet, pas seulement Document** : c'est la première suppression jamais implémentée (`SyncOperation: "delete"`, `DELETE_FIELD`, `enqueueDelete`) et le premier chemin de lecture/téléchargement servi par le serveur pour un fichier Storage `documents`. Les patterns introduits ici (`enqueueDelete` dans `data/local/sync-queue.ts`, réconciliation de suppression au pull dans `sync/client.ts`) sont écrits de façon générique (paramétrés par `SyncEntity`) — une future story de suppression de Task/Note/Project pourra les réutiliser tels quels, seule la réconciliation au pull (Task 11) est actuellement spécifique aux documents et devra être répliquée pour toute autre entité qui gagnerait un jour une suppression.

**Pourquoi l'ordre "retirer Storage puis supprimer la ligne" dans `deleteDocumentAndFile`** (`sync/server.ts`) plutôt que l'inverse : rend l'opération idempotente sous retry. Si la ligne existe encore (retry après échec), `storage_path` est relisible et le retrait Storage (déjà idempotent, `.remove()` sur un chemin absent ne lève pas) peut être retenté sans risque avant de retenter la suppression de ligne. L'ordre inverse (ligne puis Storage) rendrait un retry après échec du retrait Storage impossible à rattraper : la ligne — et donc `storage_path` — aurait déjà disparu, laissant un fichier orphelin définitivement irrécupérable par le code.

**Pourquoi la réconciliation de suppression cross-appareil vit dans `pullOnce()` plutôt que dans une nouvelle route/mécanisme dédié** : `fetchAllProjectsTasksNotesAndDocuments` renvoie déjà l'état complet (pas de pagination/filtre incrémental, cf. Dev Notes Story 3.2 — "un simple tout récupérer suffit pour un outil mono-utilisateur"), donc un document présent en local mais absent du snapshot est un signal suffisant et gratuit (aucun appel réseau supplémentaire). La garde `storagePath !== null` est ce qui empêche ce mécanisme de supprimer par erreur un document créé hors ligne et pas encore poussé (cf. Task 11).

**Pourquoi `--color-danger`/`.destructiveButton` n'existaient nulle part dans le code avant cette story** malgré leur présence dans `DESIGN.md`/`app/globals.css` depuis la Story 1.3 : `DESIGN.md` le dit explicitement ("réservée à la confirmation de suppression, jamais ailleurs") — Document est la seule entité supprimable de toute la V1 (FR-21), donc le premier et unique consommateur possible.

**Pourquoi le téléchargement passe par une redirection serveur (`app/api/documents/[id]/download`) et non un lien direct vers Supabase Storage** : le bucket `documents` est privé (AD-4/NFR-2) — aucune URL publique stable n'existe. Même mécanisme exact que la lecture audio (`app/api/notes/[id]/audio`, Story 5.2) : URL signée de 60s générée à la demande côté serveur (AD-6), jamais exposée telle quelle au client.

**Risque résiduel documenté, non traité par cette story** : une course entre `deleteDocument()` (retire la ligne locale) et un cycle `uploadPendingDocuments()` déjà en vol pour le MÊME document (créé puis supprimé très rapidement, avant la fin de son propre upload) peut laisser un objet Storage orphelin jamais référencé — `markDocumentUploaded` échoue silencieusement ("Document introuvable.", catché) une fois la ligne locale disparue, et la ligne distante n'existe jamais pour que `deleteDocumentAndFile` la retrouve. Fenêtre d'exploitation étroite, conséquence bénigne (objet orphelin, pas de perte de donnée utilisateur) — même position que les autres lacunes de concurrence déjà consignées dans `deferred-work.md` pour `uploadPendingDocuments` (Story 6.1). Ne pas corriger dans cette story ; consigner dans `deferred-work.md` si retrouvé en revue.

### Architecture Compliance

- **AD-1 (Local-first)** : `deleteDocument` (Task 3) écrit d'abord dans Dexie (suppression ligne + blob + file de synchro), dans une seule transaction, avant toute tentative réseau — même position que `createDocument`.
- **AD-2 (direction de dépendance)** : `sync/server.ts` reste le seul point d'entrée `app/api/*` vers `data/remote/` ; `app/api/documents/[id]/download/route.ts` importe `sync/server`, jamais `data/remote/` directement.
- **AD-3 (résolution de conflit) — première application réelle de la clause suppression** : "une suppression concurrente à une modification de champ ... est traitée comme un conflit réel" (ARCHITECTURE-SPINE.md AD-3) est satisfaite au niveau de la file locale par `enqueueDelete` (purge tout champ pending avant d'ajouter l'entrée `delete`) — un champ modifié sur un AUTRE appareil pendant que celui-ci supprime n'est jamais perdu silencieusement côté serveur : `deleteDocumentAndFile` retire la ligne entière quel que soit l'état de ses champs, et la modification concurrente distante devient simplement obsolète (le document n'existe plus). Aucun état "conflit visible" dédié n'est introduit pour ce cas précis (contrairement à `Task.status`/`priority`) — cohérent avec le fait que Document n'a de toute façon aucun champ conflict-tracké après création (cf. Dev Notes Story 6.1).
- **AD-4 (RLS)** : aucune nouvelle policy de table — `documents_owner` (`for all`, Story 6.1) couvre déjà DELETE. Deux nouvelles policies `storage.objects` (Task 8).
- **AD-5/AD-8 (stockage)** : `removeDocumentFile` cible exclusivement le bucket `documents`, jamais `audio`.
- **AD-6 (serveur uniquement)** : `createDocumentSignedUrl`/`removeDocumentFile`/`deleteDocumentRow`/`getDocumentStoragePath` restent dans `data/remote/` (`"server-only"` hérité) ; `app/api/documents/[id]/download/route.ts` est l'unique point d'entrée réseau pour le téléchargement.

### Library/Framework Requirements

Aucune nouvelle dépendance npm. Stack inchangée : Next.js 16.3.0, Dexie 4.4.4, `@supabase/supabase-js` 2.112.0.

### File Structure Requirements

**Créés :**
```text
app/api/documents/[id]/download/route.ts   # redirection vers URL signée de téléchargement
```

**Modifiés :**
```text
domain/sync.ts                               # commentaire DELETE_FIELD (activé par cette story)
data/local/sync-queue.ts                     # + enqueueDelete
data/local/documents.ts                      # + deleteDocument ; en-tête corrigé
data/local/index.ts                          # + export enqueueDelete, deleteDocument
data/remote/document-storage.ts              # + createDocumentSignedUrl, removeDocumentFile ; en-tête corrigé
data/remote/sync.ts                          # + getDocumentStoragePath, deleteDocumentRow ; en-tête corrigé
data/remote/index.ts                         # + exports des 4 fonctions ci-dessus
sync/server.ts                               # + deleteDocumentAndFile, getDocumentDownloadUrl ;
                                              #   routage delete dans pushQueueEntries
sync/client.ts                               # pullOnce : réconciliation de suppression cross-appareil
components/confirm-dialog.tsx                # + props description/variant
components/confirm-dialog.module.css         # + .description, .destructiveButton
app/projects/[id]/project-view.tsx           # DocumentCard/DocumentDetail : actions Télécharger/
                                              #   Supprimer, ConfirmDialog, état/handlers, en-tête corrigé
app/projects/[id]/project-view.module.css    # + .destructiveButton, .documentActions ;
                                              #   .ghostButton/.actions étendus
```

**Explicitement non modifiés** : `app/capture-flow.tsx` (ajout de document, Story 6.1) ; `data/local/db.ts` (aucune nouvelle version Dexie — tables/index existants suffisent, `syncQueue` a déjà un index `entityId` depuis la Story 3.2) ; `app/api/sync/push/route.ts`/`processQueue` (`sync/client.ts`) — déjà génériques, aucune entrée de file n'a besoin d'un traitement spécial côté client pour être poussée, seul le SERVEUR (`pushQueueEntries`) distingue `delete` des autres opérations.

### Project Structure Notes

Alignement complet avec les patrons déjà établis : suppression optimiste locale + file de synchro (même schéma que toute écriture depuis la Story 3.2) ; URL signée de courte durée pour un accès Storage privé (même schéma que la lecture audio, Story 5.2) ; modale de confirmation partagée étendue plutôt que dupliquée (`components/confirm-dialog.tsx`, déjà anticipé par son propre commentaire d'en-tête depuis la Story 2.3). Aucune variance détectée.

### Testing Standards

Aucun framework de test automatisé imposé (identique à toutes les stories précédentes). Vérification manuelle exhaustive en Task 15 : navigateur (carte + détail, téléchargement réel, modale de confirmation, cycle clavier) + inspection IndexedDB (disparition des tables `documents`/`documentFiles`, cycle de vie de l'entrée `syncQueue` `delete`) + inspection Supabase (ligne `public.documents` ET fichier du bucket `documents` disparus) + vérification cross-appareil de la réconciliation de suppression (Task 11). Comme pour les Stories 6.1/6.2, l'agent qui exécutera cette story ne peut probablement pas dérouler cette vérification en conditions réelles (pas de session authentifiée) — le documenter explicitement plutôt que prétendre l'avoir fait, même précédent que toutes les stories précédentes touchant Supabase.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Documents, Story 6.3 (texte exact des 3 AC, FR-20/FR-21 — dernières FR de l'epic)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#FR-20 (téléchargement) ; FR-21 ("La suppression est définitive.") ; NFR-2 (confidentialité, bucket privé)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-3 (clause suppression concurrente explicite : "une suppression concurrente à une modification de champ ... est aussi traitée comme un conflit réel — jamais une suppression silencieuse d'une modification que l'utilisateur vient de faire") ; AD-5/AD-6/AD-8 (stockage, serveur uniquement, buckets) ; Consistency Conventions (enveloppe de file, `delete` porte `field: '__record__'`, "prime sur toute entrée pending restante du même entity_id")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#colors.danger ("réservée à la confirmation de suppression ... jamais utilisée ailleurs") ; components.button-destructive ; components.modal ("confirmation de suppression de document" citée explicitement) ; Do's and Don'ts ("ne jamais utiliser danger pour autre chose")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Actions document | Carte document, détail | Deux actions visibles : Télécharger, Supprimer (confirmation avant suppression, irréversible)") ; "Bouton destructif | ... | Toujours dans une modale de confirmation à deux actions (Annuler / Supprimer), jamais en action directe sans confirmation"]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-delete-confirmation.html — copie exacte réutilisée : titre modale "Supprimer ce document ?", corps "<nom> sera définitivement supprimé et ne pourra pas être récupéré.", boutons "Annuler"/"Supprimer", actions "Télécharger"/"Supprimer" directement sur la carte]
- [Source: _bmad-output/implementation-artifacts/6-1-ajout-dun-document.md — entité `Document`/stockage Dexie/synchronisation upload déjà livrés, réutilisés tels quels ; policy `storage.objects` "documents_owner_insert" déjà en place (Task 8) ; deferred-work.md "mimeType client non validé, Story 6.2/6.3 ne devraient pas en hériter silencieusement" — traité par `download: fileName` sur l'URL signée (Task 5, Dev Notes)]
- [Source: _bmad-output/implementation-artifacts/6-2-liste-et-consultation-des-documents-dun-projet.md — `DocumentCard`/`DocumentDetail` lecture seule, piège à focus à 1 élément, `listDocumentsByProject`/liveQuery déjà en place, réutilisés/étendus]
- [Source: _bmad-output/implementation-artifacts/5-2-enregistrement-dune-note-vocale.md — patron complet URL signée + route de redirection (`getNoteAudioPlaybackUrl`/`app/api/notes/[id]/audio/route.ts`) répliqué à l'identique pour le téléchargement de document ; policies `storage.objects` select/insert du bucket `audio`, même structure reprise pour `documents`]
- [Source: _bmad-output/implementation-artifacts/2-3-archivage-et-desarchivage-dun-projet.md — `components/confirm-dialog.tsx` créé pour la confirmation "Désarchiver", étendu ici avec une variante destructive plutôt que dupliqué]
- [Source: _bmad-output/implementation-artifacts/3-2-ecriture-hors-ligne-et-synchronisation-automatique.md — enveloppe de file de synchronisation (`domain/sync.ts`), `enqueueCreate`/`enqueueField`, `processQueue`/`pullOnce` déjà génériques par entité ; `DELETE_FIELD` déjà déclaré mais jamais produit avant cette story]
- [Source: app/projects/[id]/project-view.tsx — `TaskCard`/`StatusRow` (Story 3.5) comme précédent de sous-composant sibling non imbriqué dans le bouton d'ouverture de carte]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#"code review of story-6.1" — mimeType client non validé (adressé, cf. Task 5 Dev Notes) ; aucune vérification de propriété avant upload (`upload-document/route.ts`, non affecté par cette story — le téléchargement/suppression passent par `documents_owner`/RLS, jamais par ce endpoint)]
- [Source: _bmad-output/project-context.md#Agent Workflow Behavior — ne pas s'arrêter aux HALT procéduraux de bmad-create-story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre (après régénération des types de route Next.js via `npm run build` — `RouteContext<"/api/documents/[id]/download">` n'existait pas encore dans `.next/types` avant la première compilation de la nouvelle route).
- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker ; `/api/documents/[id]/download` correctement enregistrée comme route dynamique aux côtés des routes `/api/sync/*` et `/api/notes/[id]/audio` existantes).
- Correctif de typage trouvé pendant l'implémentation (Task 13, `DocumentDetail`) : le piège à focus à 3 éléments mélange des refs `HTMLButtonElement | null` (Fermer, Supprimer) et `HTMLAnchorElement | null` (Télécharger) dans un même tableau — le prédicat de type initial (`el is HTMLElement`) était rejeté par TypeScript (`HTMLElement` n'est pas un sous-type de `HTMLButtonElement | HTMLAnchorElement | null`, l'union inférée du tableau). Corrigé en rétrécissant vers `el is HTMLButtonElement | HTMLAnchorElement` et en castant `document.activeElement` vers ce même type pour `indexOf` — non anticipé par la story (qui utilisait `HTMLElement` par simplicité), corrigé directement en cours d'implémentation, aucun changement de comportement runtime.
- Sanity check navigateur (`preview_start` sur `next dev`, port 3000 déjà occupé par le serveur d'une session parallèle — même symptôme déjà documenté dans le Debug Log des Stories 5.2/5.3/6.1, basculé sur `http://localhost:3000` qui sert le code à jour) : écran de connexion (email/mot de passe, Supabase Auth) s'affiche correctement, aucune erreur console liée à cette story. Seule erreur console présente : échec d'enregistrement du Service Worker Serwist ("Failed to register a ServiceWorker... An unknown error occurred when fetching the script") — préexistant, déjà documenté dans les Debug Log des Stories 5.2/6.1, sans rapport avec le code de cette story.
- **Vérification manuelle en conditions réelles (Task 15, AC#1/#2/#3, cross-appareil, clavier) non réalisable dans cette session** : nécessite (1) la migration SQL de la Task 8 exécutée au préalable (aucun outil MCP Supabase/base de données disponible dans cette session, même situation que toutes les stories précédentes touchant le schéma Postgres/Storage — Stories 3.2, 3.6, 5.1, 5.2, 5.3, 6.1), (2) une session authentifiée dans un navigateur pour piloter le flux réel (je ne dois jamais saisir les identifiants de Guillaume à sa place, règle de sécurité), (3) un second profil/appareil pour la vérification cross-appareil (Task 11). Reste intégralement à la charge de Guillaume, même précédent que la Task 17 de la Story 6.1 et la Task 5 de la Story 6.2.

### Completion Notes List

- **Code complet (Tasks 1 à 14)** : première suppression jamais implémentée dans le projet (`DELETE_FIELD`/`SyncOperation: "delete"` activés — `domain/sync.ts`, `enqueueDelete` — `data/local/sync-queue.ts`, `deleteDocument` — `data/local/documents.ts`) ; premier chemin de lecture/téléchargement Storage privé pour `documents` (`createDocumentSignedUrl`/`removeDocumentFile` — `data/remote/document-storage.ts`, `getDocumentStoragePath`/`deleteDocumentRow` — `data/remote/sync.ts`, `deleteDocumentAndFile`/`getDocumentDownloadUrl` — `sync/server.ts`, routage `delete` dans `pushQueueEntries`) ; nouvelle route `GET /api/documents/[id]/download` ; réconciliation de suppression cross-appareil dans `sync/client.ts` `pullOnce()` ; `components/confirm-dialog.tsx` étendu avec une variante `destructive` et une `description` optionnelle (jamais dupliqué — même précédent que son propre commentaire d'en-tête, Story 2.3) ; `DocumentCard`/`DocumentDetail` (`app/projects/[id]/project-view.tsx`) enrichis des actions Télécharger/Supprimer, état/handlers de confirmation, piège à focus généralisé à N éléments ; styles `.destructiveButton`/`.documentActions`/`.ghostButton` étendu (`app/projects/[id]/project-view.module.css` et `components/confirm-dialog.module.css`).
- **Aucune déviation de portée** : `app/capture-flow.tsx` non modifié (ajout de document, Story 6.1, hors périmètre) ; `data/local/db.ts` non modifié (aucune nouvelle version Dexie — tables/index existants suffisent) ; `app/api/sync/push/route.ts`/`processQueue` non modifiés (déjà génériques).
- Aucune nouvelle dépendance npm.
- **Task 8 (migration SQL Supabase) non exécutable par l'agent** : aucun outil MCP Supabase/base de données disponible dans cette session — même situation que toutes les stories précédentes touchant le schéma Postgres/Storage. Le SQL est prêt dans le texte de la Task 8 (policies `storage.objects` `documents_owner_select`/`documents_owner_delete`) ; reste à exécuter par Guillaume dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc`.
- **Task 15, sous-tâche 1 (build/lint/tsc) complétée** — les autres sous-tâches (parcours réel AC#1/#2/#3, vérification cross-appareil, cycle clavier réel, nettoyage des données de test) **non réalisables par l'agent dans cette session** faute d'accès Supabase/session authentifiée/second appareil (cf. Debug Log) — restent à la charge de Guillaume. Statut passé à `review` conformément au précédent établi (Stories 3.2/5.1/5.2/5.3/6.1/6.2) : le code est complet et validé par build/lint/tsc, seules la migration SQL et la vérification manuelle en conditions réelles nécessitent un accès dont l'agent ne dispose pas dans cette session.
- **Task 8 exécutée et AC#1 vérifiés par Guillaume en conditions réelles** (retour de suivi) — téléchargement fonctionnel confirmé. **Amendement post-review ajouté à sa demande** : aperçu inline (image/PDF) dans `DocumentDetail`, cf. Change Log pour le détail complet — code complet, build/lint/tsc propres, vérification manuelle de cet amendement encore à faire par Guillaume.

### File List

**Créés :**
- `app/api/documents/[id]/download/route.ts`
- `app/api/documents/[id]/preview/route.ts` (amendement — aperçu inline)

**Modifiés :**
- `domain/sync.ts` (commentaire `DELETE_FIELD`)
- `data/local/sync-queue.ts` (+ `enqueueDelete`)
- `data/local/documents.ts` (+ `deleteDocument` ; en-tête corrigé)
- `data/local/index.ts` (+ export `enqueueDelete`, `deleteDocument`)
- `data/remote/document-storage.ts` (+ `createDocumentSignedUrl`, `removeDocumentFile`, `createDocumentPreviewUrl` [amendement] ; en-tête corrigé)
- `data/remote/sync.ts` (+ `getDocumentStoragePath`, `deleteDocumentRow` ; en-tête corrigé)
- `data/remote/index.ts` (+ exports des fonctions ci-dessus)
- `sync/server.ts` (+ `deleteDocumentAndFile`, `getDocumentDownloadUrl`, `getDocumentPreviewUrl` [amendement] ; routage `delete` dans `pushQueueEntries`)
- `sync/client.ts` (`pullOnce` : réconciliation de suppression cross-appareil)
- `components/confirm-dialog.tsx` (+ props `description`/`variant`)
- `components/confirm-dialog.module.css` (+ `.description`, `.destructiveButton`)
- `app/projects/[id]/project-view.tsx` (`DocumentCard`/`DocumentDetail` : actions Télécharger/Supprimer, `ConfirmDialog`, état/handlers, piège à focus à N éléments, en-tête corrigé ; amendement — aperçu inline image/PDF dans `DocumentDetail`)
- `app/projects/[id]/project-view.module.css` (+ `.destructiveButton`, `.documentActions` ; `.ghostButton`/`.actions` étendus ; amendement — `.documentPreviewImage`, `.documentPreviewFrame`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

**Migration Supabase (Task 8) : SQL prêt, exécution en attente de Guillaume**, sur le projet `pxdmtnysvglorwchwsmc` — aucun fichier de migration versionné dans ce projet (même précédent que les stories précédentes), le SQL vit dans le texte de la Task 8 de cette story.

## Change Log

- 2026-09-03 : **Revue de code adversariale** (3 couches en parallèle — Blind Hunter, Edge Case Hunter, Acceptance Auditor — contre un diff reconstruit précisément à partir de l'état exact d'avant Story 6.3, isolé aux 15 fichiers de cette story + son amendement, faute d'historique git incrémental). 24 findings retenus après fusion/dédoublonnage : 8 patch / 8 defer / 8 rejetés comme bruit. L'Acceptance Auditor a vérifié le mockup source `key-delete-confirmation.html` et confirmé une violation réelle de DESIGN.md (fond plein `--color-danger` utilisé sur les déclencheurs "Supprimer" toujours visibles, alors qu'il est explicitement réservé à la confirmation). Les 8 patches ont tous été corrigés :
  - Boutons "Supprimer" de `DocumentCard`/`DocumentDetail` : nouvelle classe `.destructiveGhostButton` (contour/texte `--color-danger`, fond transparent) remplace `.destructiveButton` (fond plein), conforme au mockup — le fond plein reste exclusif au bouton de confirmation de `ConfirmDialog`.
  - `getDocumentPreviewUrl` (`sync/server.ts`) : ajout d'une garde de type MIME côté serveur (image/PDF uniquement), miroir de la restriction déjà côté client — empêche le contournement par navigation directe vers `/api/documents/[id]/preview`.
  - `getDocumentStoragePath` (`data/remote/sync.ts`) : lève désormais sur une erreur de lecture au lieu de la confondre avec une ligne absente — évite un fichier Storage orphelin permanent si `deleteDocumentAndFile` rencontre une erreur transitoire.
  - `getDocumentDownloadUrl` : repli `|| "Document"` sur `file_name`, cohérent avec le reste de l'UI.
  - `getDocumentDownloadUrl`/`getDocumentPreviewUrl` : la génération de l'URL signée est désormais encapsulée (dégrade en 404 propre plutôt qu'un 500 générique non intercepté).
  - `DocumentCard`/`DocumentDetail` : `aria-label` par élément sur Télécharger/Supprimer (inclut le nom du fichier).
  - `ConfirmDialog` : `description` reliée à `aria-describedby` sur la modale.
  - `pushQueueEntries` : routage suppression vs upsert cherche désormais explicitement l'entrée `delete` du groupe plutôt que de supposer sa position.
  - Les 8 findings deferred (piège à focus vs iframe PDF, suppression d'un id déjà disparu, fenêtre de course retrait Storage/suppression de ligne, gestion in-app des échecs de téléchargement, absence de pagination de `fetchAllProjectsTasksNotesAndDocuments`, réconciliation cross-appareil vs AD-3 — cohérent avec la décision déjà établie Story 6.1, persistance de `documentActionError`, absence de `sandbox` sur l'iframe PDF) sont consignés dans `deferred-work.md` et dans la section Review Findings ci-dessus.
  - `npm run build`/`npm run lint`/`npx tsc --noEmit` propres après application des 8 patches (1 avertissement ESLint non bloquant inchangé, `@next/next/no-img-element`).
  - Statut passé à `done`.
- 2026-09-03 : **Amendement post-review — aperçu inline d'un document** (retour de vérification manuelle de Guillaume : téléchargement/suppression fonctionnels, Task 8/AC#1 confirmés). Ajout d'un aperçu (image affichée directement, PDF via le lecteur natif du navigateur en `<iframe>`, plafonné à 300px de hauteur pour ne pas dominer la modale) dans `DocumentDetail`, borné aux deux mimeType attendus par FR-18 ("photos et PDF") — tout autre type retombe silencieusement sur l'absence d'aperçu (métadonnées seules, comportement inchangé). Nouvelle URL signée sans `download` (`createDocumentPreviewUrl`, `data/remote/document-storage.ts`) distincte de celle du téléchargement (qui force `Content-Disposition: attachment`) ; nouvelle route `GET /api/documents/[id]/preview`, même mécanisme de redirection que `/api/documents/[id]/download`. Rendu inline volontairement restreint à une liste fermée de mimeType (jamais un rendu générique) : mitige le risque déjà connu et documenté (mimeType client non validé à l'upload, cf. Dev Notes Task 5) dans un contexte où le contenu s'affiche désormais inline plutôt que d'être forcé en téléchargement — risque résiduel jugé négligeable pour un outil mono-utilisateur (AD-9). `npm run build`/`npm run lint`/`npx tsc --noEmit` propres (1 avertissement ESLint non bloquant, `@next/next/no-img-element`, accepté — `next/image` disproportionné pour une URL signée privée éphémère). Vérification manuelle de cet amendement à la charge de Guillaume (non testé en conditions réelles par l'agent, même limitation que le reste de cette story).
- 2026-09-03 : Implémentation complète des Tasks 1 à 14 (première suppression du projet — enveloppe de file `delete`, réconciliation cross-appareil au pull ; premier téléchargement de fichier privé Storage via URL signée + route de redirection ; `ConfirmDialog` étendu avec variante destructive ; actions Télécharger/Supprimer sur `DocumentCard`/`DocumentDetail`). `npm run build`/`npm run lint`/`npx tsc --noEmit` propres (un correctif de typage sur le piège à focus à 3 éléments, non anticipé par la story, appliqué en cours de route — cf. Debug Log). Sanity check navigateur : écran de connexion fonctionnel, aucune erreur liée à cette story. Task 8 (migration SQL Supabase) et Task 15 (vérification manuelle en conditions réelles au-delà de build/lint/tsc) non réalisables par l'agent dans cette session, faute d'accès Supabase/session authentifiée/second appareil — restent à la charge de Guillaume. Statut passé à `review`.
