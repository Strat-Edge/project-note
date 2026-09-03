---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 4.3: Accès rapide à un projet depuis le calendrier

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want créer ou sélectionner un projet directement depuis le calendrier,
so that je n'aie pas besoin de changer d'écran pour organiser mon travail.

## Acceptance Criteria

1. **Given** l'écran Général **When** je déclenche l'accès rapide **Then** je peux créer un nouveau projet ou sélectionner un projet existant sans quitter le contexte du calendrier

## Tasks / Subtasks

- [x] Task 1: `app/general-screen.tsx` — bouton d'accès rapide + modale (sélection projet existant + création) (AC: #1 ; Capability Map 4.7 ; FR-30, dernier FR d'Epic 4 non couvert)
  - [x] Étendre l'import `@/domain` existant :
    ```ts
    import type { CalendarFilters, CalendarViewMode, Priority, Project, ProjectColorKey, Task } from "@/domain";
    import {
      dateKey,
      filterTasksForCalendar,
      getMonthGridDays,
      getWeekDays,
      groupProjectsByStatus,
      groupTasksByDueDate,
      isSameDay,
      nextProjectColor,
      PROJECT_COLOR_ROTATION,
      validateProjectName,
    } from "@/domain";
    ```
  - [x] Étendre l'import `@/data/local` existant (actuellement `listAllTasks, listProjects`) : ajouter `createProject`.
    ```ts
    import { createProject, listAllTasks, listProjects } from "@/data/local";
    ```
  - [x] Étendre l'import React (actuellement `import { useEffect, useRef, useState } from "react";`) : ajouter le type `FormEvent`.
    ```ts
    import { useEffect, useRef, useState, type FormEvent } from "react";
    ```
  - [x] Ajouter, à la suite de `LOAD_ERROR_MESSAGE` :
    ```ts
    const NAME_REQUIRED_MESSAGE = "Le nom du projet est obligatoire.";
    const CREATE_FAILED_MESSAGE = "La création a échoué. Réessayez.";

    // Même sélecteur que app/capture-flow.tsx (FOCUSABLE_SELECTOR) — dupliqué ici plutôt que
    // partagé cross-fichier (aucune convention d'extraction cross-module dans ce projet, cf.
    // commentaire de app/capture-flow.module.css : "Pas de classe partagée cross-module").
    const FOCUSABLE_SELECTOR =
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    ```
  - [x] Rendre `<ProjectQuickAccess>` dans `.toolbarControls`, comme premier enfant, avant `.viewToggle` :
    ```tsx
    <div className={styles.toolbarControls}>
      <ProjectQuickAccess activeProjects={activeProjects} totalProjectCount={projects.length} />
      <div className={styles.viewToggle} role="group" aria-label="Vue calendrier">
    ```
    (`activeProjects` et `projects` existent déjà dans `GeneralScreen`, calculés avant le `return` : `const { active: activeProjects, archived: archivedProjects } = groupProjectsByStatus(projects);`. `projects.length` — total actifs+archivés — reproduit exactement `nextProjectColor(current.length)` de `app/projects/projects-screen.tsx` `openForm`, cf. Dev Notes.)
  - [x] Ajouter le nouveau sous-composant, à la suite de `ProjectFilterControls` (même précédent : sous-composant interne non extrait sous `components/`) :
    ```tsx
    // FR-30 (Story 4.3) — accès rapide à un projet depuis le calendrier : créer un nouveau
    // projet ou en sélectionner un existant sans quitter l'écran Général. Contrairement à
    // CaptureFlow (app/capture-flow.tsx), qui recharge lui-même listProjects() à l'ouverture
    // (point d'entrée indépendant), ce composant reçoit activeProjects/totalProjectCount déjà
    // chargés par GeneralScreen (liveQuery) — pas de second chargement Dexie redondant.
    function ProjectQuickAccess({
      activeProjects,
      totalProjectCount,
    }: {
      activeProjects: Project[];
      totalProjectCount: number;
    }) {
      const [open, setOpen] = useState(false);
      const [name, setName] = useState("");
      const [description, setDescription] = useState("");
      const [color, setColor] = useState<ProjectColorKey>(PROJECT_COLOR_ROTATION[0]);
      const [nameError, setNameError] = useState<string | undefined>();
      const [submitError, setSubmitError] = useState<string | undefined>();
      const [pending, setPending] = useState(false);

      const triggerRef = useRef<HTMLButtonElement>(null);
      const contentRef = useRef<HTMLDivElement>(null);

      // Focus sur le premier élément interactif à l'ouverture, restauré sur le bouton
      // déclencheur à la fermeture — même pattern que CaptureFlow (app/capture-flow.tsx).
      useEffect(() => {
        if (!open) {
          return;
        }
        const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
        // Capturé ici plutôt que lu depuis triggerRef.current dans le cleanup (react-hooks/
        // exhaustive-deps) — le bouton déclencheur reste monté en permanence, sa ref est déjà
        // stable, mais ce pattern évite tout avertissement sur une ref potentiellement
        // obsolète au moment où le cleanup s'exécute.
        const trigger = triggerRef.current;
        return () => {
          trigger?.focus();
        };
      }, [open]);

      function openDialog() {
        setName("");
        setDescription("");
        setNameError(undefined);
        setSubmitError(undefined);
        setColor(nextProjectColor(totalProjectCount));
        setOpen(true);
      }

      // Fermeture explicite uniquement (EXPERIENCE.md UX-DR13) — pas de tap-en-dehors, pas
      // d'Échap, mêmes bornes que ConfirmDialog/CaptureFlow. Bloquée pendant `pending` pour ne
      // pas interrompre une création en cours.
      function closeDialog() {
        if (pending) {
          return;
        }
        setOpen(false);
      }

      async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (pending) {
          return;
        }

        if (!validateProjectName(name)) {
          setNameError(NAME_REQUIRED_MESSAGE);
          return;
        }

        setNameError(undefined);
        setSubmitError(undefined);
        setPending(true);

        try {
          await createProject({ name, description, color });
        } catch {
          setSubmitError(CREATE_FAILED_MESSAGE);
          setPending(false);
          return;
        }

        // Pas de redirection : rester sur le calendrier est le point de cette story (cf. AC,
        // "sans quitter le contexte du calendrier"). Le nouveau projet apparaît de lui-même
        // dans le panneau de filtre et la légende via le liveQuery déjà en place (Story 4.2).
        setPending(false);
        setOpen(false);
      }

      return (
        <>
          <button
            ref={triggerRef}
            type="button"
            className={styles.quickAccessButton}
            onClick={openDialog}
          >
            + Nouveau projet
          </button>

          {open && (
            <div className={styles.qaBackdrop}>
              <div
                className={styles.qaPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="quick-access-title"
              >
                <div className={styles.qaHeader}>
                  <h2 id="quick-access-title" className={styles.qaTitle}>
                    Accès rapide
                  </h2>
                  <button
                    type="button"
                    className={styles.qaCloseButton}
                    aria-label="Fermer"
                    onClick={closeDialog}
                    disabled={pending}
                  >
                    ✕
                  </button>
                </div>

                <div ref={contentRef} className={styles.qaBody}>
                  {activeProjects.length > 0 && (
                    <div className={styles.qaExistingList} role="group" aria-label="Projets existants">
                      {activeProjects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className={styles.qaOption}
                        >
                          <span
                            className={styles.qaOptionSwatch}
                            style={{ backgroundColor: `var(--color-${project.color})` }}
                            aria-hidden="true"
                          />
                          {project.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <form className={styles.qaForm} onSubmit={handleSubmit}>
                    <div className={styles.qaField}>
                      <label className={styles.qaLabel} htmlFor="quick-access-name">
                        Nom du nouveau projet
                      </label>
                      <input
                        className={styles.qaInput}
                        id="quick-access-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={pending}
                      />
                      {nameError && (
                        <p className={styles.error} role="alert">
                          {nameError}
                        </p>
                      )}
                    </div>

                    <div className={styles.qaField}>
                      <label className={styles.qaLabel} htmlFor="quick-access-description">
                        Description
                      </label>
                      <textarea
                        className={styles.qaTextarea}
                        id="quick-access-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={pending}
                      />
                    </div>

                    <fieldset className={styles.qaSwatchFieldset}>
                      <legend className={styles.qaLabel}>Couleur</legend>
                      <div className={styles.qaSwatches}>
                        {PROJECT_COLOR_ROTATION.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={styles.qaSwatch}
                            aria-pressed={color === option}
                            data-selected={color === option}
                            onClick={() => setColor(option)}
                            disabled={pending}
                          >
                            <span
                              className={styles.qaSwatchChip}
                              style={{ backgroundColor: `var(--color-${option})` }}
                            />
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    {submitError && (
                      <p className={styles.error} role="alert">
                        {submitError}
                      </p>
                    )}

                    <div className={styles.qaActions}>
                      <button
                        type="button"
                        className={styles.qaGhostButton}
                        onClick={closeDialog}
                        disabled={pending}
                      >
                        Annuler
                      </button>
                      <button type="submit" className={styles.qaPrimaryButton} disabled={pending}>
                        Créer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
    ```
    (`styles.error` réutilise la classe déjà existante dans `general-screen.module.css` — ligne 383, identique en valeurs à celle de `projects-screen.module.css` — pas de duplication nécessaire pour les messages d'erreur.)

- [x] Task 2: `app/general-screen.module.css` — styles du bouton et de la modale d'accès rapide (AC: #1)
  - [x] Ajouter, à la suite du bloc `.filterSwatch` (avant `.grid`) :
    ```css
    /* FR-30 (Story 4.3) — bouton d'accès rapide, même échelle que .rowAction
       (projects-screen.module.css) / .navArrow ci-dessus (min-height 44px, cf. UX-DR21). */
    .quickAccessButton {
      min-height: 44px;
      padding: 0 var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      white-space: nowrap;
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      .quickAccessButton {
        color: var(--color-muted-dark);
      }
    }

    /* Modale d'accès rapide — pattern responsive dupliqué littéralement de
       app/capture-flow.module.css (.backdrop/.panel/.header/.title/.closeButton/.field/
       .label/.input/.textarea/.actions/.primaryButton/.ghostButton) : mobile plein écran
       sans backdrop ni rayon, desktop carte centrée avec backdrop assombri (UX-DR13). Préfixe
       `qa` pour éviter toute confusion avec `.title`/`.error` déjà utilisés par ce fichier pour
       d'autres éléments (le H1 de la page, les messages d'erreur de chargement). */
    .qaBackdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      background: transparent;
    }

    .qaPanel {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      width: 100%;
      min-height: 100%;
      padding: var(--space-6) var(--space-gutter);
      overflow-y: auto;
      background: var(--color-surface);
    }

    @media (prefers-color-scheme: dark) {
      .qaPanel {
        background: var(--color-surface-dark);
      }
    }

    @media (min-width: 768px) {
      .qaBackdrop {
        align-items: center;
        justify-content: center;
        background: rgba(15, 42, 68, 0.35);
      }

      .qaPanel {
        width: 100%;
        max-width: 480px;
        min-height: 0;
        max-height: 85vh;
        border-radius: var(--radius-lg);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
      }
    }

    @media (min-width: 768px) and (prefers-color-scheme: dark) {
      .qaPanel {
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
      }
    }

    .qaHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .qaTitle {
      font-size: var(--font-heading-size);
      font-weight: var(--font-heading-weight);
      line-height: var(--font-heading-line-height);
      color: var(--color-heading);
    }

    .qaCloseButton {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-body-size);
      cursor: pointer;
    }

    .qaCloseButton:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .qaBody {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    /* Liste des projets existants sélectionnables — dupliqué de .optionList/.option/
       .optionSwatch de capture-flow.module.css (DESIGN.md.components.stepper option), en
       <Link> plutôt qu'en <button> puisqu'il navigue directement vers /projects/{id} (même
       précédent que .legendItem, ci-dessous). */
    .qaExistingList {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .qaOption {
      display: flex;
      align-items: center;
      gap: var(--space-2);
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

    @media (prefers-color-scheme: dark) {
      .qaOption {
        background: var(--color-surface-dark);
      }
    }

    .qaOptionSwatch {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      border-radius: var(--radius-sm);
    }

    .qaForm {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .qaField {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .qaLabel {
      font-size: var(--font-label-size);
      font-weight: var(--font-label-weight);
      letter-spacing: var(--font-label-letter-spacing);
      color: var(--color-muted);
    }

    .qaInput,
    .qaTextarea {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-default);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: var(--font-family);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
    }

    .qaInput {
      min-height: 48px;
    }

    .qaTextarea {
      min-height: 80px;
      resize: vertical;
    }

    .qaInput:focus,
    .qaTextarea:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .qaInput:disabled,
    .qaTextarea:disabled {
      opacity: 0.6;
    }

    /* Sélecteur de couleur — dupliqué littéralement de .swatchFieldset/.swatches/.swatch/
       .swatchChip (projects-screen.module.css, DESIGN.md.components.project-color.rotation). */
    .qaSwatchFieldset {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      border: none;
      padding: 0;
      margin: 0;
    }

    .qaSwatches {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .qaSwatch {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 2px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
    }

    .qaSwatch[data-selected="true"] {
      border-color: var(--color-primary);
    }

    .qaSwatch:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .qaSwatchChip {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-sm);
    }

    .qaActions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .qaPrimaryButton {
      min-height: 48px;
      padding: 0 var(--space-4);
      border: none;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      cursor: pointer;
    }

    .qaPrimaryButton:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .qaGhostButton {
      min-height: 48px;
      padding: 0 var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--color-muted);
      font-size: var(--font-body-size);
      font-weight: var(--font-body-weight);
      cursor: pointer;
    }

    .qaGhostButton:disabled {
      opacity: 0.6;
      cursor: default;
    }
    ```

- [x] Task 3: Vérification manuelle (AC #1)
  - [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` propres.
  - [x] Ouvrir l'écran Général : le bouton "+ Nouveau projet" est visible dans la barre d'outils, à côté du sélecteur Mois/Semaine et de la navigation de période — distinct du FAB "+" (bas-droite, capture universelle).
  - [x] **Sélection d'un projet existant** : cliquer le bouton → la modale s'ouvre (plein écran mobile / carte centrée desktop, backdrop assombri en desktop) listant les projets actifs (pastille couleur + nom). Cliquer un projet → navigation vers `/projects/{id}`, la modale se ferme (changement de page). Vérifier qu'aucun projet archivé n'apparaît dans cette liste.
  - [x] **Création d'un nouveau projet** : rouvrir la modale depuis Général, laisser le nom vide et cliquer "Créer" → blocage avec message "Le nom du projet est obligatoire.", aucune requête envoyée. Saisir un nom, une description, choisir une couleur différente de la couleur pré-sélectionnée → "Créer" → la modale se ferme, on reste sur l'écran Général (pas de redirection), le nouveau projet apparaît immédiatement dans le panneau de filtre (Story 4.2) et, s'il a une tâche à échéance dans la période affichée, dans la légende — sans rechargement manuel de page (liveQuery).
  - [x] Vérifier la couleur pré-sélectionnée à l'ouverture de la modale : elle suit la rotation `nextProjectColor` sur le nombre total de projets existants (actifs + archivés), identique au comportement du formulaire de `/projects` (Story 2.1).
  - [x] Vérifier la fermeture explicite : bouton "✕" et bouton "Annuler" ferment la modale sans créer de projet ; aucune fermeture au clic sur le fond assombri (backdrop), conforme UX-DR13.
  - [x] Vérifier l'absence de régression : panneau de filtre projet (Story 4.2), légende cliquable, sélecteur Mois/Semaine, navigation précédent/suivant, switcher Général/Projets, et FAB "+" (capture) tous toujours fonctionnels et visuellement inchangés. Aucune erreur console (`read_console_messages`), aucune erreur serveur (`preview_logs`).
  - [x] Vérifier l'accessibilité : bouton d'accès rapide et champs de la modale atteignables au clavier (Tab), focus déplacé sur le premier élément interactif à l'ouverture et restauré sur le bouton déclencheur à la fermeture, `role="dialog"`/`aria-modal="true"`/`aria-labelledby` présents, cibles tactiles ≥44px (bouton d'accès rapide, options de projet existant, champs de formulaire, swatches de couleur).
  - [x] Nettoyage des données de test : un projet créé pour cette vérification ne peut pas être supprimé depuis l'UI (aucune suppression de projet n'existe, seulement l'archivage, Story 2.3) — l'archiver après vérification (`/projects`, bouton "Archiver") plutôt que de le laisser actif indéfiniment ; consigner dans le Debug Log ce qui reste en base.

### Review Findings

- [x] [Review][Patch] Le bouton d'accès rapide reste actif et sans indication d'erreur quand le chargement des projets échoue [app/general-screen.tsx:207] — `ProjectQuickAccess` est rendu hors du bloc conditionnel `{loadError ? ... : ...}` (`app/general-screen.tsx:240`) : quand `listProjects()` échoue (`projectLoadError`), le bouton "+ Nouveau projet" et la liste "Projets existants" restent affichés avec des données potentiellement vides ou obsolètes, sans aucun signal d'erreur, risquant une création de projet en double par méprise. **Corrigé** : nouvelle prop `disabled={!projectsLoaded || projectLoadError}` sur `ProjectQuickAccess`, désactive le bouton déclencheur tant que les projets n'ont pas chargé avec succès au moins une fois.
- [x] [Review][Patch] Pas de piège de focus (focus trap) dans la modale malgré `aria-modal="true"` [app/general-screen.tsx:518-620] — contrairement à `components/confirm-dialog.tsx` (qui implémente un piège Tab minimal), rien n'empêche `Tab`/`Shift+Tab` de sortir de la modale vers le contenu du calendrier masqué sous `.qaBackdrop`. `FOCUSABLE_SELECTOR` existe déjà dans le composant et peut être réutilisé pour construire le piège. **Corrigé** : `handlePanelKeyDown` (dynamique via `FOCUSABLE_SELECTOR`, contrairement au piège codé en dur de `ConfirmDialog`) ajouté sur `.qaPanel`, vérifié réellement au clavier (Tab depuis le dernier élément → premier ; Shift+Tab depuis le premier → dernier).
- [x] [Review][Patch] Couleur pré-sélectionnée potentiellement fausse dans la fenêtre transitoire avant la première émission du `liveQuery` [app/general-screen.tsx:206-207, 462] — `totalProjectCount` (`projects.length`) peut valoir `0` juste après le montage, avant que `liveQuery(() => listProjects())` n'émette. `ProjectsScreen.openForm` (Story 2.1) évite exactement cette race en rechargeant `listProjects()` frais à l'ouverture plutôt que de faire confiance à l'état React ; cette story a délibérément sauté ce rechargement (Dev Notes) sans reproduire la garde. **Corrigé** : couvert par la même prop `disabled` que ci-dessus (`!projectsLoaded`) — le bouton reste inactif jusqu'au premier chargement réussi, éliminant la fenêtre de race.
- [x] [Review][Patch] Les swatches de couleur n'ont pas de nom accessible [app/general-screen.tsx:605-618] — contrairement à `app/projects/projects-screen.tsx` (lignes 298-314), qui ajoute `aria-label={COLOR_LABELS[color]}` à chaque bouton de couleur, les `.qaSwatch` de cette modale n'ont ni `aria-label` ni texte, malgré la Dev Note affirmant une duplication "à l'identique" du même composant. **Corrigé** : `COLOR_LABELS` dupliqué à l'identique depuis `projects-screen.tsx`, `aria-label={COLOR_LABELS[option]}` ajouté à chaque swatch — vérifié (Vert/Orange/Violet/Rose/Ambre/Sarcelle/Magenta/Gris).
- [x] [Review][Patch] Cliquer un projet existant ne ferme pas la modale ni ne se protège d'un clic pendant une création en cours [app/general-screen.tsx:544-557] — le `<Link>` de sélection n'appelle jamais `closeDialog()`/`setOpen(false)` avant de naviguer, et n'est pas désactivé quand `pending` est vrai, alors que tous les autres contrôles du formulaire le sont (`disabled={pending}`). Incohérent avec le reste du composant ; sans conséquence de données (la création Dexie continue en tâche de fond), mais une interaction déroutante. **Corrigé** : `aria-disabled={pending}` + garde `onClick` (`preventDefault` si `pending`) ajoutés au `<Link>`, plus un style visuel `.qaOption[aria-disabled="true"]`.
- [x] [Review][Defer] Le message d'erreur du nom ne se réinitialise pas pendant la frappe [app/general-screen.tsx:570] — deferred, pre-existing (comportement identique à `app/projects/projects-screen.tsx:271`, même gap présent depuis la Story 2.1, non introduit par cette diff)
- [x] [Review][Defer] Aucune limite de longueur (`maxLength`) sur les champs nom/description [app/general-screen.tsx:565-590] — deferred, pre-existing (absent aussi de `app/projects/projects-screen.tsx`, même formulaire source)
- [x] [Review][Defer] Erreurs de soumission non journalisées (`console.error`) dans `handleSubmit` [app/general-screen.tsx:498-501] — deferred, pre-existing (convention déjà établie par `ProjectsScreen.handleSubmit` et `CaptureFlow.handleSubmitTask`, aucun formulaire du projet ne logge)
- [x] [Review][Defer] Pas de verrouillage du scroll de fond ni d'`inert`/`aria-hidden` sur le contenu sous la modale [app/general-screen.tsx:518-527] — deferred, pre-existing (gap identique dans `app/capture-flow.tsx` et `components/confirm-dialog.tsx`, aucune des deux modales existantes ne le fait)
- [x] [Review][Defer] Couleur de projet potentiellement dupliquée en cas de créations concurrentes [app/general-screen.tsx:494] — deferred, pre-existing (`createProject({ name, description, color })` passe toujours `color` explicitement, contournant le fallback atomique `nextProjectColor(existingCount)` de la transaction ; comportement identique à `ProjectsScreen`, hérité de la Story 2.1)

## Dev Notes

**Portée exacte de cette story.** FR-30 est le dernier FR d'Epic 4 non couvert après les Stories 4.1 (vue calendrier, FR-27/FR-29/FR-32) et 4.2 (filtre, FR-28/FR-31) — cf. Dev Notes de la Story 4.2 : *"FR-30 (créer/sélectionner un projet directement depuis le calendrier, bouton '+ Nouveau projet' visible dans mockups/key-general-calendar.html) reste le périmètre exact de la Story 4.3"*. Cette story n'ajoute aucune règle métier `domain/` nouvelle (contrairement à 4.1/4.2) : `createProject`, `validateProjectName`, `nextProjectColor`, `PROJECT_COLOR_ROTATION` sont déjà entièrement implémentées et testées depuis la Story 2.1 — cette story les réutilise tel quel dans un nouveau point d'entrée UI, sans toucher `domain/project.ts` ni `data/local/projects.ts`.

**Le mockup ne montre que le bouton "+ Nouveau projet", pas le contenu de la modale.** `mockups/key-general-calendar.html` place un `.btn-ghost-sm` "+ Nouveau projet" dans la barre d'outils du calendrier (`.cal-toolbar-actions`, avant la navigation de mois) — c'est la seule référence visuelle disponible pour cette story, et uniquement pour le bouton déclencheur. Le texte exact de l'AC ("créer un nouveau projet OU sélectionner un projet existant") et de l'IA (`EXPERIENCE.md` : *"accès rapide à la création d'un projet ou à la sélection d'un projet existant"*) exige que le même point d'entrée couvre les deux actions — le libellé du bouton est conservé littéralement du mockup (fidélité visuelle, NFR-1) mais son comportement réel ouvre une modale offrant les deux options, pas seulement la création. Aucun mockup ne fixant le contenu de cette modale, sa structure est dérivée par réutilisation directe de patterns déjà spécifiés et implémentés ailleurs (jamais une nouvelle interaction inventée) :
- Le patron de modale plein écran mobile / carte centrée desktop vient de `app/capture-flow.module.css` (Story 3.1) et `components/confirm-dialog.module.css` (Story 2.3), tous deux déjà conformes à `DESIGN.md.components.modal` / UX-DR13.
- La liste de projets sélectionnables (pastille + nom) vient de l'étape 1 de `CaptureFlow` (`app/capture-flow.tsx`, `OptionButton`), adaptée en liens `<Link>` plutôt qu'en boutons de sélection puisqu'ici le clic doit naviguer directement vers `/projects/{id}` (comportement déjà établi par `.legendItem`, Story 4.1) — pas d'étape suivante à enchaîner comme dans le flux de capture.
- Le formulaire de création (nom/description/couleur) vient de `app/projects/projects-screen.tsx` (Story 2.1), reproduit à l'identique (mêmes messages d'erreur, même logique de validation, même rotation de couleur par défaut).

**Décision de conception — pas de redirection après création, mais navigation lors de la sélection d'un projet existant.** Créer un projet garde l'utilisateur sur le calendrier (c'est le sens littéral de l'AC : "sans quitter le contexte du calendrier") ; le nouveau projet apparaît de lui-même dans le panneau de filtre et la légende (Story 4.2) grâce au `liveQuery(() => listProjects())` déjà en place dans `GeneralScreen`, sans rechargement manuel. Sélectionner un projet existant, à l'inverse, navigue vers `/projects/{id}` — équivalent à cliquer un élément de la légende (Story 4.1), déjà un comportement accepté et attendu de ce même écran ; "sans quitter le contexte du calendrier" qualifie l'accès (pas besoin de passer par l'écran Projets pour créer ou trouver un projet), pas le résultat du clic sur un projet existant.

**Aucun composant modal partagé n'existe dans `components/`.** Trois implémentations de modale coexistent désormais dans ce projet (`components/confirm-dialog.tsx`, `app/capture-flow.tsx`, et celle-ci) — chacune duplique littéralement le même pattern CSS plutôt que de partager une classe cross-module, convention déjà explicitée dans `app/capture-flow.module.css` : *"Pas de classe partagée cross-module (convention établie en Story 2.3)"*. Cette story suit la même convention (classes préfixées `qa` dans `general-screen.module.css`) — pas d'extraction prématurée d'un composant `Dialog`/`Modal` générique.

**`activeProjects`/`projects` sont déjà disponibles dans `GeneralScreen`, aucun nouveau chargement Dexie.** Contrairement à `CaptureFlow`, point d'entrée FAB indépendant qui recharge `listProjects()` à chaque ouverture, `ProjectQuickAccess` reçoit `activeProjects` (déjà dérivé via `groupProjectsByStatus(projects)`) et `projects.length` en props depuis `GeneralScreen`, qui les tient déjà à jour via `liveQuery` (Story 4.1/4.2). Pas de requête Dexie supplémentaire dans ce composant.

**Pas de nouvelle table/version Dexie, pas de nouveau champ Project.** `data/local/projects.ts` (`createProject`) est réutilisé tel quel — aucune modification.

### Project Structure Notes

Fichiers modifiés :
```text
app/general-screen.tsx                # + ProjectQuickAccess (bouton + modale), imports domain/data/local étendus
app/general-screen.module.css         # + .quickAccessButton, .qaBackdrop/.qaPanel/.qaHeader/.qaTitle/.qaCloseButton/
                                       #   .qaBody/.qaExistingList/.qaOption/.qaOptionSwatch/.qaForm/.qaField/.qaLabel/
                                       #   .qaInput/.qaTextarea/.qaSwatchFieldset/.qaSwatches/.qaSwatch/.qaSwatchChip/
                                       #   .qaActions/.qaPrimaryButton/.qaGhostButton
```

Aucun fichier créé, aucun fichier supprimé. Aucun changement à `domain/`, `data/local/projects.ts`, `sync/`, `data/remote/`, ou tout autre écran (`/projects`, `/projects/[id]`, `/login`, capture "+").

### Testing Standards

Aucun framework de test automatisé imposé par l'Architecture (identique aux Stories 1.1 à 4.2). Vérification manuelle exhaustive en Task 3, avec attention particulière à la non-redirection après création (reste sur le calendrier) versus la navigation lors de la sélection d'un projet existant (deux comportements distincts sur le même écran, à ne pas confondre).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4: Calendrier général, Story 4.3 (texte exact de l'AC) ; Story 4.2 Dev Notes ("FR-30... reste le périmètre exact de la Story 4.3")]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#4.7 Calendrier général — FR-30 ("L'utilisateur peut créer un nouveau projet ou en sélectionner un existant directement depuis l'écran du calendrier général.")]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#Capability → Architecture Map, 4.7 Calendrier général ("components/ (vue mois/semaine), domain/ (agrégation en lecture des tâches à échéance)") — aucune nouvelle règle domain/ requise pour cette story]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Information Architecture ("Général — ...accès rapide à la création d'un projet ou à la sélection d'un projet existant") ; Component Patterns (Modale/overlay, UX-DR13 : "fermeture explicite uniquement")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/mockups/key-general-calendar.html — `.btn-ghost-sm` "+ Nouveau projet" dans `.cal-toolbar-actions`, seule référence visuelle (bouton déclencheur uniquement, aucun contenu de modale représenté)]
- [Source: app/capture-flow.tsx / app/capture-flow.module.css (Story 3.1) — pattern de modale plein écran mobile/carte centrée desktop, `OptionButton`/`.option`/`.optionSwatch`, `FOCUSABLE_SELECTOR`, gestion de focus à l'ouverture/fermeture, convention "pas de classe partagée cross-module"]
- [Source: components/confirm-dialog.tsx / confirm-dialog.module.css (Story 2.3) — second exemple du même pattern de modale, fermeture explicite]
- [Source: app/projects/projects-screen.tsx / projects-screen.module.css (Story 2.1) — formulaire de création (`name`/`description`/`selectedColor`), `NAME_REQUIRED_MESSAGE`/`SUBMIT_FAILED_MESSAGE`, `.swatchFieldset`/`.swatches`/`.swatch`/`.swatchChip`, `openForm` recalculant la couleur par défaut via `nextProjectColor(current.length)`]
- [Source: app/general-screen.tsx (Stories 4.1/4.2) — `GeneralScreen`, `activeProjects`/`projects` déjà dérivés via `groupProjectsByStatus`/liveQuery, `.legendItem` (Link vers `/projects/{id}`, précédent de navigation directe depuis Général), `.toolbarControls`/`.viewToggle`/`.nav` (point d'insertion du bouton)]
- [Source: domain/project.ts — `createProject`(data/local)/`validateProjectName`/`nextProjectColor`/`PROJECT_COLOR_ROTATION`/`groupProjectsByStatus` (Story 2.1/2.2, réutilisés tel quel, aucune modification)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run lint` : propre (1 avertissement `react-hooks/exhaustive-deps` corrigé en cours de route en capturant `triggerRef.current` dans une variable locale avant le cleanup de l'effet, plutôt que de lire la ref directement dans le cleanup).
- `npx tsc --noEmit` : propre.
- `npm run build` : propre (compilation, TypeScript, génération des pages statiques, service worker).
- Une session concurrente (revue de code de la Story 4.2) tournait dans le même dossier de projet pendant cette implémentation. Son serveur `next dev` (PID 31528, port 3000) empêchait tout second serveur `next dev` de démarrer sur ce dossier — Next.js 16 refuse plusieurs instances `dev` pour un même répertoire, quel que soit le port. Après confirmation explicite de Guillaume, ce processus a été arrêté (`taskkill /PID 31528 /F`) pour permettre la vérification manuelle de cette story ; la session concurrente a ensuite terminé son propre travail (Story 4.2 passée à `done`) sans conflit de fichier, `general-screen.tsx` étant resté cohérent (vérifié par un nouveau passage `tsc`/`lint` après leur édition concurrente).
- Vérification manuelle faite dans le panneau Browser de cette session, contre le serveur `next dev` (démarré via `preview_start`, port 3000) et le projet Supabase de production réel (session déjà authentifiée, mot de passe jamais saisi par l'agent).
- Données de test : projets existants réutilisés ("Test Story 4.1", "Test Story 3.3", actifs ; un projet archivé préexistant). Nouveau projet créé pour la vérification : "Test Story 4.3 Accès rapide" (description "Créé via la modale d'accès rapide du calendrier (vérification Story 4.3)"), via la modale d'accès rapide elle-même.
- **Validation vide** vérifiée : "Créer" sans nom → message "Le nom du projet est obligatoire." affiché, modale reste ouverte, aucune requête réseau déclenchée.
- **Création** vérifiée : nom + description + couleur choisie manuellement (swatch index 3, `project-4`) → `POST /api/sync/push` confirmé dans les logs serveur, modale fermée, **aucune redirection** (reste sur `/`), le nouveau projet apparaît immédiatement dans le panneau de filtre (Story 4.2) via liveQuery, sans rechargement manuel.
- **Rotation de couleur par défaut** vérifiée : à la réouverture de la modale après création (total projets passé de 3 à 4), la couleur pré-sélectionnée passe automatiquement de l'index 3 à l'index 4 (`nextProjectColor(totalProjectCount)`), confirmé via inspection de `data-selected` sur les boutons de swatch.
- **Sélection d'un projet existant** vérifiée : clic sur le lien "Test Story 4.3 Accès rapide" dans la liste de la modale → navigation confirmée vers `/projects/7f6d8a7d-002e-400d-b0f1-cfe8debb985a` (`window.location.href`), page de détail du projet affichée correctement.
- **Fermeture explicite** vérifiée : bouton "Annuler" ferme la modale sans créer de projet, focus restauré sur le bouton déclencheur "+ Nouveau projet" (`document.activeElement` confirmé).
- **Responsive** vérifié via inspection des styles calculés : mobile (375px) → `backdrop` transparent, panneau pleine largeur/hauteur, `border-radius: 0px` ; desktop (1280px) → `backdrop` `rgba(15, 42, 68, 0.35)`, panneau `max-width: 480px`, `border-radius: 12px`. Conforme UX-DR13.
- **Accessibilité** vérifiée : `role="dialog"`/`aria-modal="true"` présents et confirmés par `read_page` (rendu en tant que "dialog" dans l'arbre d'accessibilité), focus déplacé sur le premier champ interactif à l'ouverture et restauré sur le bouton déclencheur à la fermeture.
- **Non-régression** vérifiée : panneau de filtre (Story 4.2, 3 cases projet + case archivés), légende cliquable, sélecteur Mois/Semaine, navigation précédent/suivant, switcher Général/Projets, et FAB "+" (`CaptureFlow`, ouvre toujours "Choisissez un projet") tous fonctionnels. `read_console_messages` sans erreur.
- **Suppression des données de test** : le projet "Test Story 4.3 Accès rapide" créé pour cette vérification a été archivé après coup (`/projects`, bouton "Archiver") — aucune suppression de projet n'existant dans l'UI (seul l'archivage, Story 2.3). Compteur "Archivés" passé de 1 à 2, confirmant l'archivage réussi.

### Revue de code (2026-08-19)

- 3 couches de revue adversariale (Blind Hunter, Edge Case Hunter, Acceptance Auditor) lancées en parallèle sur un diff reconstruit précisément (le dépôt n'ayant qu'un seul commit initial, `git diff` brut aurait englobé tout le travail non committé depuis la Story 1.1 — le diff a donc été isolé exactement à la contribution de cette story via reconstruction des fichiers "avant").
- 5 `patch` (corrigés ci-dessus), 5 `defer` (préexistants, hérités des Stories 2.1/2.3/3.1, consignés dans `deferred-work.md`), 3 rejetés comme bruit (duplication assumée de `FOCUSABLE_SELECTOR`, absence d'Échap déjà documentée comme décision délibérée UX-DR13, CSS dark-mode redondant mais déjà omniprésent dans tout le fichier).
- Les 5 patches vérifiés après application : `npm run build`/`npm run lint`/`tsc --noEmit` propres, puis vérification réelle dans le navigateur (serveur `next dev` déjà lancé pour cette session) : bouton désactivé confirmé (`disabled: false` à l'état normal, logique branchée sur `projectsLoaded`/`projectLoadError` déjà existants dans `GeneralScreen`), les 8 `aria-label` des swatches confirmés via `read_page` (Vert/Orange/Violet/Rose/Ambre/Sarcelle/Magenta/Gris), piège de focus vérifié réellement au clavier (`Tab` depuis "Créer" → focus "Fermer" avec `defaultPrevented: true` ; `Shift+Tab` depuis "Fermer" → focus "Créer" avec `defaultPrevented: true`), garde `aria-disabled`/`onClick` sur le lien de sélection de projet confirmée présente et correctement câblée sur `pending`.
- Une session concurrente travaillait en parallèle sur la Story 5.1 (notes) pendant cette revue — des erreurs `500` sur `/api/sync/pull` ("Could not find the table 'public.notes'") sont apparues dans les logs serveur pendant la vérification, sans rapport avec cette story (table Supabase pas encore migrée par l'autre session) ; le calendrier lui-même a continué de répondre `200` sans régression.

### Completion Notes List

- Toutes les tâches (1 à 3) complètes. L'AC unique vérifiée en conditions réelles contre le projet Supabase de production, couvrant les deux branches (création sans redirection, sélection avec navigation).
- Aucune règle `domain/` nouvelle, aucune modification de `data/local/projects.ts` — réutilisation stricte de `createProject`/`validateProjectName`/`nextProjectColor`/`PROJECT_COLOR_ROTATION`/`groupProjectsByStatus` déjà implémentées (Story 2.1/2.2), conformément aux Dev Notes.
- Aucune déviation de portée : le libellé du bouton déclencheur reprend littéralement le mockup ("+ Nouveau projet") tout en ouvrant une modale couvrant les deux actions de FR-30 (création et sélection), comme documenté dans les Dev Notes.
- Aucun framework de test automatisé dans ce projet — vérification manuelle exhaustive documentée ci-dessus, cohérente avec les Stories 1.1 à 4.2.
- Aucune nouvelle dépendance ajoutée.
- Blocage d'infrastructure rencontré et résolu avec l'accord explicite de Guillaume (arrêt du serveur `next dev` d'une session concurrente bloquant le démarrage du serveur de vérification de cette session, cf. Debug Log) — aucune donnée perdue, la session concurrente a pu reprendre et terminer normalement (Story 4.2 → `done`).

### File List

**Modifiés :**
- `app/general-screen.tsx` (+ `ProjectQuickAccess` — bouton "+ Nouveau projet" et modale [sélection projet existant + formulaire de création], imports `domain`/`data/local`/`react` étendus, constantes `NAME_REQUIRED_MESSAGE`/`CREATE_FAILED_MESSAGE`/`FOCUSABLE_SELECTOR`)
- `app/general-screen.module.css` (+ `.quickAccessButton`, `.qaBackdrop`/`.qaPanel`/`.qaHeader`/`.qaTitle`/`.qaCloseButton`/`.qaBody`/`.qaExistingList`/`.qaOption`/`.qaOptionSwatch`/`.qaForm`/`.qaField`/`.qaLabel`/`.qaInput`/`.qaTextarea`/`.qaSwatchFieldset`/`.qaSwatches`/`.qaSwatch`/`.qaSwatchChip`/`.qaActions`/`.qaPrimaryButton`/`.qaGhostButton`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

## Change Log

- 2026-08-19 : Implémentation complète (Tasks 1 à 3). Bouton "+ Nouveau projet" et modale d'accès rapide (`app/general-screen.tsx` — `ProjectQuickAccess`) intégrés à l'écran Général : liste des projets actifs sélectionnables (navigation vers `/projects/{id}`) et formulaire de création inline (nom/description/couleur, réutilisant `createProject`/`validateProjectName`/`nextProjectColor` de la Story 2.1) sans quitter le calendrier. Aucune règle `domain/` nouvelle. `npm run build`/`npm run lint`/`tsc --noEmit` propres. Vérifié manuellement en conditions réelles (création, sélection, validation, rotation de couleur, fermeture explicite, responsive mobile/desktop, accessibilité, non-régression). Statut passé à `review`.
- 2026-08-19 : Revue de code (3 couches adversariales) — 5 corrections appliquées : bouton d'accès rapide désactivé tant que les projets n'ont pas chargé/en cas d'échec de chargement (couvre aussi la race de couleur par défaut), piège de focus clavier dynamique dans la modale, `aria-label` sur les 8 swatches de couleur, garde contre un clic sur un projet existant pendant une création en cours. 5 items préexistants différés vers `deferred-work.md`. `npm run build`/`npm run lint`/`tsc --noEmit` propres, corrections revérifiées dans le navigateur. Statut passé à `done`.
