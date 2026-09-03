import { createSupabaseServerClient } from "@/data/remote/client";
import { uploadNoteAudioBlob } from "@/sync/server";

// app/api/sync/upload-audio/route.ts — reçoit le blob audio d'une note vocale en attente
// (multipart/form-data, pas JSON : un Blob ne passe pas par JSON.stringify(), cf. Dev Notes
// Story 5.2) et le téléverse vers Supabase Storage via sync/server.ts (AD-6). Protégé par
// proxy.ts comme toute autre route /api/sync/* (cf. Dev Notes Story 3.2).

// Format exact de crypto.randomUUID() (côté client, cf. data/local/notes.ts createVoiceNote)
// — un `noteId` qui ne respecte pas ce format est forcément un appel malformé, jamais un
// identifiant légitime généré par l'app (trouvé en revue de code, Story 5.2).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  // `sub` (identifiant utilisateur) est un champ standard des claims JWT, mais getClaims()
  // ne garantit pas son type au niveau TypeScript — vérifié explicitement plutôt que casté à
  // l'aveugle, pour ne jamais construire un chemin de stockage `undefined/...` (trouvé en
  // revue de code, Story 5.2).
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

  const noteId = formData.get("noteId");
  const file = formData.get("file");
  if (typeof noteId !== "string" || !UUID_PATTERN.test(noteId) || !(file instanceof File)) {
    return new Response(null, { status: 400 });
  }

  try {
    const path = await uploadNoteAudioBlob(supabase, userId, noteId, file);
    return Response.json({ path });
  } catch {
    return new Response(null, { status: 500 });
  }
}
