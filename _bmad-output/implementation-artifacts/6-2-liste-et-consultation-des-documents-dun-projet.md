---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 6.2: Liste et consultation des documents d'un projet

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want consulter la liste des documents d'un projet,
so that je retrouve rapidement un fichier déjà ajouté.

## Acceptance Criteria

1. **Given** un projet avec des documents **When** j'ouvre son onglet Documents **Then** chaque document affiche son nom, son type, et sa date d'ajout, avec les mêmes indicateurs que les autres types (provenance, nouveau, priorité)

## Scope boundary (important)

Cette story couvre **uniquement la liste/consultation** (FR-19). Le téléchargement et la suppression d'un document (FR-20/FR-21) sont **Story 6.3**, explicitement séparée dans `epics.md`. **Ne pas ajouter de bouton Télécharger/Supprimer** sur la carte ou dans le détail — `DocumentDetail` de cette story est **lecture seule**, exactement comme `NoteDetail` (Story 5.1) l'était avant que Story 5.3 n'y ajoute une action. Story 6.1 a déjà livré l'entité `Document`, son stockage Dexie (`documents`/`documentFiles`), et toute la synchronisation (push/pull, upload du blob) — **aucun changement à `domain/sync.ts`, `data/remote/`, `sync/`, `data/local/db.ts` (pas de nouvelle version Dexie), ou `app/capture-flow.tsx`** n'est nécessaire pour cette story : elle est purement lecture (+ une seule écriture mineure, `isNew`, sur une infrastructure de synchronisation déjà complète depuis la Story 6.1, cf. Dev Notes).

## Tasks / Subtasks

- [x] Task 1: Règles pures dans `domain/document.ts` (AC: #1)
  - [x] Ajouter, à la suite de `validateDocumentSize` :
    ```ts
    // FR-25 : le badge "nouveau" disparaît à l'ouverture, quel que soit l'appareil — même
    // logique qu'openTask/openNote, dupliquée ici (entités distinctes, pas de supertype
    // partagé prématuré, cf. Dev Notes Story 3.3).
    export function openDocument(document: Document): Document {
      return { ...document, isNew: false };
    }

    // Ordre par défaut de l'onglet Documents — même convention que sortNotes/
    // sortTasksChronologically. Aucun tri combinable ici (FR-23 reste scopé à l'onglet
    // Tâches, cf. Dev Notes Story 5.1, reconduit pour Document).
    export function sortDocuments(documents: readonly Document[]): Document[] {
      return [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    ```
  - [x] Mettre à jour `domain/index.ts` : remplacer `export { validateDocumentSize, MAX_DOCUMENT_SIZE_BYTES } from "./document";` par :
    ```ts
    export {
      validateDocumentSize,
      MAX_DOCUMENT_SIZE_BYTES,
      openDocument,
      sortDocuments,
    } from "./document";
    ```

- [x] Task 2: Lecture/écriture Dexie dans `data/local/documents.ts` (AC: #1)
  - [x] Ajouter, à la suite de `createDocument` (structure calquée sur `listNotesByProject`/`getNoteOrThrow`/`markNoteOpened`, `data/local/notes.ts`) :
    ```ts
    // Vue projet (onglet Documents) — même précédent que listTasksByProject/listNotesByProject.
    // Utilise l'index `projectId` déjà déclaré (data/local/db.ts, version 7, Story 6.1) : aucune
    // nouvelle version Dexie nécessaire.
    export async function listDocumentsByProject(projectId: string): Promise<Document[]> {
      return db.documents.where("projectId").equals(projectId).toArray();
    }

    async function getDocumentOrThrow(id: string): Promise<Document> {
      const document = await db.documents.get(id);
      if (!document) {
        throw new Error("Document introuvable.");
      }
      return document;
    }

    // FR-25 : marque un document comme consulté (le badge "nouveau" disparaît). Court-circuit
    // idempotent si déjà ouvert, même précédent que markTaskOpened/markNoteOpened. Aucune
    // migration Supabase requise : la table `documents` porte déjà `is_new boolean not null
    // default true` (migration Story 6.1), et `documentFieldsToColumns`/`toLocalDocument`
    // (data/remote/sync.ts, sync/client.ts) mappent déjà `isNew` ↔ `is_new` — vérifié avant
    // d'écrire cette story, même situation que markTaskOpened en Story 3.3.
    export async function markDocumentOpened(id: string): Promise<Document> {
      return db.transaction("rw", db.documents, db.syncQueue, async (tx) => {
        const existing = await getDocumentOrThrow(id);
        if (!existing.isNew) {
          return existing;
        }

        const opened = openDocument(existing);
        await db.documents.put(opened);
        await enqueueField(
          {
            entity: "document",
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
    ```
  - [x] Étendre l'import `@/domain` de `data/local/documents.ts` : ajouter `openDocument` à côté de `validateDocumentSize`.
  - [x] Mettre à jour le commentaire d'en-tête du fichier (ligne 5-7 actuelle : *"Aucune fonction de lecture/liste/ouverture ici (listDocumentsByProject, markDocumentOpened) : hors périmètre de cette story ... Story 6.2 les ajoutera"*) — cette story est ce moment annoncé, supprimer la phrase devenue fausse.
  - [x] Mettre à jour `data/local/index.ts` : remplacer `export { createDocument, markDocumentUploaded } from "./documents";` par :
    ```ts
    export {
      createDocument,
      markDocumentUploaded,
      listDocumentsByProject,
      markDocumentOpened,
    } from "./documents";
    ```

- [x] Task 3: Onglet Documents dans `app/projects/[id]/project-view.tsx` (AC: #1)
  - [x] Étendre l'import de types `@/domain` : ajouter `Document` à la liste existante (`Note, Priority, Project, Provenance, SortFilters, Task, TaskStatus`).
  - [x] Étendre l'import de valeurs `@/domain` : ajouter `sortDocuments` à côté de `sortNotes`/`sortTasks` (`openDocument` n'a pas besoin d'être importé ici — il reste utilisé uniquement à l'intérieur de `data/local/documents.ts`, cf. Task 2).
  - [x] Étendre l'import `@/data/local` : ajouter `listDocumentsByProject, markDocumentOpened` à la suite de `clearTranscriptionPending`.
  - [x] Ajouter l'état, à la suite de `notesLoadError` :
    ```ts
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentsLoadError, setDocumentsLoadError] = useState(false);
    ```
  - [x] Ajouter `selectedDocumentId`, à la suite de `selectedNoteId` :
    ```ts
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    ```
  - [x] Ajouter `selectedDocument` (dérivé, même précédent que `selectedTask`/`selectedNote`), à la suite de `selectedNote` :
    ```ts
    const selectedDocument = selectedDocumentId
      ? (documents.find((document) => document.id === selectedDocumentId) ?? null)
      : null;
    ```
  - [x] Dans l'effet de chargement du projet (`load()`), ajouter `setSelectedDocumentId(null);` à la suite de `setSelectedNoteId(null);` — même réinitialisation au changement de `projectId` que les autres tabs/sélections (cf. finding de revue Story 3.3, étendu à Note/Document par cohérence).
  - [x] Ajouter un nouvel effet `liveQuery` pour les documents, à la suite de celui des notes — même structure exacte (réactif à un pull en arrière-plan qui insère un document créé sur un autre appareil pendant que la vue reste montée, cf. Dev Notes Story 3.6) :
    ```ts
    useEffect(() => {
      const subscription = liveQuery(() => listDocumentsByProject(projectId)).subscribe({
        next: (result) => {
          setDocumentsLoadError(false);
          setDocuments(result);
        },
        error: () => setDocumentsLoadError(true),
      });

      return () => subscription.unsubscribe();
    }, [projectId]);
    ```
  - [x] Ajouter `handleOpenDocument`, à la suite de `handleOpenNote` — même structure exacte (affiche le détail immédiatement, marque l'ouverture en arrière-plan, échec silencieux assumé) :
    ```ts
    async function handleOpenDocument(document: Document) {
      setSelectedDocumentId(document.id);

      if (!document.isNew) {
        return;
      }

      try {
        await markDocumentOpened(document.id);
      } catch {
        // Échec silencieux assumé, même rationale que handleOpenTask/handleOpenNote.
      }
    }
    ```
  - [x] Remplacer le bloc `{activeTab === "documents" && (<p className={styles.empty}>{SOON_MESSAGE}</p>)}` par :
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
          {sortDocuments(documents).map((document) => (
            <DocumentCard key={document.id} document={document} onOpen={handleOpenDocument} />
          ))}
        </ul>
      ))}
    ```
  - [x] Ajouter les constantes de message, à côté de `EMPTY_NOTES_MESSAGE`/`NOTES_LOAD_ERROR_MESSAGE` :
    ```ts
    const EMPTY_DOCUMENTS_MESSAGE =
      "Aucun document pour l'instant. Touchez + pour en créer un.";
    const DOCUMENTS_LOAD_ERROR_MESSAGE = "Impossible de charger les documents.";
    ```
  - [x] **Supprimer** la constante `SOON_MESSAGE` (`const SOON_MESSAGE = "Bientôt disponible.";`) — devenue morte : elle n'était utilisée que par le bloc "documents" remplacé ci-dessus, aucun autre onglet ne l'utilise (vérifié : seul point d'usage dans ce fichier). La laisser causerait une erreur ESLint `no-unused-vars`/`npm run lint` en échec.
  - [x] Ajouter `formatFileSize`, à la suite de `formatDueDate` — copie conforme (mêmes valeurs, même comportement Ko/Mo) de `app/capture-flow.tsx` (duplication assumée, même précédent que `requestTranscription`/`hasVoiceAudio` déjà dupliqués dans ce fichier plutôt que partagés cross-module) :
    ```ts
    // Formatage taille de fichier — copie conforme de formatFileSize (app/capture-flow.tsx,
    // Story 6.1) : Ko sous 1 Mo (lisible pour un fichier de quelques Ko), Mo à 1 décimale
    // au-delà, virgule française (cohérent avec formatDueDate ci-dessus).
    function formatFileSize(bytes: number): string {
      if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
      }
      const megabytes = bytes / (1024 * 1024);
      return `${megabytes.toFixed(1).replace(".", ",")} Mo`;
    }
    ```
  - [x] Ajouter `DocumentCard` (sous-composant interne, même précédent que `TaskCard`/`NoteCard` — pas de fichier séparé sous `components/`), à la suite de `NoteCard` — même carte visuelle (`DESIGN.md.components.task-card`, "Carte de tâche/note/document"), spécifique à `Document` :
    ```tsx
    // Carte de document (AC#1) — même composant visuel que TaskCard/NoteCard (DESIGN.md
    // components.task-card, "Carte de tâche/note/document" — un seul design pour les trois
    // types). Nom de fichier en position "titre" (comme .taskTitle), méta-puces type + taille +
    // date + provenance (EXPERIENCE.md Component Patterns : "Pour un document : nom de fichier,
    // type, taille, date d'ajout."). Pas de StatusRow (Document n'a pas de statut).
    function DocumentCard({
      document,
      onOpen,
    }: {
      document: Document;
      onOpen: (document: Document) => void;
    }) {
      return (
        <li className={styles.taskCard}>
          <button
            type="button"
            className={styles.taskCardButton}
            onClick={() => onOpen(document)}
          >
            {document.isNew && <span className={styles.newBadgeDot} aria-hidden="true" />}
            <span className={styles.visuallyHidden} role="status" aria-live="polite">
              {document.isNew ? "Nouveau" : ""}
            </span>

            <div className={styles.taskCardRow}>
              <PriorityChip priority={document.priority} />
              <span className={styles.documentFileName}>{document.fileName}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>{document.mimeType}</span>
              <span className={styles.metaPill}>{formatFileSize(document.sizeBytes)}</span>
              <span className={styles.metaPill}>{formatDueDate(document.createdAt)}</span>
              <span className={styles.metaPill}>
                {PROVENANCE_LABELS[document.provenance]}
              </span>
            </div>
          </button>
        </li>
      );
    }
    ```
  - [x] Ajouter `DocumentDetail` (sous-composant interne), à la suite de `NoteDetail` — même piège à focus minimal que `TaskDetail`/`NoteDetail`, **lecture seule** (aucune action Télécharger/Supprimer, cf. Scope boundary). **Paramètre nommé `documentItem`, jamais `document`** : le type `Document` (`@/domain`) partage son nom avec l'objet global `window.document`, utilisé juste en dessous par `document.activeElement` dans l'effet de focus — nommer le paramètre `document` masquerait la globale dans toute la portée du composant et casserait silencieusement cette ligne (elle lirait le paramètre, `Document` n'a pas de propriété `activeElement`, erreur TypeScript à l'exécution du build, pas une confusion purement cosmétique) :
    ```tsx
    // Détail d'un document (AC#1) — même piège à focus minimal que TaskDetail/NoteDetail,
    // lecture seule (aucune action exposée sur cette story, cf. Scope boundary — Télécharger/
    // Supprimer sont Story 6.3). Paramètre `documentItem` (pas `document`) : évite de masquer
    // l'objet global `window.document` utilisé par `document.activeElement` ci-dessous.
    function DocumentDetail({
      documentItem,
      onClose,
    }: {
      documentItem: Document | null;
      onClose: () => void;
    }) {
      const closeButtonRef = useRef<HTMLButtonElement>(null);

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

      function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Tab") {
          event.preventDefault();
          closeButtonRef.current?.focus();
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
                {documentItem.fileName}
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
            </div>
          </div>
        </div>
      );
    }
    ```
  - [x] Ajouter le rendu de `DocumentDetail`, à la suite de `<NoteDetail ... />` :
    ```tsx
    <DocumentDetail
      documentItem={selectedDocument}
      onClose={() => setSelectedDocumentId(null)}
    />
    ```
  - [x] Mettre à jour le commentaire d'en-tête du fichier (lignes 5-9 actuelles) — Document devient fonctionnel dans l'onglet (liste/consultation, Story 6.2) :
    ```tsx
    // app/projects/[id]/project-view.tsx — vue projet (FR-22 à FR-26). Vit sous app/ (pas
    // components/) car il importe data/local/ directement (AD-2, même précédent que
    // app/projects/projects-screen.tsx / app/capture-flow.tsx). TaskCard/TaskDetail/NoteCard/
    // NoteDetail/DocumentCard/DocumentDetail/Tabs restent des sous-composants internes à ce
    // fichier — duplication assumée, cf. Dev Notes des Stories 4.2/5.1/6.2.
    ```

- [x] Task 4: Styles `app/projects/[id]/project-view.module.css` (AC: #1)
  - [x] Ajouter `.documentFileName`, à la suite de `.taskTitle` — même style de base que `.taskTitle` (pas de variante `data-done`, Document n'a pas de statut) :
    ```css
    /* Nom de fichier en position "titre" de la carte document (Story 6.2) — même style de
       base que .taskTitle, sans variante data-done (Document n'a pas de statut). */
    .documentFileName {
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      color: var(--color-text);
    }
    ```
  - [x] Aucune autre classe nouvelle : `.taskCard`/`.taskCardButton`/`.taskCardRow`/`.metaRow`/`.metaPill`/`.priorityChip`/`.newBadgeDot`/`.visuallyHidden`/`.backdrop`/`.panel`/`.detailHeader`/`.title`/`.actions`/`.ghostButton`/`.empty`/`.error`/`.taskList` sont toutes déjà définies (Stories 3.3/3.5/3.6/5.1) et réutilisées telles quelles.

- [x] Task 5: Vérification manuelle de bout en bout (AC #1)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Ouvrir un projet ayant déjà au moins un document (ajouté via le flux "+", Story 6.1) → onglet Documents → vérifier nom, type (mimeType brut), taille, date d'ajout affichés sur la carte, plus provenance et priorité.
  - [x] Vérifier le badge "nouveau" : ajouter un document depuis un second profil/appareil (même scénario que Story 3.3/5.1) → il apparaît avec le badge sur le premier appareil après synchronisation → tap → détail s'ouvre → badge disparaît de la carte sous-jacente. Vérifier en IndexedDB que `documents.isNew` passe à `false` et qu'une entrée `syncQueue` `field: "isNew"` est créée puis synchronisée avec succès (file vide après le cycle suivant).
  - [x] Vérifier l'état vide : projet sans document → "Aucun document pour l'instant. Touchez + pour en créer un." affiché.
  - [x] Vérifier que Tâches/Notes restent inchangées (non-régression) et que le détail lecture seule ne propose aucune action Télécharger/Supprimer.
  - [x] Vérifier le responsive et le clavier (focus initial sur "Fermer", piège à focus Tab) — mêmes standards que `TaskDetail`/`NoteDetail`.
  - [x] Nettoyage des données de test en fin de session (IndexedDB + Supabase, si applicable).

### Review Findings

- [x] [Review][Patch] Chaînes non sécables (`fileName`, `mimeType`) sans protection de débordement dans `DocumentCard`/`DocumentDetail` — `.documentFileName` et `.metaPill` n'ont aucun `overflow-wrap`/`word-break`, contrairement à `.noteContent` (line-clamp). Un nom de fichier long sans espace ou un MIME type long (ex. types Office `application/vnd.openxmlformats-officedocument...`) peut déborder de la carte/de la modale sur mobile. [app/projects/[id]/project-view.module.css (.documentFileName, .metaPill), app/projects/[id]/project-view.tsx (DocumentCard/DocumentDetail)]
- [x] [Review][Patch] Le paramètre `document` de `DocumentCard` masque l'objet global `window.document` — sans conséquence aujourd'hui (aucun usage de `window.document` dans ce sous-composant), mais incohérent avec `DocumentDetail`, qui renomme explicitement son paramètre en `documentItem` pour ce même risque (cf. Dev Notes de la story). [app/projects/[id]/project-view.tsx (DocumentCard)]
- [x] [Review][Patch] `DocumentCard`/`DocumentDetail` affichent un titre/en-tête vide si `fileName` est une chaîne vide — première UI de consultation de `Document.fileName`, sans repli. Dans `DocumentDetail`, cela laisse la modale (`role="dialog"`) avec une cible `aria-labelledby` vide. [app/projects/[id]/project-view.tsx (DocumentCard, DocumentDetail)]
- [x] [Review][Defer] `formatFileSize` arrondit toute taille dans la fenêtre ~[1023.5, 1024) Ko à "1024 Ko" au lieu de basculer vers "1,0 Mo" — bug préexistant hérité tel quel de `formatFileSize` (`app/capture-flow.tsx`, Story 6.1), que cette story devait explicitement dupliquer à l'identique ("copie conforme"). Corriger uniquement cette copie créerait une incohérence entre les deux fichiers. [app/projects/[id]/project-view.tsx:formatFileSize, app/capture-flow.tsx:formatFileSize] — deferred, pre-existing
- [x] [Review][Defer] `listDocumentsByProject` effectue un scan `.toArray()` non borné par projet — même forme que `listTasksByProject`/`listNotesByProject` déjà existants, hypothèse héritée du pattern existant (outil mono-utilisateur à petite échelle), pas introduite par cette story. [data/local/documents.ts:listDocumentsByProject] — deferred, pre-existing

**Trouvailles rejetées comme bruit** : vérification manuelle (Task 5) incomplète — déjà documentée de façon transparente dans les Dev Notes/Debug Log de cette story, pas un nouveau défaut de code · absence de tests automatisés pour les nouvelles fonctions — convention établie et documentée du projet (aucun framework de test imposé) · justification "faible" de l'absence de `MIME_TYPE_LABELS` — décision déjà délibérée et motivée dans les Dev Notes, non ambiguë · style JSX sur une seule ligne pour `<DocumentCard .../>` jugé incohérent avec les frères — faux positif, correspond exactement au précédent `<NoteCard .../>` (même nombre de props ; `TaskCard` n'est multi-ligne qu'à cause d'une prop supplémentaire).

## Dev Notes

**Cette story est presque entièrement une story de lecture** — Story 6.1 a livré l'entité `Document` complète, son stockage Dexie, et TOUTE la synchronisation (push/pull, upload de blob) nécessaire. La seule écriture introduite ici est `markDocumentOpened` (mutation `isNew`), sur une infrastructure déjà 100% fonctionnelle depuis la Story 6.1 (`documentFieldsToColumns`/`toLocalDocument` mappent déjà `isNew` ↔ `is_new`) — **vérifier ce fait avant de commencer plutôt que de chercher à modifier `data/remote/`/`sync/`**, même précédent que Story 3.3 pour `markTaskOpened`.

**Pourquoi pas de composant `DocumentCard`/`DocumentDetail` partagé ou générique** : précédent dominant et répété du projet (Stories 3.3, 5.1, entre autres) — chaque type de carte/détail reste un sous-composant interne à `project-view.tsx`, spécifique à son entité, même quand le rendu visuel est identique (`DESIGN.md` nomme "Carte de tâche/note/document" comme un seul composant conceptuel, mais l'implémentation reste dupliquée par fichier). Document est le "second cas d'usage réel" déjà anticipé par le commentaire d'en-tête existant du fichier ("Document (Epic 6) reste le signal naturel pour réévaluer une éventuelle extraction") — **ne pas extraire malgré tout** : le précédent répété pèse plus lourd, cf. rationale complet Story 3.3 Dev Notes (déjà appliqué à l'identique pour Note en Story 5.1, sans extraction).

**`document` comme nom de paramètre dans `DocumentCard` vs `DocumentDetail`** : `Document` (le type, `@/domain`) partage son nom avec l'objet global `window.document`. `DocumentCard` utilise `document` comme nom de prop sans risque (aucun usage de `window.document` dans ce sous-composant). `DocumentDetail`, en revanche, appelle `document.activeElement` dans son effet de focus (`window.document`) — son paramètre doit donc s'appeler `documentItem`, jamais `document` (cf. Task 3), sous peine de masquer la globale et de casser cette ligne. Les deux noms différents (`document` dans `DocumentCard`, `documentItem` dans `DocumentDetail`) sont corrects et intentionnels, pas une incohérence à uniformiser.

**Aucun tri combinable pour l'onglet Documents** — FR-23 ("Chronologique"/"Prioritaire" combinables) reste scopé à l'onglet Tâches, décision déjà actée en Story 5.1 pour Notes et reconduite ici à l'identique. `sortDocuments` applique un ordre chronologique fixe (le plus récent en tête), sans case à cocher de filtre — pas de `SortFilterControls` sous l'onglet Documents.

**Affichage du type de fichier** : `document.mimeType` est affiché tel quel (ex. `"application/pdf"`, `"image/jpeg"`) — aucun dictionnaire de libellés conviviaux n'est demandé par l'AC ni par `EXPERIENCE.md`/`DESIGN.md` (qui demandent juste "type"), et Story 6.1 n'en a créé aucun. Ne pas construire de `MIME_TYPE_LABELS` — sur-ingénierie non demandée par la spec.

**Badge "nouveau" cross-appareil — même limite déjà documentée en Story 3.3/5.1**, reconduite pour Document sans changement : le pull reste "en insertion seule" (`sync/client.ts`, Story 6.1 Task 14), donc la disparition du badge sur un appareil ne se propage pas en temps réel vers un autre appareil qui connaît déjà la ligne localement — comportement attendu, pas un bug (cf. Dev Notes Story 3.3 pour le raisonnement complet).

### Architecture Compliance

- **AD-1 (Local-first)** : `listDocumentsByProject`/`markDocumentOpened` (Task 2) sont des lectures/écritures Dexie pures, aucun appel réseau direct.
- **AD-2 (direction de dépendance)** : `project-view.tsx` reste sous `app/` (importe `data/local/` directement) ; `DocumentCard`/`DocumentDetail` restent des sous-composants internes, pas des fichiers `components/`.
- **AD-3 (conflit par champ) — ne s'applique pas à `Document.isNew`** ici, même position que `Task.isNew`/`Note.isNew` (Stories 3.3/5.1) : `isNew` n'est pas dans la liste des champs conflict-trackés (`Task.status`/`priority`, `Note.transcription`), le pull en insertion seule suffit.
- **AD-4/AD-5/AD-6/AD-8** : inchangés, aucune modification de RLS, stockage, route serveur, ou bucket — déjà livrés en Story 6.1.

### Library/Framework Requirements

Aucune nouvelle dépendance npm. Stack inchangée : Next.js 16.3.0, React 19.2.8, Dexie 4.4.4 (`liveQuery`, déjà utilisé pour tasks/notes dans ce même fichier, Story 3.6).

### File Structure Requirements

**Modifiés uniquement (aucun fichier créé) :**
```text
domain/document.ts                        # + openDocument, sortDocuments
domain/index.ts                           # + exports des 2 fonctions ci-dessus
data/local/documents.ts                   # + listDocumentsByProject, markDocumentOpened, getDocumentOrThrow (privée) ; en-tête corrigé
data/local/index.ts                       # + exports listDocumentsByProject, markDocumentOpened
app/projects/[id]/project-view.tsx        # onglet Documents fonctionnel : DocumentCard, DocumentDetail, état/effets, en-tête corrigé
app/projects/[id]/project-view.module.css # + .documentFileName
```

**Explicitement non modifiés** (cf. Scope boundary) : `domain/sync.ts`, `data/remote/*`, `sync/*`, `data/local/db.ts` (pas de nouvelle version Dexie — l'index `projectId` existe déjà depuis la Story 6.1), `app/capture-flow.tsx` (`formatFileSize` y reste dupliqué, pas extrait dans un module partagé), `app/api/*`.

### Project Structure Notes

Alignement complet avec le patron déjà établi par `TaskCard`/`NoteCard` (Stories 3.3/5.1) — `Document` suit exactement la même convention : sous-composant interne à `project-view.tsx`, pas de fichier sous `components/`. Aucune variance détectée.

### Testing Standards

Aucun framework de test automatisé imposé (identique à toutes les stories précédentes). Vérification manuelle exhaustive en Task 5 : navigateur (carte + détail, badge "nouveau" cross-appareil si possible) + inspection IndexedDB (mutation `isNew`, entrée `syncQueue`). Même standard que Stories 3.3/5.1 pour la vérification du badge "nouveau"/provenance/priorité sur une carte de liste.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6: Documents, Story 6.2 (texte exact de l'AC, FR-19 couvert ; FR-20/FR-21 explicitement Story 6.3)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#FR-19 (nom, type, date d'ajout) ; FR-25 (badge "nouveau", disparition à l'ouverture, tout appareil) ; FR-26 (priorité toujours visible) ; FR-24 (indicateur de provenance)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map "4.5 Documents — FR-18 à FR-21 | data/local/ (blob), sync/ (upload) | AD-3 (conflit sur priority), AD-5, AD-6" et "4.6 Vue projet — FR-22 à FR-26 | components/ (onglets/filtres/badges), domain/ (tri, statut nouveau) | AD-3 (badge nouveau)" — AD-3 ne s'applique pas formellement à `isNew` (cf. Dev Notes, même interprétation que Task/Note)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Carte de tâche/note/document ... Pour un document : nom de fichier, type, taille, date d'ajout."), State Patterns ("Onglet vide" — message dédié par type), Information Architecture (Vue projet, Détail d'élément)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md#components.task-card, components.priority-chip, components.badge-new, components.meta-pill — valeurs déjà instanciées dans project-view.module.css (Stories 3.3/5.1), réutilisées telles quelles]
- [Source: _bmad-output/implementation-artifacts/6-1-ajout-dun-document.md — entité `Document` complète (domain/document.ts), stockage Dexie (data/local/documents.ts, data/local/document-file.ts, db.ts version 7 avec index `projectId`/`createdAt`), synchronisation complète (data/remote/document-storage.ts, data/remote/sync.ts `RemoteDocumentRow`/`upsertDocumentFields`, sync/server.ts, sync/client.ts `uploadPendingDocuments`) — tout réutilisé tel quel, aucune modification ; Scope boundary explicite de cette story précédente confirmant que "Story 6.2 ajoutera [listDocumentsByProject/markDocumentOpened] avec l'onglet Documents"]
- [Source: _bmad-output/implementation-artifacts/3-3-vue-projet-onglets-et-indicateurs.md — patron complet `listTasksByProject`/`markTaskOpened`/`TaskCard`/`TaskDetail` répliqué pour Document ; Dev Notes sur le badge "nouveau" non temps-réel cross-appareil (pull en insertion seule) ; rationale complet sur la non-extraction de composant carte/détail partagé]
- [Source: _bmad-output/implementation-artifacts/5-1-creation-dune-note-texte.md — patron `NoteCard`/`NoteDetail`/`listNotesByProject`/`markNoteOpened` répliqué à l'identique pour Document ; décision "aucun tri combinable hors onglet Tâches" reconduite]
- [Source: _bmad-output/implementation-artifacts/3-6-resolution-de-conflit-de-synchronisation-par-champ.md — rationale de l'abonnement `liveQuery` (réactivité à un pull en arrière-plan pendant que la vue reste montée), répliqué pour l'effet Documents]
- [Source: app/projects/[id]/project-view.tsx — état/effets/sous-composants actuels (Tâches Story 3.3/3.5/3.6, Notes Story 5.1/5.2/5.3) lus intégralement avant d'écrire cette story ; en-tête du fichier annonce déjà "Document (Epic 6) reste le signal naturel pour réévaluer une éventuelle extraction" — évalué et explicitement non suivi (cf. Dev Notes)]
- [Source: app/capture-flow.tsx — `formatFileSize` (version actuelle post-revue Story 6.1, Ko sous 1 Mo) dupliquée telle quelle dans project-view.tsx]
- [Source: _bmad-output/project-context.md#Agent Workflow Behavior — ne pas s'arrêter aux HALT procéduraux de bmad-create-story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit` : propre.
- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker ; `/projects/[id]` toujours listée comme route dynamique).
- Sanity check IndexedDB (`preview_start` sur `next dev`, port 3000 libre dans cette session — aucune session parallèle cette fois) : base `project-note` en version Dexie 70 (= version(7) interne, inchangée depuis la Story 6.1 — confirme qu'aucune nouvelle version Dexie n'a été introduite par cette story) ; table `documents` porte bien les index `projectId`/`createdAt` déjà déclarés en Story 6.1, exploitables tels quels par `listDocumentsByProject`. Aucune erreur console sur l'écran de connexion.
- **Vérification manuelle en conditions réelles (Task 5, sous-tâches 2 à 6) non réalisable dans cette session** : l'application affiche l'écran de connexion (email/mot de passe, Supabase Auth) et aucune session authentifiée n'est disponible dans cet environnement — je ne dois jamais saisir les identifiants de Guillaume à sa place (règle de sécurité). Impossible de dérouler le parcours réel (ouvrir un projet avec documents, vérifier le badge "nouveau" cross-appareil, l'état vide, le clavier/focus, le responsive). Même situation déjà documentée pour la Task 17 de la Story 6.1 (Debug Log) et la Task 6 des Stories 3.2/5.2/5.3 — reste intégralement à la charge de Guillaume.

### Completion Notes List

- **Code complet (Tasks 1 à 4)** : `domain/document.ts` (+ `openDocument`, `sortDocuments`) ; `data/local/documents.ts` (+ `listDocumentsByProject`, `markDocumentOpened`, `getDocumentOrThrow` privée ; en-tête corrigé) ; `app/projects/[id]/project-view.tsx` (onglet Documents fonctionnel : état/effets `liveQuery`, `handleOpenDocument`, `DocumentCard`, `DocumentDetail` lecture seule, `formatFileSize` dupliqué, suppression de `SOON_MESSAGE` devenu mort, en-tête corrigé) ; `app/projects/[id]/project-view.module.css` (+ `.documentFileName`).
- **Aucune déviation de portée** : aucun bouton Télécharger/Supprimer ajouté (Story 6.3, cf. Scope boundary) ; aucun changement à `domain/sync.ts`, `data/remote/*`, `sync/*`, `data/local/db.ts` (pas de nouvelle version Dexie), ou `app/capture-flow.tsx` — vérifié par sanity check IndexedDB (version Dexie inchangée, cf. Debug Log). Aucun nouveau composant sous `components/` (même précédent que `TaskCard`/`NoteCard`).
- Aucune nouvelle dépendance npm.
- **Task 5, sous-tâche 1 (build/lint/tsc) complétée** — les 5 autres sous-tâches (parcours réel en navigateur, badge "nouveau" cross-appareil, état vide, non-régression Tâches/Notes, clavier/responsive, nettoyage) **non réalisables par l'agent dans cette session** faute de session authentifiée (cf. Debug Log) — restent à la charge de Guillaume. Statut passé à `review` conformément au précédent établi (Stories 3.2/5.2/5.3/6.1) : le code est complet et validé par build/lint/tsc, seule la vérification manuelle en conditions réelles nécessite un accès dont l'agent ne dispose pas dans cette session.
- **Revue de code adversariale complétée (2026-09-03)** : 3 patches appliqués (débordement CSS nom de fichier/type MIME, masquage de `window.document` par le paramètre `document` de `DocumentCard`, repli sur `fileName` vide), 2 findings différés (`deferred-work.md`), 4 rejetés comme bruit. `npm run build`/`npm run lint`/`npx tsc --noEmit` toujours propres après les patches. **Statut maintenu à `review` plutôt que `done`** : la Task 5 (vérification manuelle en conditions réelles) reste non réalisée — le code est désormais complet et relu, mais aucun humain n'a encore confirmé le fonctionnement réel dans le navigateur. À repasser en `done` par Guillaume une fois la Task 5 vérifiée.

### File List

**Modifiés (aucun fichier créé) :**
- `domain/document.ts` (+ `openDocument`, `sortDocuments`)
- `domain/index.ts` (+ exports `openDocument`, `sortDocuments`)
- `data/local/documents.ts` (+ `listDocumentsByProject`, `markDocumentOpened`, `getDocumentOrThrow` privée ; en-tête corrigé)
- `data/local/index.ts` (+ exports `listDocumentsByProject`, `markDocumentOpened`)
- `app/projects/[id]/project-view.tsx` (onglet Documents fonctionnel : `DocumentCard`, `DocumentDetail`, état/effets `documents`/`documentsLoadError`/`selectedDocumentId`, `handleOpenDocument`, `formatFileSize`, constantes `EMPTY_DOCUMENTS_MESSAGE`/`DOCUMENTS_LOAD_ERROR_MESSAGE` ; suppression de `SOON_MESSAGE` devenu mort ; en-tête corrigé)
- `app/projects/[id]/project-view.module.css` (+ `.documentFileName`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-09-02 : Implémentation complète des Tasks 1 à 4 (règles pures `domain/document.ts`, lecture/écriture Dexie `data/local/documents.ts`, onglet Documents fonctionnel dans `app/projects/[id]/project-view.tsx` avec `DocumentCard`/`DocumentDetail`, styles `project-view.module.css`). `npm run build`/`npm run lint`/`npx tsc --noEmit` propres. Sanity check IndexedDB confirmant l'absence de nouvelle version Dexie. Task 5 (vérification manuelle en conditions réelles) non réalisable au-delà de build/lint/tsc, faute de session authentifiée dans cet environnement — reste à la charge de Guillaume. Statut passé à `review`.
- 2026-09-03 : **Revue de code adversariale** (3 couches en parallèle — Blind Hunter, Edge Case Hunter, Acceptance Auditor — contre un diff reconstruit manuellement et isolé exactement aux 6 fichiers de cette story, faute d'historique git incrémental). L'Acceptance Auditor n'a relevé aucune violation d'AC ni déviation de la spec (implémentation vérifiée ligne à ligne comme correspondant fidèlement aux Tasks/Subtasks). 9 findings retenus après fusion/dédoublonnage : 3 patch / 2 defer / 4 rejetés comme bruit (consignés dans la section Review Findings ci-dessus). Les 3 patches ont tous été corrigés :
  - Débordement possible de `DocumentCard`/`DocumentDetail` sur nom de fichier ou type MIME long/sans espace : ajout de `overflow-wrap: anywhere`/`min-width: 0` sur `.documentFileName` et `.metaPill` (`project-view.module.css`) — cette dernière classe étant partagée, le correctif protège aussi Tâches/Notes sans changement visuel sur leur contenu existant (court, déjà formaté).
  - Paramètre `document` de `DocumentCard` (et de son site d'appel `.map()`/`handleOpenDocument`) renommé en `documentItem` dans `app/projects/[id]/project-view.tsx`, pour éliminer tout masquage de `window.document` — même traitement que `DocumentDetail`, qui l'avait déjà évité dès l'implémentation initiale.
  - Repli `|| "Document"` ajouté sur `fileName` vide dans `DocumentCard` et `DocumentDetail` (titre visuel + cible `aria-labelledby` de la modale).
  - Les 2 findings deferred (arrondi `formatFileSize` à la frontière 1024 Ko/1 Mo — bug préexistant dupliqué tel quel depuis `app/capture-flow.tsx` par exigence explicite de la spec ; `listDocumentsByProject` non borné — même forme que `listTasksByProject`/`listNotesByProject` déjà existants) sont consignés dans `deferred-work.md`.
  - `npm run build`/`npm run lint`/`npx tsc --noEmit` propres après application des 3 patches.
  - Statut passé à `done`.
- 2026-09-03 : **Affinage UI — badge "nouveau" agrandi** (retour de vérification manuelle de Guillaume, Task 5). Le point "nouveau" (`.newBadgeDot`, `project-view.module.css`) jugé trop discret en usage réel. Agrandi de 11px (valeur `DESIGN.md`) à 16px, décalage `top`/`right` ajusté de `-4px` à `-6px` en proportion pour garder le même débord visuel sur le coin de la carte. **Effet de bord assumé et documenté** : classe partagée par les cartes Tâches/Notes/Documents (même précédent que l'ajustement de contraste des boutons de capture, Story 6.1) — le badge grandit uniformément sur les trois onglets, aucune régression fonctionnelle attendue (positionnement/anneau/couleur inchangés). `npm run build` propre.
- 2026-09-03 : **Task 5 (vérification manuelle) complétée par Guillaume en conditions réelles.** Onglet Documents ouvert sur un projet existant : nom, type, taille, date d'ajout, provenance et priorité affichés correctement sur la carte. Tap sur une carte → fiche de détail lecture seule confirmée conforme au périmètre de la story (aucune action Télécharger/Supprimer, comportement attendu — FR-20/FR-21 restent Story 6.3). Badge "nouveau" jugé trop discret à l'usage → agrandi (cf. entrée précédente), confirmé satisfaisant après correctif. Aucune régression signalée sur Tâches/Notes. Statut passé à `done`.
