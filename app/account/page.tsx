import { createSupabaseServerClient } from "@/data/remote/client";
import { AccountForm } from "./account-form";
import styles from "./page.module.css";

// app/account/page.tsx — page de gestion du compte (retour Guillaume : "un moyen de gérer mon
// compte" depuis le header). Route protégée comme toute route non-/login par proxy.ts (AD-9),
// aucun garde d'authentification supplémentaire nécessaire ici.
export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className={styles.main}>
      <AccountForm email={data.user?.email ?? ""} />
    </main>
  );
}
