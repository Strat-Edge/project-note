import { createSupabaseServerClient } from "@/data/remote/client";
import { pullRemoteSnapshot } from "@/sync/server";

// app/api/sync/pull/route.ts — retourne un instantané complet projects/tasks pour le pull en
// insertion seule de sync/client.ts (cf. Dev Notes Story 3.2). Accède à cookies() via
// createSupabaseServerClient : dynamique par nature, aucune config de cache à ajouter.
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  const snapshot = await pullRemoteSnapshot(supabase);
  return Response.json(snapshot);
}
