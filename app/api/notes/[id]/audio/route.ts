import { createSupabaseServerClient } from "@/data/remote/client";
import { getNoteAudioPlaybackUrl } from "@/sync/server";

// app/api/notes/[id]/audio/route.ts — redirige vers une URL signée de courte durée pour la
// lecture d'une note vocale (AD-6 : seul le serveur parle à Supabase Storage). Utilisée
// directement comme `src` d'un élément <audio> (app/projects/[id]/project-view.tsx,
// NoteDetail) — un <audio> suit une redirection 302 de façon transparente, le client n'a donc
// jamais besoin de connaître l'URL signée elle-même.
export async function GET(_request: Request, ctx: RouteContext<"/api/notes/[id]/audio">) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = await getNoteAudioPlaybackUrl(supabase, id);
  if (!url) {
    return new Response(null, { status: 404 });
  }

  return Response.redirect(url, 302);
}
