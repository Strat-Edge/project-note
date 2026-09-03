---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 3.4: Tri combinable dans la vue projet

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want trier mes tâches par ordre chronologique et/ou par priorité,
so that je choisisse comment scanner ma liste selon le moment.

## Acceptance Criteria

1. **Given** l'onglet Tâches d'un projet **When** j'ouvre l'écran **Then** le filtre "Chronologique" est coché par défaut, "Prioritaire" décoché.
2. **Given** je coche uniquement "Chronologique" **When** la liste s'affiche **Then** l'ordre suit la date de capture.
3. **Given** je coche uniquement "Prioritaire" **When** la liste s'affiche **Then** l'ordre suit le niveau de priorité.
4. **Given** je coche les deux filtres **When** la liste s'affiche **Then** le tri se fait par priorité en premier critère, puis par ordre chronologique au sein de chaque niveau.
5. **Given** je décoche les deux filtres **When** la liste s'affiche **Then** elle retombe automatiquement sur l'ordre chronologique.

## Tasks / Subtasks

- [x] Task 1: Tri combinable pur dans `domain/task.ts` (AC: #1, #2, #3, #4, #5)
  - [x] Ajouter `export interface SortFilters { chronological: boolean; priority: boolean; }` juste après les types existants (`TaskStatus`/`Provenance`).
  - [x] Ajouter une constante privée `const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };` — Haute en tête (0), Basse en dernier (2) : une case "Prioritaire" cochée fait remonter les tâches les plus urgentes en premier, cohérent avec `{colors.priority-haute}` = `{colors.primary}` (DESIGN.md, la couleur la plus "active" de l'app réservée à Haute). Aucune AC ne fixe explicitement ce sens (Haute→Basse vs Basse→Haute) — c'est l'interprétation retenue, à documenter dans Dev Notes, pas à re-questionner en implémentation.
  - [x] Ajouter `export function sortTasks(tasks: readonly Task[], filters: SortFilters): Task[] { if (!filters.priority) { return sortTasksChronologically(tasks); } return [...tasks].sort((a, b) => { const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt); }); }` — **ne pas dupliquer la logique de `sortTasksChronologically`** (Story 3.3, déjà exportée) : cette fonction l'appelle directement pour les deux cas où `priority` est décochée (AC #2 et #5, "Chronologique seule" et "aucune case cochée" produisent le même résultat par construction — une seule branche `if` couvre les deux ACs). Quand `priority` est cochée, le tri utilise `b.createdAt.localeCompare(a.createdAt)` comme repli au sein d'un même niveau **dans tous les cas** (AC #3 "Prioritaire seule" ET AC #4 "les deux cochées") : le paramètre `chronological` n'a donc **aucun effet observable** tant que `priority` est cochée — c'est intentionnel (AC #3 ne spécifie pas d'ordre au sein d'un même niveau de priorité ; utiliser systématiquement le repli chronologique est le comportement le plus simple et le plus prévisible, identique que "Chronologique" soit cochée ou non en même temps que "Prioritaire" — ne pas ajouter de branchement supplémentaire pour distinguer ces deux sous-cas, aucune AC ne le teste ni ne le demande).
  - [x] Mettre à jour `domain/index.ts` : ajouter `sortTasks` à l'export de `./task` (garder `sortTasksChronologically` tel quel, toujours exportée et utilisée en interne par `sortTasks`), et ajouter `export type { SortFilters } from "./task";` à côté du `export type { Task, TaskStatus, Provenance }` existant.

- [x] Task 2: Cases à cocher combinables dans `app/projects/[id]/project-view.tsx` (AC: #1, #2, #3, #4, #5)
  - [x] Importer `sortTasks` (remplace l'import de `sortTasksChronologically`, plus utilisée directement dans ce fichier) et le type `SortFilters` depuis `@/domain`.
  - [x] Ajouter l'état `const [sortFilters, setSortFilters] = useState<SortFilters>({ chronological: true, priority: false });` dans `ProjectView`, à côté des états existants (`activeTab`, `selectedTask`) — état local au composant, **aucune persistance** (Dexie/localStorage) requise : ni les ACs ni `epics.md`/`EXPERIENCE.md` ne demandent que le tri survive à une navigation ou un rechargement, chaque ouverture de l'onglet Tâches doit repartir sur l'état par défaut de l'AC #1 (`chronological: true, priority: false`), ce qu'un simple `useState` garantit déjà (remonté à chaque montage de `ProjectView`, pas de logique supplémentaire à écrire).
  - [x] Dans le bloc `activeTab === "tasks"` (actuellement `tasksLoadError ? (...) : tasks.length === 0 ? (...) : (<ul>...)`), restructurer pour insérer les filtres **avant** la liste/l'état vide, mais **pas** avant le message d'erreur (cohérent avec le principe déjà appliqué à cet écran : un état d'erreur remplace tout le contenu de l'onglet, rien d'autre ne s'affiche à côté) :
    ```tsx
    {activeTab === "tasks" &&
      (tasksLoadError ? (
        <p className={styles.error} role="alert">{TASKS_LOAD_ERROR_MESSAGE}</p>
      ) : (
        <>
          <SortFilterControls filters={sortFilters} onChange={setSortFilters} />
          {tasks.length === 0 ? (
            <p className={styles.empty}>{EMPTY_TASKS_MESSAGE}</p>
          ) : (
            <ul className={styles.taskList}>
              {sortTasks(tasks, sortFilters).map((task) => (
                <TaskCard key={task.id} task={task} onOpen={handleOpenTask} />
              ))}
            </ul>
          )}
        </>
      ))}
    ```
    Les filtres restent visibles même liste vide (AC #1 ne conditionne pas leur présence à l'existence de tâches — cohérent avec le mockup `key-project-view.html` où `.filters` est un bloc structurel toujours affiché sous les onglets, indépendant du contenu de `.list`).
  - [x] **Ne pas** afficher les filtres pour `activeTab === "documents"`/`"notes"` — ces onglets restent au texte "Bientôt disponible." (Story 3.3, inchangé). Les 5 ACs de cette story ne mentionnent que "l'onglet Tâches" explicitement ; `epics.md` FR-23 dit "Chaque onglet" au niveau exigence générale, mais aucune entité Note/Document n'existe encore comme liste triable (Epic 5/6) — même raisonnement que Story 3.3 pour ne pas construire de composant prématuré pour du contenu qui n'existe pas.
  - [x] Ajouter le sous-composant interne `SortFilterControls` (même précédent que `TabSelector`/`TaskCard`/`TaskDetail` de la Story 3.3 — pas de fichier sous `components/`) :
    ```tsx
    function SortFilterControls({
      filters,
      onChange,
    }: {
      filters: SortFilters;
      onChange: (filters: SortFilters) => void;
    }) {
      return (
        <div className={styles.filters} role="group" aria-label="Trier les tâches">
          <label className={styles.filter}>
            <input
              type="checkbox"
              className={styles.checkboxInput}
              checked={filters.chronological}
              onChange={(event) =>
                onChange({ ...filters, chronological: event.target.checked })
              }
            />
            <span className={styles.checkboxBox} aria-hidden="true" />
            Chronologique
          </label>
          <label className={styles.filter}>
            <input
              type="checkbox"
              className={styles.checkboxInput}
              checked={filters.priority}
              onChange={(event) =>
                onChange({ ...filters, priority: event.target.checked })
              }
            />
            <span className={styles.checkboxBox} aria-hidden="true" />
            Prioritaire
          </label>
        </div>
      );
    }
    ```
    Utilise un vrai `<input type="checkbox">` (visuellement masqué via `.checkboxInput`, réutilisant le pattern `.visuallyHidden` déjà établi pour le badge "nouveau" — cf. Task 3) plutôt qu'un `role="checkbox"` custom sur un `<button>`/`<div>` : ceci donne gratuitement le focus clavier natif (Tab), l'activation clavier native (Espace), l'état coché/décoché annoncé nativement par tout lecteur d'écran, et l'association label↔contrôle par simple imbrication (`<label><input/>…</label>`, aucun `htmlFor`/`id` à gérer) — aucune de ces mécaniques n'est du code à écrire ou à maintenir. Cohérent avec le précédent déjà établi en Story 3.3 pour `TaskCard` ("cartes = éléments `<button>` HTML natifs sans gestionnaire clavier personnalisé").
  - [x] Chaque case cochée/décochée met à jour l'état immédiatement via `onChange` (React re-render synchrone) — satisfait "état visuel immédiat, pas de délai" (`EXPERIENCE.md` Component Patterns, "Case à cocher").

- [x] Task 3: Styles `app/projects/[id]/project-view.module.css` (AC: #1 à #5, Accessibility Floor)
  - [x] `.filters` — conteneur des deux cases, `display: flex; gap: var(--space-3); flex-wrap: wrap;` (reprend `DESIGN.md.components.checkbox` + layout de `mockups/key-project-view.html` `.filters`, sans le padding vertical du mockup — cet écran a déjà `gap: var(--space-5)` entre sections via `.main`, ne pas dupliquer un espacement vertical en plus).
  - [x] `.filter` — le `<label>` cliquable : `display: flex; align-items: center; gap: 7px; min-height: 44px; font-size: var(--font-label-size); font-weight: var(--font-label-weight); letter-spacing: var(--font-label-letter-spacing); color: var(--color-muted); cursor: pointer;` avec variante sombre `color: var(--color-muted-dark)` (même motif `@media (prefers-color-scheme: dark)` que `.tab`/`.statusPill` dans ce même fichier). `min-height: 44px` garantit la cible tactile ≥44px (`EXPERIENCE.md` Accessibility Floor, "cibles tactiles ≥44px... y compris les cases de filtre") — c'est le `<label>` entier (texte inclus) qui doit atteindre cette hauteur, pas seulement la case visuelle de 13px.
  - [x] `.checkboxInput` — réutiliser **exactement** les mêmes propriétés que `.visuallyHidden` déjà défini dans ce fichier (`position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;`) plutôt que de dupliquer une nouvelle classe équivalente — même valeurs, nom différent car cette classe s'applique à un `<input>` natif (sémantique différente de `.visuallyHidden` appliqué à un `<span>` de statut).
  - [x] `.checkboxBox` — le carré visuel (`DESIGN.md.components.checkbox`) : `width: 13px; height: 13px; border: 1.5px solid var(--color-muted); border-radius: 4px; position: relative; flex-shrink: 0; background: var(--color-bg);` avec `border-color: var(--color-muted-dark)` en sombre. **`4px` est une valeur littérale** (pas dans l'échelle `--radius-*` du projet, qui commence à `--radius-sm: 6px`) — cohérent avec la spec `DESIGN.md.components.checkbox.radius: '4px'`, ne pas arrondir à `--radius-sm`.
  - [x] `.checkboxInput:checked + .checkboxBox` — `border-color: var(--color-primary); background: var(--color-primary);`.
  - [x] `.checkboxInput:checked + .checkboxBox::after` — la coche blanche : `content: ""; position: absolute; left: 3px; top: 0.5px; width: 4px; height: 7px; border: solid var(--color-on-primary); border-width: 0 1.6px 1.6px 0; transform: rotate(45deg);` (valeurs reprises littéralement de `mockups/key-project-view.html` `.chk.on::after`, `{colors.checkmark}` = blanc = `--color-on-primary` déjà utilisé ailleurs dans ce fichier pour le texte sur fond primaire, ex. `.tab[data-active="true"]`).
  - [x] `.checkboxInput:focus-visible + .checkboxBox` — `outline: 2px solid var(--color-primary); outline-offset: 2px;` — indicateur de focus clavier visible en permanence (`EXPERIENCE.md` Accessibility Floor), absent du mockup statique mais requis par cet écran interactif ; aucun autre contrôle de cet écran n'a encore eu besoin d'un focus-visible custom (boutons/onglets s'appuient sur le style de focus par défaut du navigateur), première fois qu'un input est visuellement masqué au profit d'un élément décoratif — sans cette règle, le focus deviendrait invisible.

- [x] Task 4: Vérification manuelle de bout en bout (AC #1 à #5)
  - [x] `npm run build` et `npm run lint` propres.
  - [x] Réutiliser (ou recréer si supprimées) un projet de test avec 3-4 tâches de priorités différentes (Haute/Normale/Basse) et de dates de capture différentes — au moins deux tâches de même priorité mais de dates différentes, pour vérifier concrètement le repli chronologique au sein d'un niveau (AC #4).
  - [x] AC #1 : ouvrir l'onglet Tâches d'un projet → "Chronologique" coché, "Prioritaire" décoché, visuellement (case pleine bleue + coche) et via l'arbre d'accessibilité (`checked: true`/`checked: false`).
  - [x] AC #2 : décocher "Prioritaire" si coché, ne garder que "Chronologique" coché → l'ordre correspond à `createdAt` décroissant (le plus récent en tête, comportement déjà vérifié en Story 3.3, inchangé).
  - [x] AC #3 : décocher "Chronologique", cocher seulement "Prioritaire" → les tâches Haute apparaissent avant Normale avant Basse.
  - [x] AC #4 : cocher les deux → même ordre par priorité qu'AC #3, et à l'intérieur d'un même niveau de priorité (au moins deux tâches Haute par exemple), la plus récente d'abord.
  - [x] AC #5 : décocher les deux → l'ordre retombe sur le même résultat qu'AC #2 (repli chronologique).
  - [x] Vérifier l'absence de délai perceptible entre le clic sur une case et le nouvel ordre affiché (mise à jour React synchrone attendue, pas de requête réseau/Dexie impliquée dans le tri).
  - [x] Vérifier au clavier : Tab atteint chaque case dans l'ordre visuel, Espace bascule l'état, l'anneau de focus (`outline`) est visible sur la case actuellement focus.
  - [x] Vérifier la non-régression : les 4 AC de la Story 3.3 (3 onglets, badge "nouveau", provenance, priorité toujours visible, modale de détail) continuent de fonctionner à l'identique ; onglets Documents/Notes toujours "Bientôt disponible." sans cases de filtre. Aucune erreur console.
  - [x] Vérifier le responsive : mobile (375px) et desktop (1280px) — les deux cases restent lisibles et tactiles sur mobile (`flex-wrap: wrap` évite tout débordement horizontal si les libellés s'élargissent avec une police système plus grande).

### Review Findings

- [x] [Review][Patch] `sortFilters` non réinitialisé au changement de projet, contrairement à `activeTab`/`selectedTask` dans le même bloc [app/projects/[id]/project-view.tsx:87]
- [x] [Review][Patch] `.checkboxInput` duplique `.visuallyHidden` propriété par propriété — `composes: visuallyHidden;` éliminerait la duplication [app/projects/[id]/project-view.module.css:129]
- [x] [Review][Patch] `margin-bottom` ajouté sur `.filters` sans documenter la dérogation à la consigne littérale de la Task 3 (qui ne listait que `display`/`gap`/`flex-wrap`) [app/projects/[id]/project-view.module.css:104-108]

## Dev Notes

**Cette story est volontairement petite : aucune nouvelle route, aucun nouveau fichier, aucune modification de `data/local/`, `data/remote/`, ou `sync/`.** C'est un ajout d'état local (React `useState`) et d'une fonction de tri pure (`domain/task.ts`) sur un écran déjà entièrement construit par la Story 3.3 (`app/projects/[id]/project-view.tsx`). Ne pas chercher à toucher `data/local/tasks.ts`, `data/remote/`, ou le schéma Dexie — le tri est un concern d'affichage pur sur des données déjà chargées en mémoire (`tasks` state), pas une nouvelle requête ni un nouveau champ métier.

**`sortTasksChronologically` (Story 3.3) n'est pas remplacée, elle est réutilisée en interne par la nouvelle `sortTasks`.** La Story 3.3 l'avait explicitement anticipé : *"Story 3.4 introduira le tri combinable Chronologique/Prioritaire"* (commentaire déjà présent dans `domain/task.ts`). Ne pas dupliquer sa logique de comparaison (`b.createdAt.localeCompare(a.createdAt)`) dans `sortTasks` — l'appeler directement pour le cas où `priority` est décochée.

**Aucune persistance du choix de tri.** Ni les 5 ACs, ni `epics.md`, ni `EXPERIENCE.md` (table "Filtres de tri") ne mentionnent que l'état des cases doit survivre à une navigation ou un rechargement de page — chaque ouverture de l'onglet Tâches d'un projet repart sur l'état par défaut de l'AC #1. Un simple `useState({ chronological: true, priority: false })` local à `ProjectView` suffit ; ne pas introduire de champ Dexie, de `localStorage`, ni de query param pour ce choix.

**Sens du tri "Prioritaire" (Haute en premier) — décision assumée, non explicitement fixée par une AC.** Les 5 ACs décrivent le comportement combiné du tri mais aucune ne précise si "l'ordre suit le niveau de priorité" signifie Haute→Basse ou Basse→Haute. Le sens retenu (Haute en tête) suit la lecture naturelle de la fonctionnalité — surfacer ce qui est le plus urgent à traiter en premier — et s'aligne avec `DESIGN.md` (`{colors.priority-haute}` = `{colors.primary}`, la couleur la plus "active" de l'app). Si Guillaume attendait l'inverse en vérification manuelle (Task 4), c'est un point à trancher avec lui avant de considérer la story terminée — pas une simple préférence d'implémentation à ajuster silencieusement, car cela change le comportement observable de 3 des 5 ACs (#3, #4).

**Le paramètre `chronological` de `SortFilters` n'a pas d'effet observable indépendant tant que `priority` est cochée (AC #3 et #4 produisent le même repli chronologique dans les deux cas) — ce n'est pas un bug, c'est la lecture la plus directe des ACs.** Aucune AC ne demande un ordre différent au sein d'un même niveau de priorité selon que "Chronologique" est cochée ou non en plus de "Prioritaire" — ne pas ajouter de branche supplémentaire dans `sortTasks` pour distinguer ces deux sous-cas tant qu'aucune AC ne l'exige (cf. `sortTasks` en Task 1 : un seul `if (!filters.priority)` suffit à couvrir les 5 ACs).

**Checkbox custom via `<input type="checkbox">` masqué + `<span>` décoratif, pas un `role="checkbox"` sur un élément non natif.** Premier contrôle de formulaire "coché/décoché" de l'app (les sélecteurs radio existants — couleur de projet, étapes de capture — utilisent `aria-pressed` sur des boutons indépendants, pas une vraie sémantique checkbox). Utiliser l'élément natif `<input type="checkbox">` évite d'avoir à gérer manuellement le focus clavier, l'activation Espace, et l'annonce lecteur d'écran de l'état coché — tout ceci est un comportement du navigateur, pas du code à écrire. Le pattern (input masqué + `span` visuel stylé via le sélecteur adjacent `:checked +`) est strictement CSS, aucune bibliothèque supplémentaire.

**Dérogation trouvée et documentée en revue de code — `.filters` porte un `margin-bottom: var(--space-3)` que la consigne littérale de la Task 3 ne prévoyait pas (`display`/`gap`/`flex-wrap` uniquement, avec l'instruction explicite de ne pas dupliquer d'espacement vertical puisque `.main` en fournit déjà un via son `gap`) :** cette prémisse est incorrecte pour ce niveau d'imbrication précis — `.filters` et la liste de tâches vivent tous deux à l'intérieur du fragment de `.tabPanel`, un niveau **sous** les enfants directs de `.main` auxquels s'applique son `gap: var(--space-5)` (`.header`/`.tablist`/`.tabPanel`/`TaskDetail`) ; combiné au reset `* { margin: 0; }` d'`app/globals.css`, l'absence de `margin-bottom` collerait visuellement les filtres et la liste. Le `margin-bottom` a donc été conservé (implémentation correcte, vérifiée en navigateur) — cette note documente la dérogation à la consigne écrite, conformément à la convention du projet établie en Story 3.3 (`data/remote/sync.ts`).

**Pourquoi ne pas afficher les filtres sur les onglets Documents/Notes malgré `epics.md` FR-23 ("Chaque onglet propose deux filtres...") :** les 5 ACs de cette story (contrairement à FR-23 au niveau exigence générale) ne testent le comportement que sur "l'onglet Tâches d'un projet" — Documents et Notes n'ont encore aucune entité listable (Epic 5/6 les introduiront), afficher des filtres qui ne trient rien serait un contrôle mort. Même précédent que la Story 3.3 pour ces deux onglets ("Bientôt disponible.", aucun composant construit en avance pour du contenu qui n'existe pas).

### Project Structure Notes

Fichiers à modifier (aucun fichier créé) :
```text
domain/task.ts                              # + SortFilters, PRIORITY_ORDER (privée), sortTasks
domain/index.ts                             # + export sortTasks, export type SortFilters
app/projects/[id]/project-view.tsx          # + état sortFilters, + SortFilterControls, usage de sortTasks au lieu de sortTasksChronologically
app/projects/[id]/project-view.module.css   # + .filters, .filter, .checkboxInput, .checkboxBox (+ variantes :checked/:focus-visible/sombre)
```

Aucun changement à `data/local/`, `data/remote/`, `sync/`, `components/`, `app/projects/[id]/page.tsx`, ou tout autre écran (`/projects`, `/login`, capture "+") — cette story ajoute uniquement un tri d'affichage sur une liste déjà chargée par la Story 3.3.

### Testing Standards

Aucun framework de test automatisé n'est imposé par l'Architecture (identique aux Stories 1.1 à 3.3). Vérification manuelle exhaustive en Task 4 : les 5 AC testées individuellement en navigateur avec des données couvrant les 3 niveaux de priorité et des dates de capture distinctes (nécessaire pour observer le repli chronologique au sein d'un même niveau, AC #4). Navigation clavier (Tab + Espace, anneau de focus) et responsive vérifiés selon les mêmes standards que les contrôles interactifs précédents.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3: Capture universelle & Tâches, Story 3.4 (texte exact des 5 AC, FR-23 couvert)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md — FR-23 ("Chaque onglet propose deux filtres cochables et combinables — Chronologique et Prioritaire (Chronologique par défaut) ; les deux ensemble trient par priorité puis chronologie")]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, 4.6 Vue projet — FR-22 à FR-26 ("`components/` onglets/filtres/badges, `domain/` tri combinable et statut nouveau")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Component Patterns ("Filtres de tri | Vue projet, chaque onglet | Deux cases Chronologique/Prioritaire, cochables indépendamment et combinables. Chronologique coché par défaut. Aucune case cochée → retombe sur Chronologique." ; "Case à cocher | Filtres de tri | Tap pour cocher/décocher, état visuel immédiat, pas de délai."), Accessibility Floor ("cibles tactiles ≥44px... y compris les cases de filtre")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter `components.checkbox` (size 13px, radius 4px, border muted/muted-dark, checked-bg primary, checkmark blanc), section Components ("Case à cocher — 13px, rayon 4px, bordure muted au repos, fond primary avec coche blanche à l'état coché. Utilisée pour les filtres de tri, combinable librement.")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-project-view.html — lignes 171-207 (`.filters`/`.filter`/`.chk`/`.chk.on::after`, layout et valeurs CSS exactes reprises pour `.filters`/`.filter`/`.checkboxBox` de cette story), lignes 342-345 (markup `<div class="filter on">` — confirme la position des filtres entre les onglets et la liste de tâches)]
- [Source: _bmad-output/implementation-artifacts/3-3-vue-projet-onglets-et-indicateurs.md — Dev Notes ("Story 3.4 remplacera/étendra par le tri combinable Chronologique/Prioritaire ; cette story n'affiche aucune case à cocher de filtre, un seul ordre fixe" — confirme explicitement le point de départ de cette story), décision de duplication des tokens CSS par fichier plutôt que composant partagé (suivie ici pour `.filters`/`.checkboxBox`), sous-composants internes non extraits sous `components/` (suivi ici pour `SortFilterControls`)]
- [Source: domain/task.ts — `sortTasksChronologically` existante (Story 3.3, `b.createdAt.localeCompare(a.createdAt)`), réutilisée telle quelle par `sortTasks` de cette story ; style des fonctions pures existantes (`openTask`, `isTaskOverdue`) répliqué pour `sortTasks`]
- [Source: app/projects/[id]/project-view.tsx, app/projects/[id]/project-view.module.css — structure actuelle du bloc `activeTab === "tasks"` (ternaire erreur/vide/liste) à restructurer Task 2 ; `.visuallyHidden` existante réutilisée en modèle pour `.checkboxInput` ; `.tab[data-active="true"]`/`--color-on-primary` réutilisés en référence pour la coche blanche sur fond primaire]
- [Source: app/globals.css — tokens disponibles (`--color-primary`, `--color-muted`, `--color-muted-dark`, `--color-on-primary`, `--color-bg`, `--space-3`, `--font-label-*`), confirmé qu'aucun token `--radius-*` ne correspond à 4px (le plus petit est `--radius-sm: 6px`) — valeur littérale assumée pour `.checkboxBox`, cohérent avec les autres valeurs littérales déjà présentes dans `project-view.module.css` (ex. badge "nouveau" 11px)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre.
- `npm run build` : propre (avant ET après l'atterrissage externe des correctifs de revue de la Story 3.3 sur `project-view.tsx`/`project-view.module.css`/`domain/task.ts` pendant cette session — cf. Completion Notes ; les deux passes de build ont réussi, aucun conflit avec le code de cette story).
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` déjà actif (Guillaume authentifié lui-même au préalable, mot de passe jamais saisi par l'agent — règle de sécurité, même précédent que Story 3.3). Projet de test réutilisé ("Test Story 3.3", déjà présent) enrichi de 2 tâches temporaires ("Tâche haute priorité (test 3.4)", "Tâche normale priorité (test 3.4)") pour couvrir les 3 niveaux de priorité et un doublon de priorité Haute à dates différentes, nécessaire à la vérification d'AC #4 (repli chronologique au sein d'un même niveau).
- **Limitation de l'outil de navigateur automatisé rencontrée pour la vérification clavier (Espace)** : Tab atteint correctement la case (focus confirmé via `document.activeElement`, `:focus-visible` vérifié `true`, anneau de focus visible et correctement stylé). En revanche, la touche Espace simulée par l'outil (et Entrée, testée en comparaison) délivre des événements `keydown`/`keyup` avec un `key`/`code` vides — confirmé en attachant un listener temporaire sur l'élément — ce qui empêche le comportement natif du navigateur de déclencher la bascule (`click` implicite du navigateur sur Espace pour une case à cocher, pas un gestionnaire de cette story). Aucun gestionnaire clavier personnalisé n'existe sur ces cases (`<input type="checkbox">` natif, cf. Dev Notes) — la bascule au clic (souris) fonctionne à 100% et a été vérifiée pour les 5 AC. Même catégorie de dégradation d'outil que celle documentée en Story 3.3 (Debug Log), sans lien avec le code de cette story.
- Scénarios vérifiés en navigateur : AC#1 (case "Chronologique" cochée par défaut, "Prioritaire" décochée, à l'ouverture de l'onglet Tâches, confirmé visuellement et via `input.checked`) ; AC#2 (Chronologique seule → ordre par `createdAt` décroissant) ; AC#3 (Prioritaire seule → Haute avant Normale avant Basse, repli chronologique constaté entre les deux tâches Haute) ; AC#4 (les deux cochées → ordre identique à AC#3) ; AC#5 (aucune case cochée → ordre identique à AC#2). Mise à jour de l'affichage instantanée à chaque clic (pas de délai perceptible). Non-régression Story 3.3 vérifiée : 3 onglets, modale de détail (ouverture/fermeture, badge "nouveau" qui disparaît), onglets Documents/Notes toujours "Bientôt disponible." sans case de filtre. Responsive vérifié mobile (375px)/desktop (1280px) — pas de débordement horizontal. Aucune erreur console sur l'ensemble du parcours.
- Données de test (2 tâches) supprimées d'IndexedDB par l'agent en fin de session (même méthode que Story 3.3 : accès direct à la base `project-note` via `indexedDB.open`, suppression ciblée par id dans `tasks` et `syncQueue`). **Action requise de Guillaume** : ces 2 tâches ont pu être poussées vers Supabase avant leur suppression locale (l'indicateur de synchronisation est passé par "En attente de synchronisation" puis "À jour" avant le nettoyage) — aucune fonctionnalité de suppression propagée au serveur n'existe encore (limite déjà documentée aux Stories 2.3/3.1/3.2/3.3), à vérifier et nettoyer côté Supabase (Table Editor) si présentes.

### Completion Notes List

- Toutes les tâches (1 à 4) complètes. Les 5 AC vérifiées en conditions réelles (navigateur, avec des données couvrant les 3 niveaux de priorité et un cas de doublon de priorité à dates différentes), pas seulement par compilation/typage.
- Aucune déviation de portée par rapport à la story : aucune nouvelle route, aucune modification de `data/local/`/`data/remote/`/`sync/`, aucune persistance du choix de tri ajoutée, aucune case de filtre sur Documents/Notes.
- **Changement externe détecté en cours de session, non causé par cette story** : pendant l'implémentation, les correctifs de revue de code de la Story 3.3 ont atterri sur `app/projects/[id]/project-view.tsx` (chargement parallèle projet/tâches, réinitialisation d'onglet/tâche sélectionnée au changement de projet, piège à focus clavier dans `TaskDetail`), `app/projects/[id]/project-view.module.css`, et `domain/task.ts` (`isTaskOverdue` corrigée pour comparer à la fin du jour d'échéance) — et `sprint-status.yaml` (Story 3.3 passée à `done`). Ces changements ont été relus et se sont intégrés proprement avec le code de cette story (aucun conflit de zone modifiée) ; `npm run build`/`npm run lint` re-exécutés après leur atterrissage pour confirmer l'absence de régression combinée — les deux passent.
- Le sens du tri "Prioritaire" (Haute en tête) est une décision assumée documentée dans les Dev Notes, non explicitement fixée par une AC — à confirmer avec Guillaume si le comportement observé en usage réel ne correspond pas à son attente (cf. Dev Notes de la story pour le raisonnement complet).
- Aucune nouvelle dépendance ajoutée.
- **Revue de code (2026-08-13) : 3 findings `[patch]` appliqués** — (1) `sortFilters` ajouté à la réinitialisation explicite du `useEffect` de changement de projet, aux côtés d'`activeTab`/`selectedTask` ; (2) `.checkboxInput` simplifié via `composes: visuallyHidden;` (a nécessité de déplacer la définition de `.visuallyHidden` avant son premier usage dans le fichier — `composes` exige que la classe composée soit déclarée plus tôt dans ce pipeline CSS Modules/webpack, sinon erreur de build `referenced class name "visuallyHidden" in composes not found` — corrigé et revérifié, `npm run build`/`npm run lint` propres après coup) ; (3) dérogation `.filters { margin-bottom }` documentée dans les Dev Notes (cf. entrée dédiée ci-dessus). Revérifié en navigateur après coup : cases toujours masquées visuellement (1×1px, clip), boîte visuelle 13px/rayon 4px/fond primaire à l'état coché — rendu identique à avant la revue.

### File List

**Modifiés (par cette story) :**
- `domain/task.ts` (+ `SortFilters`, `PRIORITY_ORDER`, `sortTasks`)
- `domain/index.ts` (+ export `sortTasks`, export type `SortFilters`)
- `app/projects/[id]/project-view.tsx` (+ état `sortFilters`, + `SortFilterControls`, usage de `sortTasks` au lieu de `sortTasksChronologically`)
- `app/projects/[id]/project-view.module.css` (+ `.filters`, `.filter`, `.checkboxInput`, `.checkboxBox` et variantes `:checked`/`:focus-visible`/sombre)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

**Modifiés en parallèle par la revue de la Story 3.3 (non attribuables à cette story, cf. Completion Notes) :** `app/projects/[id]/project-view.tsx`, `app/projects/[id]/project-view.module.css`, `domain/task.ts`, `_bmad-output/implementation-artifacts/sprint-status.yaml` — mêmes fichiers, changements distincts et non conflictuels.

## Change Log

- 2026-08-13 : Implémentation complète (Tasks 1 à 4). Tri combinable pur `sortTasks` (`domain/task.ts`, réutilise `sortTasksChronologically` de la Story 3.3) ; cases à cocher "Chronologique"/"Prioritaire" (`SortFilterControls`, `app/projects/[id]/project-view.tsx`) avec état local par défaut (Chronologique coché, Prioritaire décoché) ; styles `.filters`/`.checkboxBox` conformes à `DESIGN.md.components.checkbox`. `npm run build`/`npm run lint` propres. Vérification manuelle en navigateur : les 5 AC confirmées en conditions réelles avec données couvrant les 3 niveaux de priorité. Statut passé à `review`.
- 2026-08-13 : Revue de code (3 couches parallèles). 3 findings `[patch]` appliqués : réinitialisation de `sortFilters` au changement de projet, `.checkboxInput` simplifié via `composes: visuallyHidden;` (avec repositionnement de `.visuallyHidden` avant son premier usage dans le fichier CSS), dérogation `.filters { margin-bottom }` documentée. 7 findings rejetés comme non-défauts (asymétrie `chronological` intentionnelle et déjà documentée, absence de garde runtime cohérente avec le reste du fichier, absence de tests automatisés conforme à la convention du projet, placement de `SortFilters` dans `domain/` conforme à la Capability Map de l'architecture, valeur `top: 0.5px` reprise littéralement du mockup, portée Tâches-only justifiée par les AC, amélioration `aria-live` hors périmètre). `npm run build`/`npm run lint` propres après application des patches. Statut passé à `done`.
