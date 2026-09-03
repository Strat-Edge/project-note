import { createSupabaseServerClient } from "@/data/remote/client";
import { getDocumentPreviewUrl } from "@/sync/server";

// app/api/documents/[id]/preview/route.ts — redirige vers une URL signée de courte durée pour
// un aperçu inline d'un document (image/PDF) dans DocumentDetail
// (app/projects/[id]/project-view.tsx). Même mécanisme que
// app/api/documents/[id]/download/route.ts, sans Content-Disposition: attachment — le
// navigateur affiche le contenu (via <img>/<iframe>) au lieu de l'enregistrer.
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[id]/preview">) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = await getDocumentPreviewUrl(supabase, id);
  if (!url) {
    return new Response(null, { status: 404 });
  }

  return Response.redirect(url, 302);
}
