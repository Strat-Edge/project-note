"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/data/remote/client";

export type LoginState = {
  error?: string;
} | undefined;

const INVALID_CREDENTIALS_MESSAGE = "Email ou mot de passe incorrect.";

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");

  if (typeof rawEmail !== "string" || typeof password !== "string") {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  // Un copier-coller depuis un client email/gestionnaire de mots de passe ajoute parfois
  // un espace en début/fin — sans trim, des identifiants par ailleurs valides sont rejetés.
  const email = rawEmail.trim();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Toute erreur Supabase (identifiants invalides, compte inexistant, etc.) est mappée
    // vers un message unique et générique — ne jamais indiquer lequel des deux champs est en cause.
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  redirect("/");
}
