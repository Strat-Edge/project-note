"use client";

// components/account-link.tsx — bouton d'accès à la gestion de compte dans le header, extrait
// en composant client (même raison que components/switcher.tsx) : usePathname n'est pas
// disponible côté serveur, et components/header.tsx reste un composant serveur pour tout le
// reste. N'a de sens que connecté — masqué sur /login comme Switcher, plutôt que de renvoyer
// vers une page qui redirigera de toute façon vers /login (proxy.ts, AD-9).
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./header.module.css";

const LOGIN_PATH = "/login";

export function AccountLink() {
  const pathname = usePathname();

  if (pathname === LOGIN_PATH) {
    return null;
  }

  return (
    <Link href="/account" className={styles.accountLink} aria-label="Mon compte">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" />
      </svg>
    </Link>
  );
}
