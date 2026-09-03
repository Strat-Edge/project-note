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
