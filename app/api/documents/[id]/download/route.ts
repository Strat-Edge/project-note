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
