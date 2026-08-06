// data/local/db.ts — instance Dexie unique, source de vérité immédiate (AD-1).
// Schéma vide pour l'instant : chaque table de contenu métier est ajoutée par la story qui en a besoin
// (Project en Epic 2, Task en Epic 3, etc.) — jamais toutes d'un coup.
import Dexie from "dexie";

export class AppDatabase extends Dexie {
  constructor() {
    super("project-note");
  }
}

export const db = new AppDatabase();
