import "server-only";
import OpenAI from "openai";
import { requireEnv } from "@/lib/env";
import { audioExtensionFromMimeType } from "./storage";

// data/remote/transcription.ts — appel à l'API de transcription OpenAI (FR-17, AD-6). Séparé
// de data/remote/storage.ts (Supabase Storage) et data/remote/sync.ts (tables Postgres) : ce
// fichier ne parle qu'à l'API OpenAI, jamais à Supabase. Garde "server-only" (AD-2, AD-6) :
// ce module ne doit jamais atteindre le bundle client, même transitivement.

// AD-8 : gpt-transcribe remplace whisper-1, dé-priorisé par OpenAI au profit de ce nouveau
// modèle (cf. ARCHITECTURE-SPINE.md Stack). Constante plutôt que littéral inline — un seul
// point de mise à jour si le modèle change à nouveau.
const TRANSCRIPTION_MODEL = "gpt-transcribe";

// L'API valide le format audio via l'extension du nom de fichier fourni (pas seulement via
// le Content-Type) — un nom sans extension reconnue ("recording" seul) est rejeté avec
// "Invalid file format" même pour un audio parfaitement valide. Réutilise
// audioExtensionFromMimeType (data/remote/storage.ts) plutôt que d'en dupliquer une copie :
// même mapping mimeType -> extension que l'upload vers Supabase Storage, un seul point de
// mise à jour si de nouveaux formats MediaRecorder apparaissent.
export async function transcribeAudio(file: Blob): Promise<string> {
  const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const named = new File(
    [file],
    `recording.${audioExtensionFromMimeType(file.type)}`,
    { type: file.type || "audio/webm" },
  );
  const transcription = await client.audio.transcriptions.create({
    file: named,
    model: TRANSCRIPTION_MODEL,
  });
  return transcription.text;
}
