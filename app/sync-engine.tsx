"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { startSyncEngine } from "@/sync/client";

// app/sync-engine.tsx — effet de bord pur (aucun rendu), monté une fois globalement dans
// app/layout.tsx, même précédent que app/storage-init.tsx. Démarre la détection réseau et le
// traitement de la file de synchronisation (FR-33/FR-34).
// Ne s'active pas sur /login (même garde que Switcher/CaptureFlow/SyncIndicator) : avant
// authentification, /api/sync/push et /api/sync/pull sont interceptés par proxy.ts et
// redirigent vers /login plutôt que de renvoyer 401 (cf. Dev Notes Story 3.2) — sans cette
// garde, le moteur déclenche des appels réseau inutiles (et un bruit de log correspondant)
// à chaque montage et toutes les 30s tant que l'utilisateur n'est pas connecté.
const LOGIN_PATH = "/login";

export function SyncEngine() {
  const pathname = usePathname();
  const isLoginPage = pathname === LOGIN_PATH;

  // Dépendance sur le booléen, pas sur `pathname` brut (cf. Review Findings) : `app/layout.tsx`
  // englobe toutes les routes, donc ce composant reste monté sans démontage/remontage à travers
  // les navigations côté client — dépendre de `pathname` faisait redémarrer tout le moteur
  // (écouteurs + intervalle + resetStaleSyncingToPending) à chaque changement d'écran, y compris
  // pendant qu'un envoi était en cours, causant des cycles de synchronisation dupliqués.
  // Avec `[isLoginPage]`, l'effet ne se redéclenche qu'au franchissement de la frontière
  // /login ↔ reste de l'app, jamais entre deux écrans authentifiés.
  useEffect(() => {
    if (isLoginPage) {
      return;
    }
    return startSyncEngine();
  }, [isLoginPage]);

  return null;
}
