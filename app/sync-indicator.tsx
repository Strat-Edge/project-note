"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { liveQuery } from "dexie";
import { db } from "@/data/local";
import { retryNow } from "@/sync/client";
import type { SyncQueueEntry } from "@/domain";
import styles from "./sync-indicator.module.css";

// app/sync-indicator.tsx — indicateur discret et permanent de l'état de synchronisation
// (FR-35, AC#3/#4). Vit sous app/ (pas components/) car il lit data/local/ (table syncQueue)
// directement, même règle et même précédent que app/capture-flow.tsx (AD-2).
const LOGIN_PATH = "/login";

type IndicatorState = "up-to-date" | "pending" | "syncing" | "error";

const LABELS: Record<IndicatorState, string> = {
  "up-to-date": "À jour",
  pending: "En attente de synchronisation",
  syncing: "Synchronisation…",
  // Texte exact d'EXPERIENCE.md (État "Échec de synchronisation persistant").
  error: "Non synchronisé — toucher pour réessayer",
};

function deriveState(entries: readonly SyncQueueEntry[]): IndicatorState {
  // Ordre de priorité : syncing prime sur error/pending, l'utilisateur voit toujours l'état
  // le plus "actif" (cf. story Task 8).
  if (entries.some((entry) => entry.status === "syncing")) return "syncing";
  if (entries.some((entry) => entry.status === "error")) return "error";
  if (entries.some((entry) => entry.status === "pending")) return "pending";
  return "up-to-date";
}

// Référence stable partagée : useSyncExternalStore exige que getSnapshot/getServerSnapshot
// retournent la même référence tant que rien n'a changé, sinon React logue "should be cached"
// et peut re-rendre en boucle. Un `[]` littéral recréé à chaque appel violerait cette règle.
const EMPTY_ENTRIES: readonly SyncQueueEntry[] = [];

let latestEntries: readonly SyncQueueEntry[] = EMPTY_ENTRIES;

function getSnapshot(): readonly SyncQueueEntry[] {
  return latestEntries;
}

function getServerSnapshot(): readonly SyncQueueEntry[] {
  return EMPTY_ENTRIES;
}

function subscribe(onStoreChange: () => void): () => void {
  const subscription = liveQuery(() => db.syncQueue.toArray()).subscribe({
    next: (entries) => {
      latestEntries = entries;
      onStoreChange();
    },
  });
  return () => subscription.unsubscribe();
}

export function SyncIndicator() {
  const pathname = usePathname();
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (pathname === LOGIN_PATH) {
    return null;
  }

  const state = deriveState(entries);
  const label = LABELS[state];

  if (state === "error") {
    return (
      <button
        type="button"
        className={styles.indicator}
        data-state={state}
        role="status"
        aria-live="polite"
        onClick={() => {
          void retryNow();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={styles.indicator} data-state={state} role="status" aria-live="polite">
      {label}
    </span>
  );
}
