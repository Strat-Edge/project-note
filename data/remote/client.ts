import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

// Garde de compilation (AD-2, AD-6) : "server-only" fait échouer le build si ce module
// est importé — même transitivement — depuis un composant qui peut finir dans le bundle client.
// Seuls les route handlers, Server Actions, et le Render Cron Job peuvent importer data/remote/.
// Précision (le mécanisme ne bloquait auparavant aucun consommateur réel — premier vrai
// consommateur : Story 1.2, login) : "server-only" empêche l'inclusion dans le bundle client,
// mais ne bloque pas un import direct par un React Server Component — ce n'est pas le même
// périmètre que "code qui ne s'exécute jamais côté client" (cf. AD-2), qui reste la responsabilité
// du développeur d'appeler ce module uniquement depuis un contexte serveur légitime.

// Client scopé à la session utilisateur (clé publiable — remplace l'ancienne clé "anon",
// dépréciée fin 2026) — soumis aux policies RLS (AD-4).
export function createSupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}

// Client à privilèges élevés (clé secrète — remplace l'ancienne "service_role", dépréciée fin 2026)
// — contourne RLS. Réservé aux opérations serveur qui l'exigent explicitement
// (ex. Render Cron pour les rappels, FR-36). À utiliser avec parcimonie.
export function createSupabaseServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
  );
}

// Client lié à la session Auth de l'utilisateur via les cookies de la requête (clé publiable) —
// à utiliser dans les Server Components, Server Actions et Route Handlers (contexte `next/headers`).
// Pas pour proxy.ts : celui-ci reçoit un NextRequest/NextResponse, pas le contexte `next/headers`,
// et construit son propre client lié aux cookies de la requête/réponse (cf. AD-9, FR-39).
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error) {
            // Cas attendu : appelé depuis un Server Component (lecture seule) — la session
            // sera rafraîchie par proxy.ts, qui a lui les moyens d'écrire les cookies.
            // On logue quand même : une erreur d'écriture pour une autre raison (cookie trop
            // volumineux, options invalides) ne doit pas disparaître silencieusement.
            console.error(
              "createSupabaseServerClient: échec d'écriture des cookies de session",
              error,
            );
          }
        },
      },
    },
  );
}
