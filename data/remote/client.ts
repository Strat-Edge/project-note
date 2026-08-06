import "server-only";
import { createClient } from "@supabase/supabase-js";

// Garde de compilation (AD-2, AD-6) : "server-only" fait échouer le build si ce module
// est importé — même transitivement — depuis un composant qui peut finir dans le bundle client.
// Seuls les route handlers, Server Actions, et le Render Cron Job peuvent importer data/remote/.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

// Client scopé à la session utilisateur (clé anonyme) — soumis aux policies RLS (AD-4).
export function createSupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

// Client à privilèges élevés (clé service role) — contourne RLS. Réservé aux opérations serveur
// qui l'exigent explicitement (ex. Render Cron pour les rappels, FR-36). À utiliser avec parcimonie.
export function createSupabaseServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}
