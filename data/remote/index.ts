// data/remote/ — client Supabase. Dépend de domain/ (types) uniquement.
// RÈGLE NON NÉGOCIABLE (AD-2, AD-6) : ce module ne peut être importé — directement ou transitivement —
// que par du code qui ne s'exécute JAMAIS dans le bundle client (route handlers, Server Actions, Render Cron).
// Un React Server Component qui l'importerait violerait la règle au même titre qu'un composant client :
// la distinction qui compte est "peut finir dans le bundle client", pas "où le fichier vit dans app/".
// Fait respecter à la compilation par l'import "server-only" dans client.ts.
//
// RLS NON NÉGOCIABLE (AD-4) : toute migration SQL doit inclure
//   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
// AVANT toute policy. Aucune table Supabase n'est créée ou déployée sans RLS actif,
// même mono-utilisateur. Policy type : `using ( (select auth.uid()) = user_id )`.
//
// Cf. ARCHITECTURE-SPINE.md — AD-2, AD-4, AD-6.

export { createSupabaseClient, createSupabaseServiceClient } from "./client";
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
export {
  uploadDocumentFile,
  createDocumentSignedUrl,
  createDocumentPreviewUrl,
  removeDocumentFile,
} from "./document-storage";
