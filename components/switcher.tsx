"use client";

// components/switcher.tsx — navigation de premier niveau (Général/Projets), UX-DR4/UX-DR17.
// Routé (Link + usePathname), pas un composant générique piloté par état : le niveau 2
// (onglets Tâches/Documents/Notes, Story 3.3) sera vraisemblablement piloté par état local
// dans une seule route, pas par des routes distinctes — extraire une base commune quand ce
// second cas d'usage réel existe, pas avant.
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./switcher.module.css";

const LOGIN_PATH = "/login";

const TABS = [
  { href: "/", label: "Général" },
  { href: "/projects", label: "Projets" },
] as const;

export function Switcher() {
  const pathname = usePathname();

  if (pathname === LOGIN_PATH) {
    return null;
  }

  return (
    <nav className={styles.track} aria-label="Navigation principale">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.item}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
