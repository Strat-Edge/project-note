// data/local/ — implémentation Dexie/IndexedDB, source de vérité immédiate pour toute écriture (AD-1).
// Dépend de domain/ (types) uniquement. Toute table de contenu métier est ajoutée par la story qui en a besoin,
// jamais toutes d'un coup (cf. ARCHITECTURE-SPINE.md — Deferred).

export { db, AppDatabase } from "./db";
