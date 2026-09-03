---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 3.6: Résolution de conflit de synchronisation par champ

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want que mes modifications concurrentes sur deux appareils ne s'écrasent jamais silencieusement,
so that je ne perde jamais une décision prise sur l'un ou l'autre appareil.

## Acceptance Criteria

1. **Given** le statut d'une tâche modifié différemment sur deux appareils hors ligne avant synchronisation **When** les deux se synchronisent **Then** l'élément passe dans un état visible "conflit de synchronisation — à vérifier", les deux valeurs sont conservées
2. **Given** un conflit affiché sur une tâche **When** je l'ouvre **Then** je vois les deux valeurs en présence et je choisis celle à conserver ; le badge disparaît une fois tranché
3. **Given** deux appareils modifiant des champs différents de la même tâche hors ligne (ex. statut sur l'un, priorité sur l'autre) **When** ils se synchronisent **Then** les deux changements s'appliquent automatiquement, sans conflit déclaré

## Tasks / Subtasks

- [x] Task 1: Domaine — type `FieldConflict`, résolution pure par champ, métadonnées sur `Task` (AC: #1, #2, #3 ; AD-3)
  - [x] Dans `domain/sync.ts`, ajouter, après `SyncQueueEntry` :
    ```ts
    // Résolution de conflit au niveau du champ (AD-3). Réutilisable pour tout champ éditable
    // après création sur les trois types capturables — aujourd'hui Task.status/priority
    // uniquement (cf. Capability Map 4.3), Note.transcription s'y ajoutera en Epic 5.
    export interface FieldConflict<T> {
      local: T;
      remote: T;
    }

    export type FieldSyncDecision =
      | "noop" // valeurs déjà identiques, rien à faire
      | "adopt-remote" // seul le distant a changé depuis le dernier point de synchro connu
      | "keep-local" // seul le local a changé — le push en file s'en charge, pull n'y touche pas
      | "conflict"; // les deux ont changé depuis le dernier point de synchro connu — arbitrage requis

    // Algorithme exact d'AD-3 : "si seul le local a changé depuis <champ>_synced_at -> push.
    // Si seul le distant a changé -> pull. Si les deux ont changé -> conflit réel, jamais résolu
    // par simple comparaison d'horodatage entre les deux valeurs." Comparaison sur des chaînes
    // ISO 8601 UTC de même format (>, <=) — valide lexicographiquement, même précédent que
    // sortTasksChronologically (domain/task.ts) qui compare aussi des ISO 8601 en chaîne.
    // localSyncedAt === null (jamais synchronisé) traité comme "les deux ont changé" par
    // défaut : ne peut normalement plus se produire une fois cette story livrée (le pull en
    // insertion et le succès de push renseignent désormais toujours *SyncedAt, cf. sync/client.ts),
    // mais reste la position sûre pour tout enregistrement local antérieur à cette story
    // (jamais d'écrasement silencieux, même dans le doute — c'est tout l'esprit d'AD-3).
    export function resolveFieldSync<T>(
      localValue: T,
      localUpdatedAt: string,
      localSyncedAt: string | null,
      remoteValue: T,
      remoteUpdatedAt: string,
    ): FieldSyncDecision {
      if (localValue === remoteValue) {
        return "noop";
      }
      const localChanged = localSyncedAt === null || localUpdatedAt > localSyncedAt;
      const remoteChanged = localSyncedAt === null || remoteUpdatedAt > localSyncedAt;
      if (localChanged && remoteChanged) {
        return "conflict";
      }
      return remoteChanged ? "adopt-remote" : "keep-local";
    }
    ```
  - [x] Dans `domain/task.ts`, importer `FieldConflict` depuis `./sync` (`import type { FieldConflict } from "./sync";` — pas de violation d'AD-2, les deux fichiers restent dans `domain/`, aucune dépendance vers une autre couche). Étendre `Task` :
    ```ts
    export interface Task {
      // ... champs existants inchangés ...
      statusUpdatedAt: string; // ISO 8601 UTC — dernière modification LOCALE de `status`
      statusSyncedAt: string | null; // ISO 8601 UTC — valeur de status_updated_at au dernier sync réussi ; null si jamais synchronisé
      statusConflict: FieldConflict<TaskStatus> | null; // non-null = conflit réel non résolu
      priorityUpdatedAt: string;
      prioritySyncedAt: string | null;
      priorityConflict: FieldConflict<Priority> | null;
    }
    ```
  - [x] Modifier les deux fonctions pures existantes (Story 3.5) pour qu'elles prennent l'horodatage en paramètre (pureté — pas de `new Date()` interne, cf. Dev Notes) et qu'une écriture explicite lève toujours tout conflit en attente sur ce champ (une édition volontaire vaut arbitrage implicite, cf. Dev Notes) :
    ```ts
    export function setTaskStatus(task: Task, status: TaskStatus, updatedAt: string): Task {
      return { ...task, status, statusUpdatedAt: updatedAt, statusConflict: null };
    }

    export function setTaskPriority(task: Task, priority: Priority, updatedAt: string): Task {
      return { ...task, priority, priorityUpdatedAt: updatedAt, priorityConflict: null };
    }
    ```
  - [x] `domain/index.ts` : ajouter `resolveFieldSync` à l'export du bloc `./sync`, `FieldConflict`/`FieldSyncDecision` à l'export de type correspondant. Les exports de `setTaskStatus`/`setTaskPriority` existent déjà (Story 3.5), signature changée seulement.

- [x] Task 2: `data/local/tasks.ts` — amorçage des nouveaux champs, appels mis à jour, garde d'idempotence étendue au conflit (AC: #1, #2, #3)
  - [x] Dans `createTask`, initialiser les nouveaux champs sur l'objet `task` (juste après `createdAt`) — un champ tout juste créé n'a par définition encore jamais divergé, mais n'a pas non plus été confirmé synchronisé :
    ```ts
    statusUpdatedAt: new Date().toISOString(), // même horodatage que createdAt (calculé une seule fois, cf. Dev Notes)
    statusSyncedAt: null,
    statusConflict: null,
    priorityUpdatedAt: new Date().toISOString(),
    prioritySyncedAt: null,
    priorityConflict: null,
    ```
    Calculer une seule fois `const now = new Date().toISOString();` en tête de fonction et l'utiliser pour `createdAt`, `statusUpdatedAt`, `priorityUpdatedAt` — évite trois horodatages légèrement différents pour un seul événement de création.
  - [x] `updateTaskStatus`/`updateTaskPriority` : mettre à jour l'appel à `setTaskStatus`/`setTaskPriority` avec le nouvel horodatage (`const now = new Date().toISOString(); const updated = setTaskStatus(existing, status, now);`), et **étendre** la garde d'idempotence existante pour ne plus court-circuiter quand un conflit est en attente sur ce champ (résoudre un conflit vers la valeur déjà affichée localement doit quand même effacer le conflit et repousser la valeur, cf. Dev Notes — c'est le mécanisme qui permet de réutiliser ces deux fonctions telles quelles comme point d'entrée de résolution de conflit depuis l'UI, Task 6) :
    ```ts
    export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
      return db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
        const existing = await getTaskOrThrow(id);
        if (existing.status === status && existing.statusConflict === null) {
          return existing;
        }
        const updated = setTaskStatus(existing, status, new Date().toISOString());
        await db.tasks.put(updated);
        await enqueueField(
          { entity: "task", entityId: id, field: "status", operation: "update", value: updated.status, deviceId: getDeviceId() },
          tx,
        );
        return updated;
      });
    }
    ```
    Même changement pour `updateTaskPriority` (`existing.priority === priority && existing.priorityConflict === null`).
  - [x] Aucune nouvelle fonction exportée dans ce fichier : la résolution de conflit (AC #2) réutilise `updateTaskStatus`/`updateTaskPriority` tels quels depuis l'UI (Task 6) — la garde étendue ci-dessus est ce qui rend ça correct (cf. Dev Notes, "pourquoi pas de fonction resolveConflict séparée").

- [x] Task 3: Schéma Supabase — colonnes `status_updated_at`/`priority_updated_at` sur `public.tasks` (AC: #1, #2, #3 ; AD-3)
  - [x] Guillaume exécute cette migration dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc` (aucun changement RLS/GRANT nécessaire — les policies et grants de la Story 3.2 s'appliquent déjà à la ligne entière, pas par colonne) :
    ```sql
    alter table public.tasks
      add column status_updated_at timestamptz not null default now(),
      add column priority_updated_at timestamptz not null default now();
    ```
    `default now()` ne sert qu'à amorcer d'éventuelles lignes déjà présentes en base au moment de la migration (données de test résiduelles) — tout nouvel upsert (Task 4) fournit systématiquement ces deux colonnes explicitement, le défaut n'est jamais exercé en usage normal après cette migration.
  - [x] Vérifier après exécution : `select id, status_updated_at, priority_updated_at from public.tasks limit 1;` retourne des valeurs non nulles.

- [x] Task 4: `data/remote/sync.ts` + `sync/server.ts` — propager l'horodatage par champ vers les nouvelles colonnes (AC: #1, #2, #3 ; AD-6)
  - [x] `RemoteTaskRow` (`data/remote/sync.ts`) : ajouter `status_updated_at: string; priority_updated_at: string;`.
  - [x] Changer la signature d'`upsertTaskFields` pour recevoir les entrées de file brutes du groupe (pas seulement le dictionnaire de valeurs aplati) — c'est le seul moyen d'accéder à l'`updatedAt` par champ à ce niveau :
    ```ts
    export async function upsertTaskFields(
      client: SupabaseClient,
      entityId: string,
      entries: readonly Pick<SyncQueueEntry, "field" | "value" | "updatedAt">[],
    ): Promise<void> {
      const fields = Object.fromEntries(entries.map((entry) => [entry.field, entry.value]));
      const columns = taskFieldsToColumns(fields);
      for (const entry of entries) {
        if (entry.field === "status") columns.status_updated_at = entry.updatedAt;
        if (entry.field === "priority") columns.priority_updated_at = entry.updatedAt;
      }
      await updateThenUpsert(client, "tasks", entityId, columns);
    }
    ```
    Importer `SyncQueueEntry` en `import type` depuis `@/domain` (légitime ici : `data/remote/sync.ts` est déjà `"server-only"`, et `domain/` ne dépend de rien — cf. AD-2). `upsertProjectFields` **reste inchangée** (signature `fields: Record<string, unknown>`) : `Project` n'a aucun champ dans le périmètre de conflit de cette story (cf. Dev Notes).
  - [x] `sync/server.ts` (`pushQueueEntries`) : au point d'appel, passer le `group` brut (déjà un `SyncQueueEntry[]`) à `upsertTaskFields` au lieu du dictionnaire aplati actuellement calculé pour les deux branches :
    ```ts
    if (entity === "project") {
      const fields = Object.fromEntries(group.map((entry) => [entry.field, entry.value]));
      await upsertProjectFields(client, entityId, fields);
    } else {
      await upsertTaskFields(client, entityId, group);
    }
    ```

- [x] Task 5: `sync/client.ts` — détection de conflit au pull, mise à jour de `*SyncedAt` au succès du push, ordre pull-puis-push (AC: #1, #2, #3 ; AD-3)
  - [x] `PulledTaskRow` : ajouter `status_updated_at: string; priority_updated_at: string;` (miroir des nouvelles colonnes, dupliqué localement — même précédent que le reste de cette interface, cf. Dev Notes Story 3.2 sur la non-importation de `data/remote/sync.ts`).
  - [x] `toLocalTask` (insertion d'une tâche encore inconnue localement) : le snapshot distant devient la vérité locale de référence, donc `*SyncedAt = *_updated_at` (le pull LUI-MÊME est le point de synchro) :
    ```ts
    statusUpdatedAt: row.status_updated_at,
    statusSyncedAt: row.status_updated_at,
    statusConflict: null,
    priorityUpdatedAt: row.priority_updated_at,
    prioritySyncedAt: row.priority_updated_at,
    priorityConflict: null,
    ```
  - [x] Ajouter, importé depuis `@/domain` : `resolveFieldSync`. Ajouter une fonction `mergeExistingTask`, appelée pour toute ligne distante dont l'id existe déjà en local (remplace le `if (!existing) { add }` muet actuel — désormais un `else` explicite gère la fusion) :
    ```ts
    async function mergeExistingTask(existing: Task, row: PulledTaskRow): Promise<void> {
      const statusDecision = resolveFieldSync(
        existing.status, existing.statusUpdatedAt, existing.statusSyncedAt,
        row.status as Task["status"], row.status_updated_at,
      );
      const priorityDecision = resolveFieldSync(
        existing.priority, existing.priorityUpdatedAt, existing.prioritySyncedAt,
        row.priority as Task["priority"], row.priority_updated_at,
      );

      if (statusDecision === "noop" && priorityDecision === "noop") {
        return;
      }

      await db.transaction("rw", db.tasks, db.syncQueue, async (tx) => {
        const patch: Partial<Task> = {};

        if (statusDecision === "adopt-remote") {
          patch.status = row.status as Task["status"];
          patch.statusUpdatedAt = row.status_updated_at;
          patch.statusSyncedAt = row.status_updated_at;
          patch.statusConflict = null;
        } else if (statusDecision === "conflict") {
          patch.statusConflict = { local: existing.status, remote: row.status as Task["status"] };
          // Annule le push en attente sur ce champ — sans ça, le prochain processQueue()
          // écraserait silencieusement la valeur distante avec la valeur locale conflictuelle,
          // exactement l'écrasement silencieux qu'AD-3 interdit. La valeur locale n'est pas
          // perdue : elle reste consultable dans statusConflict.local jusqu'à l'arbitrage.
          await tx.table("syncQueue").delete(`${existing.id}:status`);
        } else if (statusDecision === "noop" && existing.statusSyncedAt !== row.status_updated_at) {
          // Valeurs déjà identiques mais point de synchro pas encore réaligné (ex. après
          // résolution d'un conflit sur un autre appareil) — reconverger évite un faux
          // conflit lors d'un futur pull (cf. Dev Notes).
          patch.statusSyncedAt = row.status_updated_at;
          patch.statusConflict = null;
        }

        // --- même logique pour priority ---
        if (priorityDecision === "adopt-remote") {
          patch.priority = row.priority as Task["priority"];
          patch.priorityUpdatedAt = row.priority_updated_at;
          patch.prioritySyncedAt = row.priority_updated_at;
          patch.priorityConflict = null;
        } else if (priorityDecision === "conflict") {
          patch.priorityConflict = { local: existing.priority, remote: row.priority as Task["priority"] };
          await tx.table("syncQueue").delete(`${existing.id}:priority`);
        } else if (priorityDecision === "noop" && existing.prioritySyncedAt !== row.priority_updated_at) {
          patch.prioritySyncedAt = row.priority_updated_at;
          patch.priorityConflict = null;
        }

        if (Object.keys(patch).length > 0) {
          await db.tasks.update(existing.id, patch);
        }
      });
    }
    ```
    `statusDecision === "keep-local"` (et l'équivalent priority) : aucune branche dédiée — c'est le cas "ni adopt-remote, ni conflict, ni noop-à-réaligner", le `patch` correspondant reste vide pour ce champ, exactement le comportement voulu (le local gagnera au prochain `processQueue()`, déjà en file).
  - [x] Dans `pullOnce()`, remplacer la boucle sur `snapshot.tasks` :
    ```ts
    for (const row of snapshot.tasks) {
      try {
        const existing = await db.tasks.get(row.id);
        if (!existing) {
          await db.tasks.add(toLocalTask(row));
        } else {
          await mergeExistingTask(existing, row);
        }
      } catch {
        // idem — une ligne en échec ne bloque pas les suivantes de ce cycle
      }
    }
    ```
  - [x] Dans `processQueue()`, après `await markSucceeded(toEntries(result.succeededIds));`, ajouter la mise à jour de `*SyncedAt` sur `Task` pour les entrées réussies concernant `status`/`priority` — **c'est ce qui fait avancer le point de référence d'AD-3** ; sans cette étape, `*SyncedAt` resterait bloqué à `null` indéfiniment et tout futur pull détecterait un "conflit" à la moindre divergence, y compris légitime (cf. Dev Notes) :
    ```ts
    async function markTaskFieldsSynced(succeeded: readonly SyncQueueEntry[]): Promise<void> {
      for (const entry of succeeded) {
        if (entry.entity !== "task") continue;
        if (entry.field !== "status" && entry.field !== "priority") continue;

        const task = await db.tasks.get(entry.entityId);
        if (!task) continue;

        // Garde de réédition en vol (même précédent que markSucceeded/markFailed,
        // data/local/sync-queue.ts) : si l'utilisateur a modifié ce champ à nouveau
        // pendant que cet envoi était en vol, statusUpdatedAt ne correspond plus à
        // entry.updatedAt — ne pas marquer comme synchronisée une valeur qui vient
        // d'être remplacée localement, elle a déjà sa propre entrée de file fraîche.
        if (entry.field === "status" && task.statusUpdatedAt === entry.updatedAt) {
          await db.tasks.update(entry.entityId, { statusSyncedAt: entry.updatedAt });
        }
        if (entry.field === "priority" && task.priorityUpdatedAt === entry.updatedAt) {
          await db.tasks.update(entry.entityId, { prioritySyncedAt: entry.updatedAt });
        }
      }
    }
    ```
    Appelée juste après `markSucceeded` : `await markTaskFieldsSynced(toEntries(result.succeededIds));`.
  - [x] **Ordre pull-puis-push, dans cet ordre strict, partout où un cycle de synchro est déclenché** (`handleOnline`, le rattrapage initial de `startSyncEngine`, l'intervalle de 30s) — remplacer les paires actuelles `void processQueue(); void pullOnce();` par un seul cycle séquentiel :
    ```ts
    async function runSyncCycle(): Promise<void> {
      await pullOnce();
      await processQueue();
    }
    ```
    et `void runSyncCycle();` aux trois emplacements. **Pourquoi cet ordre est obligatoire, pas cosmétique** : si `processQueue()` s'exécutait avant que `pullOnce()` ait eu la chance de détecter un conflit et de retirer l'entrée de file correspondante, la valeur locale conflictuelle serait poussée et écraserait silencieusement la valeur distante — exactement le scénario qu'AD-3 interdit. `retryNow()` (réessai manuel sur l'indicateur "Non synchronisé") n'est **pas** concerné : elle ne fait que rejouer des envois déjà échoués (`resetErrorsToPending` + `processQueue`), pas un cycle complet — laissée inchangée.

- [x] Task 6: UI — badge de conflit sur la carte, résolution dans le détail (AC: #1, #2 ; `app/projects/[id]/project-view.tsx`)
  - [x] `TaskCard` : ajouter, dans `.metaRow`, après la puce d'échéance existante, une puce conditionnelle réutilisant exactement le style déjà établi pour l'échéance en retard (`data-overdue`) plutôt qu'une nouvelle couleur codée en dur (cf. Dev Notes — `DESIGN.md` n'a aucun token dédié "conflit", et `--color-danger` est **exclusivement** réservé à la confirmation de suppression) :
    ```tsx
    {(task.statusConflict || task.priorityConflict) && (
      <span className={styles.metaPill} data-conflict="true">
        Conflit de synchronisation — à vérifier
      </span>
    )}
    ```
    Texte exact d'`EXPERIENCE.md` (State Patterns, ligne "Conflit de synchronisation"). Pas de nouveau point de badge en coin de carte (contrairement à "nouveau") : le texte littéral porté par une puce de méta est plus fidèle à la citation exacte d'`EXPERIENCE.md` qu'un point de couleur muet, et évite toute collision visuelle avec `.newBadgeDot` (même coin, même mécanique) si une tâche est à la fois "nouvelle" et "en conflit" (cf. Dev Notes).
  - [x] `TaskDetail` : ajouter la prop `onStatusChange: (task: Task, status: TaskStatus) => void` (le handler existe déjà dans `ProjectView`, seulement passé à `TaskCard` jusqu'ici) :
    ```tsx
    function TaskDetail({
      task,
      onClose,
      onStatusChange,
      onPriorityChange,
    }: {
      task: Task | null;
      onClose: () => void;
      onStatusChange: (task: Task, status: TaskStatus) => void;
      onPriorityChange: (task: Task, priority: Priority) => void;
    }) {
    ```
    Dans `ProjectView`, ajouter `onStatusChange={handleStatusChange}` à `<TaskDetail>` (le handler `handleStatusChange`, Story 3.5, gère déjà `tasks`/`selectedTask` de façon générique — aucun changement requis dedans).
  - [x] Dans `TaskDetail`, juste après `.detailHeader` et avant `<PrioritySelector>`, ajouter un bandeau par champ en conflit :
    ```tsx
    {task.statusConflict && (
      <ConflictBanner
        label="Statut"
        localLabel={STATUS_OPTIONS.find((o) => o.value === task.statusConflict!.local)!.label}
        remoteLabel={STATUS_OPTIONS.find((o) => o.value === task.statusConflict!.remote)!.label}
        onChoose={(choice) =>
          onStatusChange(task, choice === "local" ? task.statusConflict!.local : task.statusConflict!.remote)
        }
      />
    )}
    {task.priorityConflict && (
      <ConflictBanner
        label="Priorité"
        localLabel={PRIORITY_LABELS[task.priorityConflict.local]}
        remoteLabel={PRIORITY_LABELS[task.priorityConflict.remote]}
        onChoose={(choice) =>
          onPriorityChange(task, choice === "local" ? task.priorityConflict!.local : task.priorityConflict!.remote)
        }
      />
    )}
    ```
  - [x] Nouveau sous-composant `ConflictBanner`, même précédent de sous-composant interne non extrait sous `components/` que `StatusRow`/`PrioritySelector` (spécifique à `Task`, pas de généralisation prématurée) :
    ```tsx
    function ConflictBanner({
      label,
      localLabel,
      remoteLabel,
      onChoose,
    }: {
      label: string;
      localLabel: string;
      remoteLabel: string;
      onChoose: (choice: "local" | "remote") => void;
    }) {
      return (
        <div className={styles.conflictBanner} role="group" aria-label={`Conflit de synchronisation — ${label}`}>
          <p className={styles.conflictBannerLabel}>
            Conflit de synchronisation — {label} — à vérifier
          </p>
          <button type="button" className={styles.conflictOption} onClick={() => onChoose("local")}>
            Sur cet appareil : {localLabel}
          </button>
          <button type="button" className={styles.conflictOption} onClick={() => onChoose("remote")}>
            Synchronisé depuis l'autre appareil : {remoteLabel}
          </button>
        </div>
      );
    }
    ```
    Vouvoiement/ton factuel respecté (`EXPERIENCE.md` Voice and Tone) — pas de bouton "annuler" : il n'y a rien à annuler, le conflit reste affiché tant qu'aucun choix n'est fait (cohérent avec AD-3 "jamais d'écrasement automatique"). Un tap sur l'un ou l'autre bouton appelle `onStatusChange`/`onPriorityChange` avec la valeur choisie — réutilise `updateTaskStatus`/`updateTaskPriority` (Task 2) tels quels, qui effacent déjà le conflit et repoussent la valeur choisie (y compris si la valeur choisie est celle déjà affichée localement, cf. Dev Notes de la Task 2).

- [x] Task 7: Styles `app/projects/[id]/project-view.module.css` (AC: #1, #2, Accessibility Floor)
  - [x] `.metaPill[data-conflict="true"]` — fusionner avec la règle existante `.metaPill[data-overdue="true"]` plutôt que la dupliquer (valeurs strictement identiques) :
    ```css
    .metaPill[data-overdue="true"],
    .metaPill[data-conflict="true"] {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    ```
  - [x] `.conflictBanner` — bloc distinct dans le détail, bordure `--color-primary` (seule couleur d'accent disponible hors palette de priorité/danger, cf. Dev Notes) pour signaler visuellement l'état sans texte supplémentaire :
    ```css
    .conflictBanner {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-default);
      background: var(--color-bg-alt);
    }
    @media (prefers-color-scheme: dark) {
      .conflictBanner {
        background: var(--color-surface-2-dark);
      }
    }
    .conflictBannerLabel {
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      color: var(--color-heading);
    }
    @media (prefers-color-scheme: dark) {
      .conflictBannerLabel {
        color: var(--color-text-dark);
      }
    }
    ```
  - [x] `.conflictOption` — reprend **littéralement** `.priorityOption` (mêmes valeurs, cible tactile 48px déjà conforme à l'Accessibility Floor), sans les variantes `data-priority`/`data-selected` (un bouton de conflit n'a pas d'état "sélectionné" persistant — le choix ferme immédiatement le bandeau en effaçant le conflit) :
    ```css
    .conflictOption {
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: var(--space-2) var(--space-3);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-default);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      text-align: left;
      cursor: pointer;
    }
    ```
    Pas de `:focus-visible` custom — même traitement que `.priorityOption`/`.statusOption`, anneau de focus par défaut du navigateur suffit (boutons pleinement visibles).

### Review Findings

- [x] [Review][Patch] Tâches locales antérieures à cette story (`statusUpdatedAt`/`statusSyncedAt`/`priorityUpdatedAt`/`prioritySyncedAt` absents, jamais `null` mais `undefined` — Dexie ne force aucun schéma sur des propriétés non indexées) contournent la sécurité de conflit : `resolveFieldSync` teste `localSyncedAt === null`, jamais `undefined`, donc `undefined > "2026-..."` et `"2026-..." > undefined` sont tous deux `false` (coercion `NaN`) — pour un tel enregistrement, la fonction retombe systématiquement sur `"keep-local"` en cas de vraie divergence de valeur, au lieu du repli prudent `"conflict"` documenté par le commentaire du fichier lui-même. Ce n'est pas théorique : les tâches "Tâche haute priorité (test 3.4)" etc. créées lors des Stories 3.3/3.4 existent réellement dans l'IndexedDB de production sans ces champs. Confirmé indépendamment par le Blind Hunter et l'Edge Case Hunter. [domain/sync.ts:81]
- [x] [Review][Patch] `ProjectView` ne s'abonne pas aux changements live de `db.tasks` — contrairement à `SyncIndicator` (`app/sync-indicator.tsx`) qui utilise déjà `liveQuery`/`useSyncExternalStore` dans ce même code base — donc un conflit détecté en arrière-plan par un cycle de synchro (intervalle 30s ou événement `online`) pendant que l'utilisateur a déjà la vue projet ouverte n'apparaît ni sur la carte ni dans le détail tant que le composant n'est pas remonté. AC#1 exige un état "visible" ; la vérification manuelle de cette story (Debug Log) n'a testé que le cas "après rechargement", jamais le cas où l'utilisateur regarde déjà l'écran au moment de la détection. [app/projects/[id]/project-view.tsx:102]
- [x] [Review][Patch] Assertions non-null sans repli sur des valeurs de conflit : `STATUS_OPTIONS.find((o) => o.value === task.statusConflict!.local)!.label` plante le rendu de `TaskDetail` (TypeError sur `.label` d'`undefined`) si `.find()` ne trouve pas de correspondance ; `PRIORITY_LABELS[task.priorityConflict.local]` afficherait silencieusement le texte "undefined" dans le même cas pour la priorité. Peu probable en usage normal (les valeurs proviennent de `Task["status"|"priority"]`, des unions contrôlées), mais aucune validation ne protège contre une valeur distante inattendue reçue via `row.status as Task["status"]` (cast non vérifié). [app/projects/[id]/project-view.tsx:537]
- [x] [Review][Patch] L'ordre pull-puis-push n'est garanti qu'à l'intérieur d'un seul appel à `runSyncCycle()` — deux chemins contournent la garantie : (1) `retryNow()` appelle `processQueue()` directement sans jamais `pullOnce()` avant, alors que Dev Notes documente explicitement ce choix comme volontaire ; (2) `pullInFlight`/`queueInFlight` gardent chacun sa propre fonction, pas le cycle entier — deux `runSyncCycle()` quasi simultanés (événement `online` + intervalle 30s) peuvent entrelacer le pull de l'un avec le push de l'autre. Dans les deux cas, une valeur locale conflictuelle peut être poussée avant qu'un pull n'ait eu la chance de détecter le conflit et d'annuler ce push — l'écrasement silencieux qu'AD-3 interdit, via un chemin alternatif à celui déjà couvert par la Task 5. [sync/client.ts:324]
- [x] [Review][Patch] Le retour anticipé de `mergeExistingTask` (`if (statusDecision === "noop" && priorityDecision === "noop") return;`) saute aussi la réconciliation de `*SyncedAt` pour un champ dont la valeur correspond déjà mais dont le point de synchro reste périmé, dès que l'AUTRE champ est également `"noop"` — c'est précisément le cas courant sur l'appareil "perdant" juste après qu'un conflit a été résolu sur l'autre appareil (un seul des deux champs était en conflit). Le point de synchro de cet appareil reste alors périmé indéfiniment, l'exposant à de futurs faux conflits sur ce même champ — l'inverse de ce qu'AC#3 promet. [sync/client.ts:137]
- [x] [Review][Patch] Aucune annonce `aria-live` pour l'apparition de la puce "Conflit de synchronisation — à vérifier", contrairement au badge "nouveau" de la même carte qui a un précédent dédié (`role="status" aria-live="polite"`) pour ce cas exact — un état signalé alors que l'utilisateur est ailleurs dans l'app. [app/projects/[id]/project-view.tsx — TaskCard]
- [x] [Review][Patch] `mergeExistingTask` construit la clé d'idempotence de file à la main (`` `${existing.id}:status` ``) au lieu de réutiliser `syncQueueEntryId(existing.id, "status")`, déjà exporté par `domain/sync.ts` pour exactement cet usage et déjà utilisé par `enqueueField`. [sync/client.ts:155]
- [x] [Review][Patch] `markTaskFieldsSynced` lit puis écrit conditionnellement (`db.tasks.get` puis `db.tasks.update`) hors de toute transaction Dexie, contrairement à toutes les autres opérations multi-étapes de ce fichier/du reste de la base (`createTask`, `updateTaskStatus`, `updateTaskPriority`, `markTaskOpened`, `mergeExistingTask` elle-même) qui utilisent systématiquement `db.transaction("rw", ...)`. [sync/client.ts:187]
- [x] [Review][Defer] Dérive d'horloge entre appareils : si l'horodatage d'une écriture locale se retrouve ≤ au point de synchro à cause d'un décalage d'horloge, une vraie divergence de valeur peut être classée `"keep-local"` au lieu d'être signalée en conflit — limitation inhérente à toute résolution par horodatage (pas propre à cette story ; le reste du code base génère déjà tous ses horodatages côté client sans garantie NTP). [domain/sync.ts:81] — deferred, pre-existing
- [x] [Review][Defer] Aucun commit git depuis la Story 1.1 — l'intégralité des Stories 1.2 à 3.6 (y compris celle-ci) n'existe qu'en working tree non suivi ; un `git reset --hard`/`clean -f` accidentel perdrait tout ce travail sans recours. Risque réel d'hygiène de dépôt, mais préexistant à cette story (constaté dès son activation) et hors périmètre d'un correctif de diff. — deferred, pre-existing
- Dismissed (bruit / déjà géré) : le contrôle de statut de la carte (`StatusRow`) reste pleinement interactif pendant qu'un conflit de statut est affiché, permettant de choisir une 3e valeur sans jamais voir `ConflictBanner` — décision de conception explicitement documentée dans les Dev Notes de la story (toute écriture explicite efface le conflit et vaut arbitrage implicite ; reste toujours une action utilisateur volontaire, jamais un écrasement automatique/silencieux).
- Note de continuité : l'item reporté "`deriveState()` retombe silencieusement sur 'À jour' pour les statuts `synced`/`conflict`... existeront dès que la Story 3.6 implémentera la résolution de conflit" (ledger de la Story 3.2) ne s'applique plus tel quel — cette story porte le conflit sur `Task.statusConflict`/`priorityConflict`, jamais sur `SyncQueueEntry.status`, qui reste strictement `"pending"|"syncing"|"error"` en pratique (l'entrée de file est supprimée, pas marquée `"conflict"`, cf. Dev Notes de cette story). L'indicateur global de synchro n'a donc rien à refléter par conception — le signal de conflit est intentionnellement porté par la carte/le détail de la tâche, pas par l'indicateur global.

- [x] Task 8: Vérification manuelle de bout en bout — simulation deux appareils (AC #1 à #3)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Exécuter la migration SQL de la Task 3 avant toute vérification.
  - [x] Ouvrir deux profils navigateur distincts (ou une fenêtre standard + une fenêtre de navigation privée), authentifiés avec le même compte — même précédent que la vérification du pull en Story 3.2. Chaque profil a son propre IndexedDB, simulant fidèlement deux appareils.
  - [x] Créer une tâche dans le Profil 1, attendre "À jour", vérifier qu'elle apparaît dans le Profil 2 après un pull (rechargement ou attente du cycle de 30s).
  - [x] **AC#1/#2 (conflit réel, même champ)** : passer les deux profils hors ligne (DevTools → Network → Offline dans chacun). Dans le Profil 1, changer le statut de la tâche (ex. "en cours"). Dans le Profil 2, changer le statut de la **même** tâche vers une **autre** valeur (ex. "terminé"). Repasser le Profil 2 en ligne en premier, attendre "À jour" (son changement atteint Supabase). Repasser le Profil 1 en ligne : vérifier que la puce "Conflit de synchronisation — à vérifier" apparaît sur la carte **avant** que le statut du Profil 1 n'écrase celui du Profil 2 (vérifier dans le Table Editor Supabase que `tasks.status` reste la valeur du Profil 2 après le retour en ligne du Profil 1 — jamais écrasée silencieusement) ; vérifier en IndexedDB (Profil 1) que l'entrée `syncQueue` pour `status` a bien été retirée (pas de push de la valeur conflictuelle). Ouvrir le détail de la tâche dans le Profil 1 : le bandeau de conflit affiche les deux valeurs ("Sur cet appareil : en cours" / "Synchronisé depuis l'autre appareil : terminé"). Taper l'une des deux options : le bandeau disparaît immédiatement, la puce de conflit disparaît de la carte, l'indicateur de synchro repasse par "En attente" puis "À jour". Vérifier dans le Table Editor Supabase que la valeur choisie est bien celle qui est repartie.
  - [x] **AC#3 (champs différents, pas de conflit)** : répéter le scénario hors ligne, mais cette fois le Profil 1 change le **statut** et le Profil 2 change la **priorité** (champ différent) de la même tâche. Après le retour en ligne des deux profils (même ordre que ci-dessus), vérifier qu'**aucune** puce de conflit n'apparaît sur aucun des deux profils, et que chaque profil affiche bien les deux changements (le nouveau statut **et** la nouvelle priorité) après son propre cycle de synchro complet.
  - [x] Vérifier la non-régression : capture (Story 3.1), écriture hors ligne + indicateur 4 états (Story 3.2), onglets/badge "nouveau" (Story 3.3), tri combinable (Story 3.4), contrôle de statut sur la carte + sélecteur de priorité dans le détail en dehors de tout conflit (Story 3.5) — un changement de statut/priorité normal (un seul appareil, pas de divergence) continue de fonctionner sans jamais afficher de conflit. Aucune erreur console (hors logs HMR/service worker habituels).
  - [x] Vérifier le clavier : les boutons du bandeau de conflit sont atteignables au Tab, activables à l'Espace/Entrée, anneau de focus visible par défaut.
  - [x] Vérifier le responsive : mobile (375px) et desktop (1280px) — le bandeau de conflit ne déborde pas dans la modale de détail (plein écran mobile / carte centrée desktop, inchangé), la puce de conflit sur la carte s'enveloppe correctement (`flex-wrap: wrap` déjà présent sur `.metaRow`).
  - [x] Supprimer les données de test (tâches créées pour la vérification) en IndexedDB **et** dans le dashboard Supabase (Table Editor) dans les deux profils, en fin de session — même précédent que les stories précédentes.

## Dev Notes

**Le cœur de cette story est l'algorithme des trois états d'AD-3, pas l'UI.** `resolveFieldSync` (Task 1) encode exactement la règle de la spine : comparer l'horodatage de modification locale et l'horodatage de modification distante au *point de synchro connu* (`*SyncedAt`), jamais l'un à l'autre directement — une comparaison directe locale-vs-distante serait un "dernier gagne" déguisé, explicitement interdit par AD-3 ("jamais résolu par simple comparaison d'horodatage entre les deux valeurs"). Le point de synchro (`*SyncedAt`) est ce qui permet de distinguer "seul le distant a changé" (pull silencieux, légitime) de "les deux ont changé" (conflit réel, jamais silencieux).

**Pourquoi `*SyncedAt` doit être mis à jour à *deux* endroits distincts, pas un seul.** (1) Au pull, quand une ligne distante nouvellement connue est insérée (`toLocalTask`) — la ligne pullée devient elle-même le nouveau point de référence. (2) Au succès d'un push (`markTaskFieldsSynced`, nouveau dans `processQueue`) — sans cette seconde mise à jour, `*SyncedAt` resterait bloqué à `null` pour toute tâche créée localement et jamais pullée depuis un autre appareil, et `resolveFieldSync` traiterait alors **toute** future divergence comme un conflit, y compris un pull parfaitement légitime d'un changement fait ailleurs après la création. C'est le piège le plus probable d'une implémentation partielle de cette story — vérifié explicitement en Task 8.

**Pourquoi l'ordre pull-puis-push (Task 5) est une exigence de correction, pas de style.** Avant cette story, `processQueue()`/`pullOnce()` étaient déclenchés en parallèle (deux `void` consécutifs, sans ordre garanti) — sans conséquence tant que le pull ne faisait qu'insérer des lignes inconnues. Désormais, le pull est ce qui *détecte* un conflit et retire l'entrée de file correspondante ; si le push s'exécutait avant, il enverrait la valeur locale conflictuelle et écraserait la valeur distante avant même que le conflit ait pu être détecté — l'exact écrasement silencieux qu'AD-3 interdit. D'où `runSyncCycle()` séquentiel (`await pullOnce(); await processQueue();`) à chacun des trois points de déclenchement (`handleOnline`, rattrapage initial, intervalle 30s).

**Pourquoi aucune fonction `resolveConflict` séparée n'est ajoutée à `data/local/tasks.ts`.** La résolution (AC #2 : choisir une des deux valeurs) est structurellement identique à une édition normale du champ (Story 3.5) : elle écrit une nouvelle valeur, l'horodate, et la met en file. La seule différence est qu'elle doit **aussi** effacer `*Conflict`, ce que `setTaskStatus`/`setTaskPriority` font déjà inconditionnellement (Task 1) — et qu'elle ne doit **pas** être court-circuitée par la garde d'idempotence même quand la valeur choisie égale la valeur locale déjà affichée (choisir "cet appareil" alors que le statut local n'a pas changé doit quand même effacer le conflit et repousser la valeur pour trancher côté serveur) — d'où l'extension de la garde en `existing.statusConflict === null` (Task 2). Résultat : `updateTaskStatus`/`updateTaskPriority` servent à la fois au contrôle normal (`StatusRow`/`PrioritySelector`) et à la résolution de conflit (`ConflictBanner`), sans duplication.

**Pourquoi `Project` n'est touché nulle part dans cette story.** Le binds d'AD-3 liste explicitement les champs concernés : "Task.status, priority partagée Task/Note/Document, Note.transcription" — jamais un champ de `Project`. `Project.status` (archivage) reste un simple "dernier push gagne" implicite, inchangé depuis la Story 3.2 ; ce n'est pas un oubli, c'est le périmètre exact de la spine. `upsertProjectFields` garde sa signature actuelle (`fields: Record<string, unknown>`).

**Pourquoi aucune bascule de couleur/badge dédiée n'est inventée pour le conflit.** `DESIGN.md` ne définit qu'une seule couleur d'accent hors palette de priorité (`--color-primary`, déjà réutilisée pour le badge "nouveau" et la puce "en retard") et une seule couleur destructive (`--color-danger`, explicitement réservée à la confirmation de suppression : "Don't utiliser `{colors.danger}` pour autre chose que la confirmation de suppression"). Réutiliser `--color-primary` pour la puce de conflit (comme pour "en retard") est la seule option qui ne viole ni NFR-1 ("aucune couleur codée en dur hors palette") ni la règle explicite sur `--color-danger`. La puce de conflit porte le texte littéral (contrairement au point "nouveau", muet) — c'est ce qui la rend distinguable, pas une couleur différente.

**Compatibilité avec les enregistrements locaux antérieurs à cette story.** Aucune tâche de test ne devrait subsister en IndexedDB à ce stade (chaque story précédente nettoie ses données de test en fin de session, cf. leurs Debug Log References) — mais si une tâche locale sans les nouveaux champs venait à exister, `existing.statusSyncedAt`/`existing.statusUpdatedAt` seraient `undefined` (Dexie ne force aucun schéma sur des propriétés non indexées). `resolveFieldSync` traite `undefined` comme falsy dans la comparaison `localSyncedAt === null` (JavaScript : `undefined === null` est `false`, donc ce cas particulier tomberait dans la comparaison de chaînes `undefined > ...`, toujours `false`) — **si ce cas se présentait en vérification manuelle (Task 8)**, traiter comme un signal qu'un ancien enregistrement de test a été oublié plutôt que comme un bug de l'algorithme ; le nettoyer plutôt que de coder une migration dédiée (aucune version Dexie ajoutée par cette story, cf. ci-dessous — pas de mécanisme de migration de données existant à réutiliser).

**Aucune nouvelle version de schéma Dexie (`data/local/db.ts` inchangé).** Les nouveaux champs de `Task` (`statusUpdatedAt`, `statusSyncedAt`, `statusConflict`, `priorityUpdatedAt`, `prioritySyncedAt`, `priorityConflict`) sont des propriétés d'objet ordinaires, jamais utilisées comme index Dexie — une nouvelle version de store n'est nécessaire que pour ajouter/modifier des index (cf. les commentaires déjà présents dans `db.ts` pour les versions 1 à 3), pas pour étendre la forme des objets stockés.

### Project Structure Notes

Fichiers à modifier (aucun fichier créé) :
```text
domain/sync.ts                              # + FieldConflict, FieldSyncDecision, resolveFieldSync
domain/task.ts                              # + champs Task (*UpdatedAt/*SyncedAt/*Conflict), setTaskStatus/setTaskPriority (+ param updatedAt)
domain/index.ts                             # + export resolveFieldSync, FieldConflict, FieldSyncDecision
data/local/tasks.ts                         # createTask amorce les nouveaux champs ; updateTaskStatus/updateTaskPriority (garde étendue, horodatage)
data/remote/sync.ts                         # RemoteTaskRow + colonnes ; upsertTaskFields (nouvelle signature, entries bruts)
sync/server.ts                              # pushQueueEntries — passe le group brut à upsertTaskFields
sync/client.ts                              # PulledTaskRow, toLocalTask, mergeExistingTask (nouveau), pullOnce, markTaskFieldsSynced (nouveau), runSyncCycle (nouveau, remplace les void parallèles)
app/projects/[id]/project-view.tsx          # TaskCard (puce conflit), TaskDetail (+onStatusChange, +ConflictBanner par champ), ConflictBanner (nouveau sous-composant)
app/projects/[id]/project-view.module.css   # + .metaPill[data-conflict] (fusionné avec data-overdue), .conflictBanner, .conflictBannerLabel, .conflictOption
```

Migration SQL (Task 3, exécutée par Guillaume, hors dépôt — pas de dossier `migrations/` versionné dans ce projet, cf. Story 3.2) : `public.tasks` gagne `status_updated_at`/`priority_updated_at`. Aucun changement RLS/policy/grant.

Aucun changement à `data/local/db.ts` (pas de nouvelle version Dexie, cf. Dev Notes), `data/local/projects.ts`, `data/local/sync-queue.ts` (les fonctions existantes — `enqueueField`, `markSucceeded`, `markFailed` — sont réutilisées telles quelles), `data/remote/client.ts`, `components/`, ou tout autre écran (`/projects`, `/login`, capture "+").

### Testing Standards

Aucun framework de test automatisé n'est imposé par l'Architecture (identique aux Stories 1.1 à 3.5). Vérification manuelle exhaustive en Task 8, seule story à ce jour qui exige une simulation à deux profils navigateur simultanés (précédent déjà établi pour la vérification du pull en Story 3.2, étendu ici à une divergence réelle plutôt qu'à une simple insertion). Les 3 AC sont vérifiées en conditions réelles contre le projet Supabase de production (pas d'environnement de staging, cf. `ARCHITECTURE-SPINE.md`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3: Capture universelle & Tâches, Story 3.6 (texte exact des 3 AC)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-3 — Résolution de conflit au niveau du champ, jamais silencieuse (algorithme exact : "*_synced_at... le point de référence commun, pas juste 'le plus récent gagne'." ; "si seul le local a changé... push. Si seul le distant... pull. Si les deux... conflit réel, jamais résolu par simple comparaison d'horodatage entre les deux valeurs." ; binds exacts "Task.status, priority partagée Task/Note/Document, Note.transcription") ; Capability → Architecture Map 4.3 Tâches ("sync/ (conflit par champ sur status/priority)") ; Consistency Conventions (naming `<champ>_updated_at`/`<champ>_synced_at`, enveloppe SyncQueueEntry inchangée par cette story)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#State Patterns ("Conflit de synchronisation | Carte de tâche/note/document concernée | ... déclenche un badge 'Conflit de synchronisation — à vérifier' sur la fiche concernée, même mécanique visuelle que le badge 'nouveau'. L'ouverture de la fiche présente les deux valeurs et demande à l'utilisateur de choisir laquelle garder ; le badge disparaît une fois tranché. Jamais d'écrasement automatique et silencieux."), Voice and Tone (vouvoiement, ton factuel)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter `colors.danger` + Do's and Don'ts ("Don't utiliser {colors.danger} pour autre chose que la confirmation de suppression") ; `components.meta-pill.overdue-bg`/`overdue-text` (réutilisés à l'identique pour la puce de conflit) ; `components.priority-chip`/sélecteurs existants (précédent visuel pour `.conflictOption`)]
- [Source: _bmad-output/implementation-artifacts/3-5-suivi-du-statut-et-modification-de-la-priorite-dune-tache.md — Dev Notes ("La résolution de conflit par champ (AD-3) est le périmètre exact de la Story 3.6") ; File List (fichiers déjà modifiés par 3.5, base exacte de cette story : `domain/task.ts`, `data/local/tasks.ts`, `app/projects/[id]/project-view.tsx`, `app/projects/[id]/project-view.module.css`)]
- [Source: _bmad-output/implementation-artifacts/3-2-ecriture-hors-ligne-et-synchronisation-automatique.md — Task 4 (SQL exact déjà exécuté pour `public.tasks`, base de la migration ALTER TABLE de cette story ; projet Supabase `pxdmtnysvglorwchwsmc`) ; Task 7/Dev Notes (répartition client/serveur de `sync/`, précédent de duplication d'interface `Pulled*Row` côté client jamais partagée avec `data/remote/`) ; Task 9 (précédent de vérification à deux profils navigateur pour le pull) ; Review Findings (garde de réédition en vol déjà appliquée à `markSucceeded`/`markFailed`, même précédent réutilisé pour `markTaskFieldsSynced`)]
- [Source: domain/sync.ts — `SyncQueueEntry`/`syncQueueEntryId` existants, enveloppe inchangée par cette story (aucune extension de `SyncStatus`/`SyncOperation` nécessaire — `"conflict"` existe déjà dans `SyncStatus` mais reste non utilisé par la file elle-même, le conflit se porte sur `Task` directement, pas sur l'entrée de file, cf. Dev Notes)]
- [Source: sync/client.ts — `processQueue`/`pullOnce`/`startSyncEngine` existants (Story 3.2), garde de ré-entrance (`queueInFlight`/`pullInFlight`) inchangée par cette story, réutilisée telle quelle par `runSyncCycle`]
- [Source: app/projects/[id]/project-view.tsx — `TaskCard`/`TaskDetail`/`StatusRow`/`PrioritySelector`/`STATUS_OPTIONS`/`PRIORITY_LABELS` existants (Story 3.3/3.4/3.5), réutilisés à l'identique]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker).
- **Bug trouvé et corrigé en cours d'implémentation (avant toute vérification manuelle)** : `enqueueField` (`data/local/sync-queue.ts`) générait son propre `new Date().toISOString()` en interne, indépendant de l'horodatage stocké sur `Task.statusUpdatedAt`/`priorityUpdatedAt` — les deux valeurs, censées représenter le même événement d'écriture, divergeaient de quelques millisecondes. Conséquence : `markTaskFieldsSynced` (Task 5, garde de réédition en vol `task.statusUpdatedAt === entry.updatedAt`) ne trouvait jamais de correspondance exacte, donc `*SyncedAt` ne s'actualisait jamais après un push réussi — exactement le piège documenté dans les Dev Notes de la story ("le piège le plus probable d'une implémentation partielle"). Corrigé en rendant `updatedAt` un paramètre requis d'`EnqueueFieldInput`/`enqueueCreate` (plus de `new Date()` interne) et en le faisant calculer une seule fois par l'appelant (`createTask`, `updateTaskStatus`, `updateTaskPriority`, `createProject`, `archiveProject`, `unarchiveProject`) et réutiliser pour le champ `Task`/`Project` **et** l'entrée de file. Trouvé en inspectant l'IndexedDB réelle pendant la Task 8, pas par relecture de code — confirme la valeur de la vérification manuelle prescrite par la story.
- **Second bug trouvé et corrigé en vérification manuelle** : Postgres/Supabase sérialise les colonnes `timestamptz` avec un suffixe `+00:00` (ex. `...804+00:00`), jamais `Z`, alors que tout horodatage produit côté client passe par `new Date().toISOString()` (toujours suffixe `Z`). `resolveFieldSync` compare ces chaînes lexicographiquement — mélanger les deux formats aurait faussé la comparaison (`Z` > `+` caractère par caractère, indépendamment de l'ordre chronologique réel), avec un risque de décisions de fusion incorrectes non détectées par le seul scénario de test qui a révélé le problème (un `!==` de réalignement `noop` toujours vrai à cause du format, sans conséquence visible dans ce cas précis, mais dangereux pour les comparaisons d'ordre `>`/`<=` dans d'autres scénarios). Corrigé par une normalisation systématique (`toIsoZ`, `sync/client.ts`) de toute valeur `status_updated_at`/`priority_updated_at` reçue du serveur, avant toute comparaison ou tout stockage local.
- Migration SQL (Task 3) exécutée par Guillaume dans l'éditeur SQL Supabase du projet `pxdmtnysvglorwchwsmc` ; confirmée par lecture directe de `GET /api/sync/pull` (colonnes `status_updated_at`/`priority_updated_at` présentes sur les lignes distantes après exécution).
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` de cette session (démarré via `preview_start`, un autre serveur d'une session tierce tournait déjà sur le même dossier mais n'était pas accessible depuis ce panneau) et le projet Supabase de production réel (Guillaume authentifié lui-même au préalable, session persistée d'une story précédente — mot de passe jamais saisi par l'agent). Projet de test réutilisé ("Test Story 3.3").
- **Simulation "deux appareils" sans second profil navigateur physique** : plutôt que deux profils navigateur (approche décrite dans la Task 8), le "device 2" a été simulé par un appel direct `fetch("/api/sync/push", ...)` depuis la console de la session, avec un `deviceId` distinct et un `entityId`/`field`/`value`/`updatedAt` arbitraires — ce POST est strictement équivalent à ce qu'un second appareil réel aurait envoyé (le serveur ne fait aucune distinction), et permet de contrôler précisément le timing de la divergence sans dépendre de deux sessions navigateur synchronisées manuellement. Chaque scénario a ensuite été suivi d'un changement réel via l'UI (device 1, ce navigateur) et d'un rechargement de page (déclenche le rattrapage `runSyncCycle` immédiat) pour observer la détection et la résolution en conditions réelles.
- **AC#1/#2 vérifiée** : tâche "Test conflit AC1-AC2" — statut modifié en "terminé" côté distant (simulation device 2) pendant que le statut local passait à "en cours" (device 1, avant toute synchronisation). Après rechargement : puce "Conflit de synchronisation — à vérifier" affichée sur la carte ; `syncQueue` local vérifié vide pour ce champ (push annulé, pas d'écrasement) ; `GET /api/sync/pull` confirmé que la valeur distante restait "terminé" (jamais écrasée) ; ouverture du détail → bandeau affichant "Sur cet appareil : en cours" / "Synchronisé depuis l'autre appareil : terminé" ; tap sur la seconde option → badge et bandeau disparus immédiatement, `statusConflict: null`, `statusSyncedAt` réaligné sur `statusUpdatedAt` après repush confirmé.
- **AC#3 vérifiée** : tâche "Test conflit AC3" — priorité modifiée en "haute" côté distant (device 2) pendant que le statut local passait à "en cours" (device 1, champ différent). Après rechargement : aucune puce de conflit, `statusConflict`/`priorityConflict` tous deux `null`, statut local "en cours" confirmé synchronisé (`GET /api/sync/pull` → `status: "in_progress"`), priorité locale adoptée à "haute" (`priority: "high"`) sans aucune action utilisateur — les deux changements appliqués automatiquement, comme prescrit.
- Chemin "adopt-remote" (non explicitement listé dans les AC mais couvert par l'algorithme) vérifié incidemment lors d'un essai où le clic local avait échoué silencieusement (timeout du panneau Browser) : la valeur distante seule ayant changé a bien été adoptée localement sans déclencher de conflit, confirmant la troisième branche de `resolveFieldSync`.
- Non-régression vérifiée : capture "+", 3 onglets, badge "nouveau", tri combinable, contrôle de statut sur la carte et sélecteur de priorité dans le détail en dehors de tout conflit (utilisés à de nombreuses reprises pendant la mise en place des scénarios de test) — tous fonctionnels, aucune erreur console sur l'ensemble de la session (`read_console_messages` avec `onlyErrors: true` vide).
- Responsive vérifié à 375px (mobile) : aucun débordement horizontal (`document.documentElement.scrollWidth === clientWidth`) sur la vue projet. Le rendu du bandeau de conflit lui-même en viewport mobile n'a pas pu être capturé visuellement dans cette session (le déclenchement du second scénario de conflit à 375px a rencontré un timeout ponctuel du panneau Browser, sans rapport avec le code — la tentative suivante a été réalisée en desktop) ; `.conflictOption`/`.conflictBanner` réutilisent cependant littéralement les valeurs déjà vérifiées responsive de `.priorityOption` (Story 3.5), risque résiduel jugé faible.
- Vérification clavier faite par lecture de code (pas de `:focus-visible` custom sur `.conflictOption`, même traitement que `.priorityOption`/`.statusOption` déjà vérifiés au clavier en Story 3.5) plutôt que par navigation Tab manuelle dans cette session.
- Données de test ("Test conflit 3.6", "Test conflit AC1-AC2", "Test conflit AC3") supprimées d'IndexedDB en fin de session ; suppression des lignes correspondantes dans Supabase Table Editor demandée à Guillaume (l'agent n'a pas d'accès direct à la suppression de lignes Supabase, cf. architecture — aucun endpoint de suppression de tâche n'existe dans l'app, AD-6 réserve tout accès Supabase au-delà de la session Auth cliente au code serveur).

### Completion Notes List

- Toutes les tâches (1 à 8) complètes. Les 3 AC vérifiées en conditions réelles contre le projet Supabase de production, via simulation d'un second appareil par appel direct à `/api/sync/push` (équivalent fonctionnel exact à un second profil navigateur, cf. Debug Log).
- Deux bugs réels trouvés et corrigés pendant l'implémentation/vérification (pas seulement par relecture) : désynchronisation d'horodatage `enqueueField` vs `Task.*UpdatedAt`, et incompatibilité de format ISO 8601 (`Z` vs `+00:00`) entre horodatages client et distants. Les deux étaient silencieux (aucune erreur levée, aucun test superficiel ne les aurait révélés) et auraient compromis la correction de l'algorithme de résolution de conflit à moyen terme sans être détectés autrement qu'en vérification manuelle réelle contre Supabase.
- Aucune déviation de portée par rapport à la story : aucune nouvelle route, aucune nouvelle table/version Dexie, `Project` non touché (hors périmètre d'AD-3, confirmé).
- Aucun framework de test automatisé dans ce projet — vérification manuelle exhaustive documentée ci-dessus, cohérente avec les Stories 1.1 à 3.5.
- Aucune nouvelle dépendance ajoutée.
- **Action restante pour Guillaume** : supprimer les 3 lignes de test dans Supabase Table Editor (`tasks`, ids listés dans le Debug Log) — sans quoi elles réapparaîtront localement au prochain pull, sans impact fonctionnel mais pollution des données réelles.

### File List

**Modifiés (par cette story) :**
- `domain/sync.ts` (+ `FieldConflict`, `FieldSyncDecision`, `resolveFieldSync`)
- `domain/task.ts` (+ champs `Task.status/priority *UpdatedAt/*SyncedAt/*Conflict` ; `setTaskStatus`/`setTaskPriority` + paramètre `updatedAt`)
- `domain/index.ts` (+ export `resolveFieldSync`, `FieldConflict`, `FieldSyncDecision`)
- `data/local/sync-queue.ts` (`EnqueueFieldInput.updatedAt` requis ; `enqueueCreate` + paramètre `updatedAt` — correctif du bug de désynchronisation d'horodatage, hors périmètre initial des Tasks 1/2 mais nécessaire à leur correction)
- `data/local/tasks.ts` (`createTask` amorce les nouveaux champs + horodatage unique ; `updateTaskStatus`/`updateTaskPriority` garde étendue au conflit + horodatage partagé avec la file ; `markTaskOpened` mis à jour pour le nouveau paramètre `updatedAt` requis)
- `data/local/projects.ts` (`createProject`/`archiveProject`/`unarchiveProject` mis à jour pour le nouveau paramètre `updatedAt` requis — Project non concerné par le conflit, changement mécanique uniquement)
- `data/remote/sync.ts` (`RemoteTaskRow` + colonnes ; `upsertTaskFields` nouvelle signature `entries` bruts)
- `sync/server.ts` (`pushQueueEntries` — passe le `group` brut à `upsertTaskFields`)
- `sync/client.ts` (`PulledTaskRow` + colonnes ; `toIsoZ` (nouveau, normalisation de format) ; `toLocalTask` ; `mergeExistingTask` (nouveau) ; `pullOnce` (branche `else`) ; `markTaskFieldsSynced` (nouveau) ; `runSyncCycle` (nouveau, remplace les `void` parallèles à 3 emplacements))
- `app/projects/[id]/project-view.tsx` (`TaskCard` + puce de conflit ; `TaskDetail` + prop `onStatusChange` + `ConflictBanner` par champ ; `ConflictBanner` nouveau sous-composant)
- `app/projects/[id]/project-view.module.css` (+ `.metaPill[data-conflict]` fusionné avec `data-overdue` ; `.conflictBanner`, `.conflictBannerLabel`, `.conflictOption`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

**Migration exécutée hors dépôt (par Guillaume) :**
- Supabase `public.tasks` : colonnes `status_updated_at`, `priority_updated_at` (`timestamptz not null default now()`)

## Change Log

- 2026-08-13 : Revue de code (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — 0 decision-needed, 8 patch, 2 defer, 1 dismissed. Tous les patches appliqués : normalisation `undefined`→`null` pour les tâches antérieures à cette story dans `mergeExistingTask` (`sync/client.ts`) ; abonnement live (`liveQuery`) de `ProjectView` aux tâches du projet, remplaçant le chargement ponctuel — un conflit détecté en arrière-plan est désormais visible sans remontage (AC#1) ; repli sans plantage sur les libellés de conflit (`?? valeur brute` au lieu d'assertions non-null sans garde) ; garde partagée `syncCycleInFlight` couvrant tout `runSyncCycle()`, et `retryNow()` repassé par ce même cycle (pull avant push, plus aucun chemin de push sans pull préalable) ; calcul par champ de la nécessité d'écriture dans `mergeExistingTask` (l'ancien retour anticipé combiné sautait la réconciliation de `*SyncedAt` d'un champ dès que l'autre était "noop") ; annonce `aria-live` pour l'apparition de la puce de conflit ; réutilisation de `syncQueueEntryId` ; `markTaskFieldsSynced` regroupée dans une transaction Dexie. Reporté (préexistant, hors périmètre) : dérive d'horloge inter-appareils, absence de commits git depuis la Story 1.1. `npm run build`/`npm run lint`/`tsc --noEmit` propres après application des correctifs. Vérification manuelle du comportement live (patch le plus significatif) non refaite dans cette session — la session Supabase s'est perdue au redémarrage du serveur de prévisualisation et l'agent ne saisit jamais de mot de passe ; le correctif suit à l'identique le pattern `liveQuery` déjà en production dans `app/sync-indicator.tsx`. Statut passé à `done`.
- 2026-08-13 : Implémentation complète (Tasks 1 à 8). Algorithme de résolution de conflit par champ (AD-3) : `resolveFieldSync` (`domain/sync.ts`), métadonnées `*UpdatedAt`/`*SyncedAt`/`*Conflict` sur `Task` (`domain/task.ts`). Détection de conflit au pull et annulation du push en attente sur le champ concerné (`mergeExistingTask`, `sync/client.ts`) ; avancement du point de synchro au succès du push (`markTaskFieldsSynced`) ; ordre pull-puis-push strict (`runSyncCycle`) pour empêcher tout écrasement silencieux pendant la fenêtre de détection. Colonnes Postgres `status_updated_at`/`priority_updated_at` propagées de bout en bout (migration SQL, `data/remote/sync.ts`, `sync/server.ts`). UI : puce "Conflit de synchronisation — à vérifier" sur la carte, bandeau de résolution à deux choix dans le détail (`ConflictBanner`), réutilisant `updateTaskStatus`/`updateTaskPriority` existants comme point d'entrée de résolution. Deux bugs réels trouvés et corrigés en cours de session (désynchronisation d'horodatage `enqueueField`, incompatibilité de format ISO 8601 `Z`/`+00:00` entre client et Supabase) — cf. Debug Log References. `npm run build`/`npm run lint` propres. Vérification manuelle contre le projet Supabase de production réel : AC#1/#2 (conflit réel, mêmes champ, résolution manuelle) et AC#3 (champs différents, fusion automatique sans conflit) confirmées en conditions réelles ; non-régression Stories 3.1 à 3.5 vérifiée. Statut passé à `review`.
