"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { liveQuery } from "dexie";
import {
  NO_PROJECT_FILTER_ID,
  groupProjectsByStatus,
  validateProjectName,
  type Project,
} from "@/domain";
import {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  listGeneralTasks,
  archiveProject,
  unarchiveProject,
} from "@/data/local";
import { ConfirmDialog } from "@/components/confirm-dialog";
import styles from "./projects-screen.module.css";

const NAME_REQUIRED_MESSAGE = "Le nom du projet est obligatoire.";
const SUBMIT_FAILED_MESSAGE = "La création a échoué. Réessayez.";
const LOAD_FAILED_MESSAGE = "Impossible de charger la liste des projets.";
const ARCHIVE_FAILED_MESSAGE = "L'archivage a échoué. Réessayez.";
const UNARCHIVE_FAILED_MESSAGE = "Le désarchivage a échoué. Réessayez.";
const UPDATE_FAILED_MESSAGE = "La modification a échoué. Réessayez.";
const DELETE_FAILED_MESSAGE = "La suppression a échoué. Réessayez.";
const EMPTY_MESSAGE =
  "Aucun projet pour l'instant. Cliquez sur « Nouveau projet » pour en créer un.";
const GENERAL_PROJECT_NAME = "Hors projet";

const STATUS_LABELS: Record<Project["status"], string> = {
  active: "Actif",
  archived: "Archivé",
};

export function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const [confirmTarget, setConfirmTarget] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<Project["status"]>("active");
  // Nombre de tâches générales, affiché sur l'entrée épinglée « Hors projet ». `null` = pas
  // encore connu (premier rendu), distinct de 0 : évite d'annoncer "0 tâche" avant de savoir.
  const [generalTaskCount, setGeneralTaskCount] = useState<number | null>(null);

  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNameError, setEditNameError] = useState<string | undefined>();
  const [editSubmitError, setEditSubmitError] = useState<string | undefined>();
  const [editPending, setEditPending] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const { active, archived } = groupProjectsByStatus(projects);

  useEffect(() => {
    listProjects()
      .then((data) => {
        setProjects(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // liveQuery plutôt qu'un chargement ponctuel comme pour `projects` ci-dessus : ce compteur
  // change sans passer par cet écran — une capture de tâche sans projet depuis le flux "+",
  // un pull de synchro en arrière-plan, ou une suppression définitive de projet qui reverse
  // ses tâches en projectId: null (data/local/projects.ts). Le recâbler à la main sur chacun
  // de ces chemins serait à la fois plus verbeux et plus facile à oublier.
  useEffect(() => {
    const subscription = liveQuery(() => listGeneralTasks()).subscribe({
      next: (result) => setGeneralTaskCount(result.length),
      // Échec silencieux assumé : l'entrée « Hors projet » reste affichée sans son compteur
      // (elle est toujours atteignable), un échec de comptage ne doit pas masquer la liste
      // des projets ni afficher une erreur qui ne concerne pas les projets.
      error: () => setGeneralTaskCount(null),
    });
    return () => subscription.unsubscribe();
  }, []);

  async function openForm() {
    setEditTarget(null); // un seul formulaire à la fois (création/modification mutuellement exclusifs)
    setName("");
    setDescription("");
    setNameError(undefined);
    setSubmitError(undefined);

    try {
      const current = await listProjects();
      setProjects(current);
      setLoadError(false);
      setFormOpen(true);
    } catch {
      setLoadError(true);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setName("");
    setDescription("");
    setNameError(undefined);
    setSubmitError(undefined);
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
      await createProject({ name, description });
    } catch {
      setSubmitError(SUBMIT_FAILED_MESSAGE);
      setPending(false);
      return;
    }

    // La création a réussi : on referme le formulaire même si le rechargement
    // ci-dessous échoue — un échec du rechargement n'est pas un échec de création
    // (évite de laisser croire à un échec et de pousser à une double soumission).
    closeForm();
    setPending(false);

    try {
      setProjects(await listProjects());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  async function handleArchive(project: Project) {
    if (actionPendingId) {
      return;
    }

    setActionError(undefined);
    setActionPendingId(project.id);

    try {
      await archiveProject(project.id);
    } catch {
      setActionError(ARCHIVE_FAILED_MESSAGE);
      setActionPendingId(null);
      return;
    }

    // L'archivage a réussi : un échec du rechargement ci-dessous n'est pas un
    // échec de l'archivage (même pattern que handleSubmit / Story 2.2).
    setActionPendingId(null);

    try {
      setProjects(await listProjects());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  function handleRequestUnarchive(project: Project) {
    if (actionPendingId) {
      return;
    }
    setConfirmTarget(project);
  }

  function handleCancelUnarchive() {
    setConfirmTarget(null);
  }

  async function handleConfirmUnarchive() {
    const project = confirmTarget;

    if (!project || actionPendingId) {
      return;
    }

    setActionError(undefined);
    setActionPendingId(project.id);

    try {
      await unarchiveProject(project.id);
    } catch {
      setActionError(UNARCHIVE_FAILED_MESSAGE);
      setActionPendingId(null);
      setConfirmTarget(null);
      return;
    }

    // Le désarchivage a réussi : un échec du rechargement ci-dessous n'est pas
    // un échec du désarchivage (même pattern que handleSubmit / Story 2.2).
    setActionPendingId(null);
    setConfirmTarget(null);

    try {
      setProjects(await listProjects());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  function openEdit(project: Project) {
    setFormOpen(false); // un seul formulaire à la fois (création/modification mutuellement exclusifs)
    setEditTarget(project);
    setEditName(project.name);
    setEditDescription(project.description);
    setEditNameError(undefined);
    setEditSubmitError(undefined);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditNameError(undefined);
    setEditSubmitError(undefined);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editPending || !editTarget) {
      return;
    }

    if (!validateProjectName(editName)) {
      setEditNameError(NAME_REQUIRED_MESSAGE);
      return;
    }

    setEditNameError(undefined);
    setEditSubmitError(undefined);
    setEditPending(true);

    try {
      await updateProject(editTarget.id, { name: editName, description: editDescription });
    } catch {
      setEditSubmitError(UPDATE_FAILED_MESSAGE);
      setEditPending(false);
      return;
    }

    closeEdit();
    setEditPending(false);

    try {
      setProjects(await listProjects());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  function handleRequestDelete(project: Project) {
    if (actionPendingId) {
      return;
    }
    setDeleteError(undefined);
    setDeleteTarget(project);
  }

  function handleCancelDelete() {
    setDeleteTarget(null);
  }

  async function handleConfirmDelete() {
    const project = deleteTarget;

    if (!project || actionPendingId) {
      return;
    }

    setDeleteError(undefined);
    setActionPendingId(project.id);

    try {
      await deleteProject(project.id);
    } catch {
      setDeleteError(DELETE_FAILED_MESSAGE);
      setActionPendingId(null);
      setDeleteTarget(null);
      return;
    }

    // La suppression a réussi : un échec du rechargement ci-dessous n'est pas un
    // échec de la suppression (même pattern que handleSubmit / Story 2.2).
    setActionPendingId(null);
    setDeleteTarget(null);

    try {
      setProjects(await listProjects());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Projets</h1>

      <div className={styles.headerActions}>
        {!formOpen && !editTarget && (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={openForm}
          >
            Nouveau projet
          </button>
        )}

        {(active.length > 0 || archived.length > 0) && (
          <div
            className={styles.statusToggle}
            role="group"
            aria-label="Filtrer les projets par statut"
          >
            <button
              type="button"
              className={styles.statusToggleItem}
              data-active={statusFilter === "active"}
              aria-pressed={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              Actifs ({active.length})
            </button>
            <button
              type="button"
              className={styles.statusToggleItem}
              data-active={statusFilter === "archived"}
              aria-pressed={statusFilter === "archived"}
              onClick={() => setStatusFilter("archived")}
            >
              Archivés ({archived.length})
            </button>
          </div>
        )}
      </div>

      {formOpen && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="project-name">
              Nom
            </label>
            <input
              className={styles.input}
              id="project-name"
              name="name"
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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="project-description">
              Description
            </label>
            <textarea
              className={styles.textarea}
              id="project-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
            />
          </div>

          {submitError && (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={closeForm}
              disabled={pending}
            >
              Annuler
            </button>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={pending}
            >
              Créer
            </button>
          </div>
        </form>
      )}

      {editTarget && (
        <form className={styles.form} onSubmit={handleEditSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-project-name">
              Nom
            </label>
            <input
              className={styles.input}
              id="edit-project-name"
              name="name"
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              disabled={editPending}
            />
            {editNameError && (
              <p className={styles.error} role="alert">
                {editNameError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-project-description">
              Description
            </label>
            <textarea
              className={styles.textarea}
              id="edit-project-description"
              name="description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              disabled={editPending}
            />
          </div>

          {editSubmitError && (
            <p className={styles.error} role="alert">
              {editSubmitError}
            </p>
          )}

          <div className={styles.actions}>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={closeEdit}
              disabled={editPending}
            >
              Annuler
            </button>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={editPending}
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {!loading && active.length === 0 && archived.length === 0 && !loadError && (
        <p className={styles.empty}>{EMPTY_MESSAGE}</p>
      )}

      {/* Onglet Actifs — « Hors projet » y est épinglé en première ligne et toujours présent,
          même sans aucune tâche générale et même sans aucun projet réel (choix de Guillaume :
          "toujours actif, en en-tête de projet, première ligne"). Rendu ici plutôt que
          concaténé à `active` : ce n'est pas un Project, il n'a ni statut, ni actions de
          ligne, et il ne doit jamais entrer dans les compteurs "Actifs (n)". Absent de
          l'onglet Archivés — l'entrée n'est pas archivable, elle n'y aurait aucun sens. */}
      {statusFilter === "active" && (
        <ul className={styles.projectList}>
          <GeneralProjectRow taskCount={generalTaskCount} />
          {active.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              pending={actionPendingId === project.id}
              onArchive={handleArchive}
              onRequestUnarchive={handleRequestUnarchive}
              onEdit={openEdit}
              onRequestDelete={handleRequestDelete}
            />
          ))}
        </ul>
      )}

      {statusFilter === "archived" &&
        (archived.length > 0 ? (
          <ul className={styles.projectList}>
            {archived.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                pending={actionPendingId === project.id}
                onArchive={handleArchive}
                onRequestUnarchive={handleRequestUnarchive}
                onEdit={openEdit}
                onRequestDelete={handleRequestDelete}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Aucun projet archivé.</p>
        ))}

      {loadError && (
        <p className={styles.error} role="alert">
          {LOAD_FAILED_MESSAGE}
        </p>
      )}

      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Réactiver ce projet ?"
        confirmLabel="Réactiver"
        cancelLabel="Annuler"
        onConfirm={handleConfirmUnarchive}
        onCancel={handleCancelUnarchive}
        pending={confirmTarget !== null && actionPendingId === confirmTarget.id}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer définitivement ce projet ?"
        description={
          deleteTarget
            ? `« ${deleteTarget.name} » sera supprimé définitivement, avec ses notes et ses documents. Ses tâches sont conservées et basculent dans « Hors projet ». Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer définitivement"
        cancelLabel="Annuler"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        pending={deleteTarget !== null && actionPendingId === deleteTarget.id}
      />
    </main>
  );
}

// Entrée virtuelle « Hors projet » en tête de la liste (cf. app/projects/hors-projet/
// page.tsx). Volontairement dépourvue des actions Modifier/Archiver/Supprimer : elle
// n'existe pas en base, il n'y a donc rien à renommer, archiver ni supprimer — c'est ce qui
// la rend fiable comme point de chute des tâches sans projet.
function GeneralProjectRow({ taskCount }: { taskCount: number | null }) {
  return (
    <li className={styles.projectCard} data-pinned="true">
      <Link href={`/projects/${NO_PROJECT_FILTER_ID}`} className={styles.projectName}>
        {GENERAL_PROJECT_NAME}
      </Link>
      {taskCount !== null && (
        <span className={styles.statusPill}>
          {taskCount === 0 ? "Aucune tâche" : `${taskCount} tâche${taskCount > 1 ? "s" : ""}`}
        </span>
      )}
    </li>
  );
}

function ProjectRow({
  project,
  pending,
  onArchive,
  onRequestUnarchive,
  onEdit,
  onRequestDelete,
}: {
  project: Project;
  pending: boolean;
  onArchive: (project: Project) => void;
  onRequestUnarchive: (project: Project) => void;
  onEdit: (project: Project) => void;
  onRequestDelete: (project: Project) => void;
}) {
  return (
    <li className={styles.projectCard}>
      <Link href={`/projects/${project.id}`} className={styles.projectName}>
        {project.name}
      </Link>
      <span className={styles.statusPill} data-status={project.status}>
        {STATUS_LABELS[project.status]}
      </span>
      <button
        type="button"
        className={styles.rowAction}
        onClick={() => onEdit(project)}
        disabled={pending}
      >
        Modifier
      </button>
      {project.status === "active" ? (
        <button
          type="button"
          className={styles.rowAction}
          onClick={() => onArchive(project)}
          disabled={pending}
        >
          Archiver
        </button>
      ) : (
        <>
          <button
            type="button"
            className={styles.rowAction}
            onClick={() => onRequestUnarchive(project)}
            disabled={pending}
          >
            Désarchiver
          </button>
          <button
            type="button"
            className={styles.deleteAction}
            onClick={() => onRequestDelete(project)}
            disabled={pending}
          >
            Supprimer définitivement
          </button>
        </>
      )}
    </li>
  );
}
