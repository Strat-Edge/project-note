import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/data/remote/client";
import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();

  // Un cookie de session corrompu peut faire lever une exception non-AuthError ici —
  // on affiche alors le formulaire plutôt que de faire planter le rendu de la page.
  let isAuthenticated = false;
  try {
    const { data } = await supabase.auth.getClaims();
    isAuthenticated = data !== null;
  } catch {
    isAuthenticated = false;
  }

  if (isAuthenticated) {
    redirect("/");
  }

  return (
    <main className={styles.main}>
      <LoginForm />
    </main>
  );
}
