// data/local/db.ts — instance Dexie unique, source de vérité immédiate (AD-1).
// Chaque table de contenu métier est ajoutée par la story qui en a besoin (Project en Epic 2,
// Task en Epic 3, etc.) — jamais toutes d'un coup.
import Dexie, { type EntityTable } from "dexie";
import type { Project, Task, Note, Document, SyncQueueEntry } from "@/domain";
// Import type-only : aucun cycle d'exécution malgré le fait que note-audio.ts importe `db`
// (valeur) depuis ce même fichier — les `import type` sont effacés à la compilation.
import type { NoteAudioRecord } from "./note-audio";
import type { PendingTranscriptionRecord } from "./pending-transcription";
import type { DocumentFileRecord } from "./document-file";

export class AppDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  tasks!: EntityTable<Task, "id">;
  syncQueue!: EntityTable<SyncQueueEntry, "id">;
  notes!: EntityTable<Note, "id">;
  noteAudio!: EntityTable<NoteAudioRecord, "noteId">;
  pendingTranscriptions!: EntityTable<PendingTranscriptionRecord, "noteId">;
  documents!: EntityTable<Document, "id">;
  documentFiles!: EntityTable<DocumentFileRecord, "documentId">;

  constructor() {
    super("project-note");

    // Première déclaration de schéma (aucune version n'existait avant cette story) —
    // pas une migration. Index sur status/createdAt en prévision du tri/filtre des Stories 2.2/2.3.
    this.version(1).stores({
      projects: "id, status, createdAt",
    });

    // Story 3.1 : nouvelle table Task. Dexie ne redéclare que les stores ajoutés/modifiés
    // à chaque version — `projects` est repris tel quel de la version 1, ne pas le répéter ici.
    this.version(2).stores({
      tasks: "id, projectId, status, dueDate, createdAt",
    });

    // Story 3.2 : nouvelle table syncQueue (file de synchronisation, FR-33 à FR-35). `projects`/
    // `tasks` repris tels quels des versions précédentes, ne pas les répéter ici.
    this.version(3).stores({
      syncQueue: "id, status, entity, entityId, updatedAt",
    });

    // Story 5.1 : nouvelle table Note (FR-15, note texte). Index sur projectId (lecture de
    // l'onglet Notes d'un projet, même précédent que tasks) et createdAt (tri chronologique
    // par défaut, cf. domain/note.ts sortNotes).
    this.version(4).stores({
      notes: "id, projectId, createdAt",
    });

    // Story 5.2 : nouvelle table noteAudio (FR-16, blob audio brut des notes vocales, AD-5).
    // Clé = noteId (un seul blob par note vocale). Table distincte de `notes` — jamais fusionnée
    // dans l'enregistrement Note (cf. data/local/note-audio.ts : un Blob ne doit jamais
    // transiter par le mécanisme JSON de la file de synchronisation, cf. Dev Notes). `projects`/
    // `tasks`/`syncQueue`/`notes` repris tels quels des versions précédentes, ne pas les
    // répéter ici.
    this.version(5)
      .stores({
        noteAudio: "noteId",
      })
      .upgrade(async (tx) => {
        // Renseigne `type`/`audioPath` sur les notes texte écrites avant cette story (Story
        // 5.1, sous la version 4) — IndexedDB ne force aucun schéma sur les propriétés non
        // indexées, ces enregistrements auraient sinon `type`/`audioPath` à `undefined` en
        // mémoire, violant silencieusement le contrat TypeScript Note.type: NoteType (trouvé
        // en revue de code, Story 5.2).
        await tx
          .table("notes")
          .toCollection()
          .modify((note) => {
            if (note.type === undefined) {
              note.type = "text";
            }
            if (note.audioPath === undefined) {
              note.audioPath = null;
            }
          });
      });

    // Story 5.3 (revue de code) : nouvelle table pendingTranscriptions — marqueurs locaux
    // durables des transcriptions demandées mais pas encore confirmées écrites, permettant à
    // sync/client.ts de retenter au prochain cycle si l'onglet se ferme entre la réponse
    // OpenAI et l'écriture Dexie (cf. data/local/pending-transcription.ts). `projects`/`tasks`/
    // `syncQueue`/`notes`/`noteAudio` repris tels quels des versions précédentes.
    this.version(6).stores({
      pendingTranscriptions: "noteId",
    });

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
  }
}

export const db = new AppDatabase();
