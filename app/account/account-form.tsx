"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword, logout, type UpdatePasswordState } from "./actions";
import styles from "./account-form.module.css";

const initialState: UpdatePasswordState = undefined;

export function AccountForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Vide le formulaire après une mise à jour réussie — un mot de passe ne doit jamais
    // rester affiché en clair dans les champs une fois la soumission passée.
    if (!pending && state?.success) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Mon compte</h1>

      {email && (
        <p className={styles.email}>
          Connecté en tant que <strong>{email}</strong>
        </p>
      )}

      <form ref={formRef} className={styles.form} action={formAction}>
        <h2 className={styles.sectionTitle}>Changer le mot de passe</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Nouveau mot de passe
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirmPassword">
            Confirmer le mot de passe
          </label>
          <input
            className={styles.input}
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            required
          />
        </div>

        {state?.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p className={styles.success} role="status">
            Mot de passe mis à jour.
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          Mettre à jour le mot de passe
        </button>
      </form>

      <form action={logout} className={styles.logoutForm}>
        <button className={styles.logoutButton} type="submit">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
