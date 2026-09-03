import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// data/remote/document-storage.ts — upload des blobs de document dans le bucket Supabase
// Storage "documents" (FR-18, AD-5, AD-8). Séparé de data/remote/storage.ts (bucket "audio",
// Story 5.2) : bucket différent, et contrairement à l'audio (toujours "recording", extension
// devinée depuis le mimeType, cf. audioExtensionFromMimeType), un document réel porte déjà un
// nom de fichier fiable (input utilisateur via sélecteur/caméra) — aucune extension à deviner.
// Garde "server-only" héritée transitivement de data/remote/client.ts (cf. data/remote/index.ts).

const DOCUMENT_BUCKET = "documents";

// Un nom de fichier vient du sélecteur natif ou de la caméra/galerie mobile (input utilisateur
// non fiable, cf. app/capture-flow.tsx) — jamais injecté tel quel dans un chemin de stockage
// Supabase (séparateurs `/`, caractères de contrôle). Remplace tout caractère hors alphanumérique/
// point/tiret/underscore par "_" ; l'extension d'origine est préservée (elle survit au filtre).
function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Un nom réduit à "." ou ".." après filtrage (ex. fichier littéralement nommé "..") reste un
  // segment de chemin ambigu une fois inséré tel quel dans `${userId}/${documentId}/${...}` —
  // neutralisé explicitement plutôt que de faire confiance au traitement de la clé par Supabase
  // Storage (trouvé en revue de code) ; le contenu réel du nom original ("." et "..") est
  // volontairement perdu ici puisqu'il ne portait de toute façon aucune information utile.
  return /^\.+$/.test(sanitized) ? `_${sanitized}` : sanitized;
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

// URL signée de courte durée (60s) pour un APERÇU inline — pas d'option `download`
// (contrairement à createDocumentSignedUrl ci-dessus) : le navigateur affiche le contenu
// (Content-Disposition par défaut, pas "attachment") au lieu de l'enregistrer. Utilisée comme
// `src` d'un <img>/<iframe> dans DocumentDetail (app/projects/[id]/project-view.tsx), jamais
// pour déclencher un téléchargement. Même bucket privé, même contrôle d'accès RLS que le
// téléchargement (AD-4/NFR-2) — seule la disposition change. Le rendu inline reste borné côté
// UI aux deux mimeType exacts "image/*"/"application/pdf" (jamais un rendu générique quel que
// soit le type) : un mimeType usurpé à la capture (risque déjà connu, non validé contre le
// contenu réel, cf. deferred-work.md "code review of story-6.1") ne peut donc jamais forcer un
// rendu HTML/script inattendu ici — et l'app reste mono-utilisateur (AD-9), sans surface
// d'exploitation inter-utilisateur possible.
export async function createDocumentPreviewUrl(
  client: SupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    throw error ?? new Error("Impossible de générer l'URL d'aperçu.");
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
