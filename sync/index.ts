// sync/ — moteur de synchronisation et résolution de conflit par champ (AD-3).
// Depuis la Story 3.2, ce dossier est scindé en deux fichiers à frontière de dépendance
// disjointe (cf. Dev Notes Story 3.2) :
//   - sync/client.ts — importé uniquement par un composant "use client" (app/sync-engine.tsx) ;
//     dépend de data/local/, jamais de data/remote/.
//   - sync/server.ts — importé uniquement par les route handlers serveur (app/api/sync/*) ;
//     seul fichier de tout sync/ à importer data/remote/ (AD-2, AD-6).
// Ce fichier index.ts reste volontairement vide : un barrel qui ré-exporterait les deux à la
// fois romprait la séparation client/serveur (un import de "@/sync" depuis un composant client
// entraînerait la résolution de sync/server.ts, gardé "server-only" transitivement). Importer
// explicitement "@/sync/client" ou "@/sync/server" selon le contexte d'exécution.
// Cf. ARCHITECTURE-SPINE.md — AD-1, AD-2, AD-3.

export {};
