"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/data/remote/client";

export type UpdatePasswordState =
  | {
      error?: string;
      success?: boolean;
    }
  | undefined;

const GENERIC_ERROR_MESSAGE = "La mise à jour a échoué. Réessayez.";
const MISMATCH_MESSAGE = "Les deux mots de passe ne correspondent pas.";
const TOO_SHORT_MESSAGE = "Le mot de passe doit contenir au moins 8 caractères.";

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { error: GENERIC_ERROR_MESSAGE };
  }

  if (password.length < 8) {
    return { error: TOO_SHORT_MESSAGE };
  }

  if (password !== confirmPassword) {
    return { error: MISMATCH_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: GENERIC_ERROR_MESSAGE };
  }

  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
