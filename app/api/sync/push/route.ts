import { createSupabaseServerClient } from "@/data/remote/client";
import { pushQueueEntries } from "@/sync/server";
import type { SyncQueueEntry } from "@/domain";

// app/api/sync/push/route.ts — reçoit les entrées de file en attente depuis sync/client.ts
// (fetch même origine) et les pousse vers Supabase via sync/server.ts (AD-6 : seul du code
// serveur appelle Supabase). Protégé par proxy.ts comme toute autre route (cf. Dev Notes
// Story 3.2 — une session expirée y redirige en 30x plutôt qu'un 401 propre, comportement
// accepté pour cette story ; la garde ci-dessous couvre le cas où proxy.ts serait contourné).
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  let entries: unknown;
  try {
    entries = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!Array.isArray(entries)) {
    return new Response(null, { status: 400 });
  }

  const result = await pushQueueEntries(supabase, entries as SyncQueueEntry[]);
  return Response.json(result);
}
