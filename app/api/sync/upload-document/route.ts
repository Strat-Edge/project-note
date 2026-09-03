import { createSupabaseServerClient } from "@/data/remote/client";
import { uploadDocumentBlob } from "@/sync/server";

// app/api/sync/upload-document/route.ts — reçoit le blob d'un document en attente
// (multipart/form-data, pas JSON : un Blob ne passe pas par JSON.stringify(), même précédent
// qu'upload-audio, Story 5.2) et le téléverse vers Supabase Storage via sync/server.ts (AD-6).
// Protégé par proxy.ts comme toute autre route /api/sync/* (cf. Dev Notes Story 3.2).

// Format exact de crypto.randomUUID() (côté client, cf. data/local/documents.ts createDocument)
// — même garde qu'upload-audio/route.ts (Story 5.2, trouvé en revue de code).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

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

  const documentId = formData.get("documentId");
  const file = formData.get("file");
  if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId) || !(file instanceof File)) {
    return new Response(null, { status: 400 });
  }

  try {
    const path = await uploadDocumentBlob(supabase, userId, documentId, file);
    return Response.json({ path });
  } catch {
    return new Response(null, { status: 500 });
  }
}
