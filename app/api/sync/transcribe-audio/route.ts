import { createSupabaseServerClient } from "@/data/remote/client";
import { transcribeNoteAudio } from "@/sync/server";

// app/api/sync/transcribe-audio/route.ts — reçoit l'audio brut d'une note vocale (corps de
// requête = Blob, Content-Type audio/*, pas de FormData/JSON : plus simple qu'upload-audio
// ici, ce module ne persiste rien lui-même — il ne fait que transcrire et retourner le
// texte) et appelle l'API OpenAI via sync/server.ts (AD-6). Stateless côté serveur : ne lit
// ni n'écrit aucune ligne "notes" — c'est l'appelant (app/, après réception du texte) qui
// persiste le résultat via updateNoteTranscription (Dexie + file de synchro, AD-1). Aucun
// segment [id] dans le chemin : rien ici n'est scopé à une note particulière côté serveur,
// contrairement à app/api/notes/[id]/audio (qui lit audio_path pour CETTE note précise).
// Protégé par proxy.ts comme toute autre route (cf. Dev Notes Story 3.2).
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return new Response(null, { status: 401 });
  }

  let blob: Blob;
  try {
    blob = await request.blob();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (blob.size === 0) {
    return new Response(null, { status: 400 });
  }

  try {
    const text = await transcribeNoteAudio(blob);
    return Response.json({ text });
  } catch (error) {
    // Erreur d'appel API externe (OpenAI) — journalisée côté serveur, cf.
    // ARCHITECTURE-SPINE.md Consistency Conventions ("logging technique serveur limité aux
    // erreurs de synchronisation et d'appels API externes").
    console.error("transcribe-audio: échec de l'appel à l'API de transcription", error);
    return new Response(null, { status: 500 });
  }
}
