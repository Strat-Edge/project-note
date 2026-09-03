"use client";

import { useActionState, useEffect, useRef } from "react";
import { login, type LoginState } from "./actions";
import styles from "./login-form.module.css";

const initialState: LoginState = undefined;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending && state?.error && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [pending, state]);

  return (
    <form className={styles.form} action={formAction}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          className={styles.input}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          disabled={pending}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Mot de passe
        </label>
        <input
          className={styles.input}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          ref={passwordRef}
          disabled={pending}
          required
        />
      </div>

      {state?.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        Se connecter
      </button>
    </form>
  );
}
