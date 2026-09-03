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

export function audioExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  // Repli pour tout type non reconnu — app/capture-flow.tsx pickAudioMimeType() vise à
  // toujours produire l'un des types ci-dessus, mais un mimeType est une valeur fournie par
  // le client (jamais garantie côté serveur) : ce cas ne doit jamais faire planter l'upload,
  // seulement retomber sur une extension par défaut (reformulé en revue de code, Story 5.2 —
  // l'ancien commentaire présentait à tort cette hypothèse comme une garantie).
  return "webm";
}

// "Déjà existant" (Storage renvoie 409/"The resource already exists") n'est pas une erreur
// réelle ici : le chemin est déterministe par note (userId + noteId), donc un second upload
// pour la même note ne peut jamais entrer en collision avec le contenu d'une AUTRE note — c'est
// forcément une retentative de sync/client.ts uploadPendingAudio() après un premier upload déjà
// réussi côté Storage mais jamais confirmé localement (ex. appareil fermé entre l'upload et
// markNoteAudioUploaded). Sans ce traitement, la retentative automatique échouerait en boucle
// indéfiniment (upsert: false) au lieu de converger — trouvé en vérification manuelle Story 5.2.
// Le message est vérifié contre le texte exact documenté par l'API Storage ("The resource
// already exists") plutôt qu'une sous-chaîne générique — resserré en revue de code, Story 5.2,
// pour ne pas risquer d'avaler silencieusement une erreur Storage sans rapport dont le message
// contiendrait accidentellement les mots "already exists".
function isAlreadyExistsError(error: { message?: string; statusCode?: string }): boolean {
  return error.statusCode === "409" || /resource already exists/i.test(error.message ?? "");
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
  if (error && !isAlreadyExistsError(error)) {
    throw error;
  }
  return path;
}

// URL signée de courte durée (60s) — juste le temps que le navigateur charge l'audio suite à
// la redirection de app/api/notes/[id]/audio/route.ts ; jamais persistée, régénérée à chaque
// lecture (le bucket reste privé, AD-4/NFR-2 — cf. Dev Notes).
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
