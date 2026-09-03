"use client";

import { useEffect } from "react";

// Demande un stockage persistant au navigateur au démarrage de l'app, pour réduire le risque
// d'éviction des données hors ligne (notes vocales, documents en attente de sync) — notamment sur iOS.
// Cf. ARCHITECTURE-SPINE.md AD-5. Aucune UI : composant client monté une fois depuis app/layout.tsx.
export function StorageInit() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return null;
}
