"use client";

// app/capture-flow.tsx — FAB "+" persistant + flux de capture en 3 étapes
// (Projet → Priorité → Type), UX-DR10/UX-DR14. Tâche (Story 3.1), Note texte (Story 5.1),
// Note vocale (Story 5.2) et Document (Story 6.1, ajout uniquement — liste/consultation en
// Story 6.2) sont fonctionnels.
// Vit dans app/ (pas components/) : seul app/ a le droit d'importer data/local/
// directement (AD-2, ARCHITECTURE-SPINE.md — cf. Review Findings Story 3.1), et ce
// composant a besoin d'appeler listProjects()/createTask() lui-même (Dexie est
// accessible uniquement client-side, un layout serveur ne peut pas les lui fournir).
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import {
  captureTypeRequiresProject,
  validateTaskTitle,
  validateNoteContent,
  canSetReminder,
  groupProjectsByStatus,
  MAX_AUDIO_SIZE_BYTES,
  validateDocumentSize,
  type CaptureType,
  type Note,
  type Priority,
  type Project,
} from "@/domain";
import {
  listProjects,
  createTask,
  createNote,
  createVoiceNote,
  createDocument,
  updateNoteTranscription,
  markTranscriptionPending,
  clearTranscriptionPending,
} from "@/data/local";
import { detectProvenance } from "@/lib/device";
import styles from "./capture-flow.module.css";

const LOGIN_PATH = "/login";

const PROJECT_REQUIRED_MESSAGE =
  "Un projet est requis pour une note ou un document.";
const NO_PROJECTS_MESSAGE = "Aucun projet pour l'instant.";
const PROJECTS_LOAD_FAILED_MESSAGE =
  "Impossible de charger vos projets. Réessayez.";
const TITLE_REQUIRED_MESSAGE = "Le titre de la tâche est obligatoire.";
const NOTE_CONTENT_REQUIRED_MESSAGE = "Le contenu de la note est obligatoire.";
const SUBMIT_FAILED_MESSAGE = "La capture a échoué. Réessayez.";
const SUCCESS_MESSAGE = "Enregistré.";
const SUCCESS_CLOSE_DELAY_MS = 800;
const MIC_UNAVAILABLE_MESSAGE =
  "Micro indisponible — les autres captures restent possibles.";
const AUDIO_SIZE_CAPPED_MESSAGE =
  "Enregistrement arrêté : taille maximale de 20 Mo atteinte.";
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  return AUDIO_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Formatage taille de fichier (FR-18/FR-19 "taille") — Ko sous 1 Mo (revue de code : un
// fichier de quelques Ko affichait "0,0 Mo" en une décimale, illisible d'un fichier vide/raté),
// Mo à 1 décimale au-delà, virgule française (cohérent avec formatDueDate,
// app/projects/[id]/project-view.tsx, qui utilise déjà "fr-FR").
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(1).replace(".", ",")} Mo`;
}

// Message explicite listant le(s) fichier(s) ignoré(s) (AC#2) — plusieurs fichiers peuvent
// être sélectionnés en une fois (attribut `multiple`), certains peuvent dépasser 20 Mo pendant
// que d'autres restent valides : rejeter tout le lot serait plus strict que nécessaire, le
// message précise donc lesquels sont concernés plutôt qu'un message générique.
function tooLargeMessage(rejectedFiles: readonly File[]): string {
  const names = rejectedFiles.map((file) => file.name).join(", ");
  return rejectedFiles.length === 1
    ? `"${names}" dépasse la taille maximale autorisée (20 Mo) — ignoré.`
    : `${rejectedFiles.length} fichiers dépassent la taille maximale autorisée (20 Mo) — ignorés : ${names}.`;
}

// Distinct de tooLargeMessage (revue de code) : un fichier vide (0 octet) est rejeté par
// validateDocumentSize au même titre qu'un fichier trop volumineux, mais afficher "dépasse la
// taille maximale" pour un fichier de 0 octet est trompeur — l'utilisateur peut croire à un
// bug de sélection plutôt qu'à un fichier réellement vide.
function emptyFileMessage(emptyFiles: readonly File[]): string {
  const names = emptyFiles.map((file) => file.name).join(", ");
  return emptyFiles.length === 1
    ? `"${names}" est vide — ignoré.`
    : `${emptyFiles.length} fichiers vides — ignorés : ${names}.`;
}

const TRANSCRIBE_AUDIO_ENDPOINT = "/api/sync/transcribe-audio";

// POST le blob brut (Content-Type = son type MIME réel) vers la route de transcription et
// retourne le texte — réutilisée à l'identique dans app/projects/[id]/project-view.tsx
// (NoteDetail), dupliquée plutôt que partagée via un nouveau module (cf. Dev Notes Story 5.3 :
// même précédent que MAX_AUDIO_SIZE_BYTES/openNote, duplication assumée pour une poignée de
// lignes utilisées par exactement deux call sites).
async function requestTranscription(blob: Blob): Promise<string> {
  const response = await fetch(TRANSCRIBE_AUDIO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error("transcription request failed");
  }
  const result = (await response.json()) as { text: string };
  return result.text;
}

const PRIORITY_OPTIONS: readonly { value: Priority; label: string }[] = [
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
];

// Ordre de FR-4 : note texte, note vocale, tâche, ou document.
const TYPE_OPTIONS: readonly { value: CaptureType; label: string }[] = [
  { value: "note-text", label: "Note texte" },
  { value: "voice-note", label: "Note vocale" },
  { value: "task", label: "Tâche" },
  { value: "document", label: "Document" },
];

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

type Step = 1 | 2 | 3;

export function CaptureFlow() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoadError, setProjectsLoadError] = useState(false);
  const [projectSelection, setProjectSelection] = useState<
    string | "none" | null
  >(null);
  const [projectRequiredMessage, setProjectRequiredMessage] = useState<
    string | undefined
  >();
  const [priority, setPriority] = useState<Priority | null>(null);
  const [type, setType] = useState<CaptureType | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [noteContent, setNoteContent] = useState("");
  const [noteContentError, setNoteContentError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  type MicState = "idle" | "requesting" | "recording" | "recorded" | "unavailable";
  const [micState, setMicState] = useState<MicState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioSizeCapped, setAudioSizeCapped] = useState(false);
  const [transcribeAtCreation, setTranscribeAtCreation] = useState(false);
  // Tableau (pas un seul File) : plusieurs documents peuvent être ajoutés en une fois (retour
  // utilisateur en vérification manuelle de la Story 6.1) — accumule les sélections successives
  // au lieu de remplacer, cf. handleFilesChange.
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentFileError, setDocumentFileError] = useState<string | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBytesRef = useRef(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Jeton d'annulation — incrémenté à chaque `stopRecordingStream()` (Retour, fermeture,
  // démontage). Une résolution tardive de `getUserMedia()` compare son jeton capturé à la
  // valeur courante pour détecter que l'utilisateur a déjà quitté l'étape d'enregistrement
  // pendant l'attente de la permission, et ne doit pas rouvrir le micro (trouvé en revue de
  // code, Story 5.2).
  const recordingTokenRef = useRef(0);
  // Input fichier natif masqué (styles.visuallyHidden) — déclenché par un bouton stylé plutôt
  // que par le bouton natif du navigateur ("Sélect. fichiers" + "Aucun fichier choisi"), devenu
  // redondant avec la liste des fichiers déjà sélectionnés affichée juste en dessous (retour
  // utilisateur en vérification manuelle, Story 6.1).
  const documentFileInputRef = useRef<HTMLInputElement>(null);

  // Contenu de l'étape courante uniquement (exclut le header/bouton "Fermer") — cf.
  // Review Findings Story 3.1 : cibler panelRef entier faisait toujours matcher "Fermer".
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function clearSuccessTimeout() {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }

  function stopRecordingStream() {
    recordingTokenRef.current += 1;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Détache les gestionnaires avant d'arrêter explicitement : sans ça, un stop()
      // déclenché ici (abandon via "Retour"/fermeture/démontage) rejouerait onstop et
      // écraserait l'état qu'on est justement en train de réinitialiser avec un blob non
      // désiré (trouvé en revue de code, Story 5.2). Appelé depuis le propre `onstop` du
      // recorder (fin normale d'enregistrement), `state` est déjà "inactive" à ce stade —
      // cette branche est alors ignorée, seul le nettoyage du flux/des refs ci-dessous
      // s'applique.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  // Restaure le focus sur l'élément déclencheur (le FAB) à la fermeture.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  // Focus sur le premier élément interactif du contenu de l'étape courante
  // (jamais le bouton "Fermer" du header, hors du périmètre de contentRef).
  useEffect(() => {
    if (!open) {
      return;
    }
    const first = contentRef.current?.querySelector<HTMLElement>(
      FOCUSABLE_SELECTOR,
    );
    first?.focus();
  }, [open, step, type, success, micState]);

  useEffect(() => {
    return () => {
      clearSuccessTimeout();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopRecordingStream();
    };
  }, []);

  // URL de prévisualisation de l'enregistrement (Story 5.2). `URL.createObjectURL` est
  // synchrone (contrairement à la lecture du blob local depuis IndexedDB de
  // app/projects/[id]/project-view.tsx, qui reste asynchrone et donc dans un effet) —
  // useMemo est la façon idiomatique de la dériver sans déclencher de setState synchrone
  // dans un effet (react-hooks/set-state-in-effect). La révocation reste gérée par un effet
  // dédié ci-dessous, pour ne jamais fuir une URL blob entre deux enregistrements successifs.
  const recordedAudioUrl = useMemo(
    () => (recordedBlob ? URL.createObjectURL(recordedBlob) : null),
    [recordedBlob],
  );

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  if (pathname === LOGIN_PATH) {
    return null;
  }

  function resetState() {
    clearSuccessTimeout();
    setStep(1);
    setProjectSelection(null);
    setProjectRequiredMessage(undefined);
    setPriority(null);
    setType(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setReminderAt("");
    setTitleError(undefined);
    setNoteContent("");
    setNoteContentError(undefined);
    setSubmitError(undefined);
    setPending(false);
    setSuccess(false);
    stopRecordingStream();
    setMicState("idle");
    setRecordedBlob(null);
    setRecordingSeconds(0);
    setAudioSizeCapped(false);
    setTranscribeAtCreation(false);
    setDocumentFiles([]);
    setDocumentFileError(undefined);
    audioChunksRef.current = [];
    recordedBytesRef.current = 0;
  }

  async function openFlow() {
    resetState();
    try {
      const data = await listProjects();
      setProjects(data);
      setProjectsLoadError(false);
    } catch {
      setProjects([]);
      setProjectsLoadError(true);
    }
    setOpen(true);
  }

  function closeFlow() {
    clearSuccessTimeout();
    // Coupe un enregistrement éventuellement en cours (ou une demande de permission en
    // attente) — sans ça, fermer le flux via "✕" pendant l'enregistrement laissait le micro
    // actif en arrière-plan, contrairement à "Retour" qui le fait déjà (trouvé en revue de
    // code, Story 5.2).
    stopRecordingStream();
    setOpen(false);
  }

  // Sélectionner = valider (retour Guillaume : "chaque clic doit avancer directement à
  // l'étape suivante, pas de double validation projet→Continuer/priorité→Continuer") — ces
  // trois fonctions combinent désormais la sélection et l'avancée d'étape en un seul clic ;
  // seul "Retour" reste disponible pour corriger un choix (cf. JSX ci-dessous, boutons
  // "Continuer" retirés des étapes 1/2/3-type).
  function selectProject(selection: string | "none") {
    setProjectSelection(selection);
    setProjectRequiredMessage(undefined);
    setStep(2);
  }

  function selectPriority(value: Priority) {
    setPriority(value);
    setStep(3);
  }

  function selectType(selectedType: CaptureType) {
    if (captureTypeRequiresProject(selectedType) && projectSelection === "none") {
      setStep(1);
      setProjectRequiredMessage(PROJECT_REQUIRED_MESSAGE);
      return;
    }

    setType(selectedType);
  }

  function handleBackToTypeSelection() {
    // Abandonne un enregistrement éventuellement en cours (Story 5.2) — sans ça, un "Retour"
    // pendant l'enregistrement laisserait le micro actif en arrière-plan.
    stopRecordingStream();
    setMicState("idle");
    setRecordedBlob(null);
    setRecordingSeconds(0);
    setAudioSizeCapped(false);
    setTranscribeAtCreation(false);
    setDocumentFiles([]);
    setDocumentFileError(undefined);
    audioChunksRef.current = [];
    recordedBytesRef.current = 0;
    setType(null);
    // submitError est partagé entre les formulaires Tâche/Note/Note vocale (handleSubmitTask/
    // handleSubmitNote/handleSubmitVoiceNote) — sans ce reset, un échec sur l'un reste affiché
    // sous l'autre après un changement de type via "Retour" (trouvé en revue de code, Story 5.1).
    setSubmitError(undefined);
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.target.value);
    if (titleError) {
      setTitleError(undefined);
    }
  }

  function handleDueDateChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDueDate(value);
    if (!value) {
      setReminderAt("");
    }
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    // Réinitialise la valeur de l'input tout de suite : un `<input type="file">` ne redéclenche
    // jamais onChange pour une resélection du même fichier tant que sa valeur n'est pas vidée
    // entre-temps — nécessaire pour pouvoir rouvrir le sélecteur plusieurs fois de suite.
    event.target.value = "";
    if (selected.length === 0) {
      // Sélecteur rouvert puis annulé (aucun fichier choisi) : efface un message d'erreur
      // laissé par une sélection précédente plutôt que de le laisser affiché indéfiniment
      // (trouvé en revue de code — l'ancien comportement retournait ici sans y toucher).
      setDocumentFileError(undefined);
      return;
    }
    const validFiles = selected.filter((file) => validateDocumentSize(file.size));
    // Fichier vide (0 octet) distingué d'un fichier réellement trop volumineux (trouvé en
    // revue de code) : les deux sont rejetés par validateDocumentSize (sizeBytes > 0), mais
    // "dépasse la taille maximale" est un message trompeur pour un fichier vide.
    const emptyFiles = selected.filter((file) => file.size === 0);
    const tooLargeFiles = selected.filter(
      (file) => file.size > 0 && !validateDocumentSize(file.size),
    );
    // Accumule (pas de remplacement) : rouvrir le sélecteur pour ajouter d'autres fichiers ne
    // doit jamais effacer ceux déjà choisis (retour utilisateur en vérification manuelle).
    setDocumentFiles((existing) => [...existing, ...validFiles]);
    const rejectionMessages = [
      emptyFiles.length > 0 ? emptyFileMessage(emptyFiles) : null,
      tooLargeFiles.length > 0 ? tooLargeMessage(tooLargeFiles) : null,
    ].filter((message): message is string => message !== null);
    setDocumentFileError(rejectionMessages.length > 0 ? rejectionMessages.join(" ") : undefined);
  }

  function handleRemoveDocumentFile(index: number) {
    setDocumentFiles((existing) => existing.filter((_, fileIndex) => fileIndex !== index));
  }

  async function handleSubmitTask() {
    if (pending) {
      return;
    }

    if (!validateTaskTitle(title)) {
      setTitleError(TITLE_REQUIRED_MESSAGE);
      return;
    }

    setTitleError(undefined);
    setSubmitError(undefined);
    setPending(true);

    try {
      // Conversion en ISO 8601 UTC à l'intérieur du try : une valeur de date invalide fait
      // lever `.toISOString()` (RangeError), désormais interceptée comme tout autre échec.
      // `dueDate` est ancré en minuit *local* (ajout de "T00:00", même règle de parsing que
      // le champ datetime-local) plutôt qu'en minuit UTC, pour rester cohérent avec
      // `reminderAt` — cf. Review Findings Story 3.1 (incohérence d'ancrage UTC).
      const dueDateIso = dueDate
        ? new Date(`${dueDate}T00:00`).toISOString()
        : null;
      const reminderAtIso = reminderAt
        ? new Date(reminderAt).toISOString()
        : null;

      await createTask({
        projectId: projectSelection === "none" ? null : projectSelection,
        title,
        description,
        dueDate: dueDateIso,
        reminderAt: reminderAtIso,
        priority: priority as Priority,
        provenance: detectProvenance(),
      });
    } catch {
      setSubmitError(SUBMIT_FAILED_MESSAGE);
      setPending(false);
      return;
    }

    setPending(false);
    setSuccess(true);
    successTimeoutRef.current = setTimeout(() => {
      successTimeoutRef.current = null;
      setOpen(false);
    }, SUCCESS_CLOSE_DELAY_MS);
  }

  async function handleSubmitNote() {
    if (pending) {
      return;
    }

    if (!validateNoteContent(noteContent)) {
      setNoteContentError(NOTE_CONTENT_REQUIRED_MESSAGE);
      return;
    }

    setNoteContentError(undefined);
    setSubmitError(undefined);
    setPending(true);

    try {
      // projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject("note-text")
      // est true, selectType a déjà renvoyé à l'étape 1 avec un message si "none" était
      // sélectionné (cf. Story 3.1, comportement inchangé).
      await createNote({
        projectId: projectSelection as string,
        content: noteContent,
        priority: priority as Priority,
        provenance: detectProvenance(),
      });
    } catch {
      setSubmitError(SUBMIT_FAILED_MESSAGE);
      setPending(false);
      return;
    }

    setPending(false);
    setSuccess(true);
    successTimeoutRef.current = setTimeout(() => {
      successTimeoutRef.current = null;
      setOpen(false);
    }, SUCCESS_CLOSE_DELAY_MS);
  }

  async function handleStartRecording() {
    // Garde de réentrance — un double-clic avant le prochain rendu (le `disabled` du bouton
    // ne se propage qu'après React re-render) déclencherait deux `getUserMedia()` et fuirait
    // le premier flux (trouvé en revue de code, Story 5.2).
    if (micState === "requesting" || micState === "recording") {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicState("unavailable");
      return;
    }

    setMicState("requesting");
    const token = ++recordingTokenRef.current;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Refus utilisateur (NotAllowedError) ou aucun micro disponible (NotFoundError) — même
      // état dégradé dans les deux cas (AC#3, NFR-4) : aucune distinction utile pour Guillaume.
      if (token === recordingTokenRef.current) {
        setMicState("unavailable");
      }
      return;
    }

    // L'utilisateur a déjà quitté cette étape (Retour, fermeture) pendant que la demande de
    // permission était en attente — la promesse se résout après coup et ne doit pas rouvrir
    // le micro sur une étape déjà abandonnée (trouvé en revue de code, Story 5.2).
    if (token !== recordingTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    mediaStreamRef.current = stream;
    audioChunksRef.current = [];
    recordedBytesRef.current = 0;
    setAudioSizeCapped(false);

    const mimeType = pickAudioMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      // Construction du MediaRecorder en échec (bug navigateur, combinaison de contraintes
      // inattendue) — libère le flux déjà acquis plutôt que de le laisser fuir (trouvé en
      // revue de code, Story 5.2).
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setMicState("unavailable");
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) {
        return;
      }
      recordedBytesRef.current += event.data.size;
      audioChunksRef.current.push(event.data);
      // Coupure en temps réel au plafond (NFR-10, AD-5 "vérifiée à la capture") — rendue
      // possible par le `timeslice` passé à start() ci-dessous : sans lui, ondataavailable ne
      // se déclenche qu'une seule fois, à stop(), avec la totalité de l'enregistrement déjà
      // bufferisée (trouvé en revue de code, Story 5.2— l'ancienne version de ce code ne
      // coupait donc jamais réellement "en temps réel").
      if (recordedBytesRef.current > MAX_AUDIO_SIZE_BYTES) {
        setAudioSizeCapped(true);
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: mimeType ?? audioChunksRef.current[0]?.type ?? "audio/webm",
      });
      stopRecordingStream();
      if (blob.size === 0) {
        // Enregistrement vide (arrêté quasi instantanément) — rien à prévisualiser ni à
        // soumettre ; retour silencieux à l'état initial plutôt qu'un état "recorded" sans
        // contenu affichant à tort le message de dépassement de taille (trouvé en revue de
        // code, Story 5.2).
        setMicState("idle");
        return;
      }
      setRecordedBlob(blob);
      setMicState("recorded");
    };

    recorder.onerror = () => {
      // Panne du MediaRecorder en cours d'enregistrement (déconnexion du périphérique, erreur
      // d'encodage...) — même état dégradé que le refus de permission, plutôt que de laisser
      // micState bloqué sur "recording" indéfiniment sans retour utilisateur (trouvé en revue
      // de code, Story 5.2).
      stopRecordingStream();
      setMicState("unavailable");
    };

    // `timeslice` = 1000ms : ondataavailable se déclenche chaque seconde pendant
    // l'enregistrement (pas seulement à l'arrêt) — cf. commentaire du plafond ci-dessus.
    recorder.start(1000);
    setMicState("recording");
    setRecordingSeconds(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function handleDiscardRecording() {
    setRecordedBlob(null);
    setRecordingSeconds(0);
    setAudioSizeCapped(false);
    audioChunksRef.current = [];
    recordedBytesRef.current = 0;
    setMicState("idle");
  }

  async function handleSubmitVoiceNote() {
    if (pending || !recordedBlob) {
      return;
    }

    setSubmitError(undefined);
    setPending(true);

    let createdNote: Note;
    try {
      // projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject("voice-note")
      // est true, même garde-fou que pour "note-text" (cf. Story 5.1, selectType).
      createdNote = await createVoiceNote({
        projectId: projectSelection as string,
        priority: priority as Priority,
        provenance: detectProvenance(),
        audioBlob: recordedBlob,
      });
    } catch {
      setSubmitError(SUBMIT_FAILED_MESSAGE);
      setPending(false);
      return;
    }

    // Transcription à la création (FR-17) : best-effort, ne bloque jamais la création
    // elle-même ni la fermeture du flux (SUCCESS_CLOSE_DELAY_MS, 800ms — largement plus court
    // que l'aller-retour réseau + inférence OpenAI dans l'immense majorité des cas). Réutilise
    // le blob déjà en mémoire (recordedBlob), pas de relecture Dexie. Le marqueur
    // markTranscriptionPending est posé AVANT l'appel réseau et retiré seulement après l'écriture
    // Dexie réussie — s'il survit (échec, ou onglet fermé entre la réponse OpenAI et l'écriture),
    // sync/client.ts le retentera automatiquement au prochain cycle (revue de code : corrige une
    // perte silencieuse de transcription, cf. Dev Notes).
    if (transcribeAtCreation) {
      const noteId = createdNote.id;
      void markTranscriptionPending(noteId).then(() =>
        requestTranscription(recordedBlob)
          .then((text) => updateNoteTranscription(noteId, text))
          .then(() => clearTranscriptionPending(noteId))
          .catch(() => {
            // Marqueur laissé en place — retenté par sync/client.ts, note reste "audio seul"
            // entre-temps, récupérable aussi depuis le détail (cf. Dev Notes).
          }),
      );
    }

    setPending(false);
    setSuccess(true);
    successTimeoutRef.current = setTimeout(() => {
      successTimeoutRef.current = null;
      setOpen(false);
    }, SUCCESS_CLOSE_DELAY_MS);
  }

  async function handleSubmitDocument() {
    if (pending || documentFiles.length === 0) {
      return;
    }

    setSubmitError(undefined);
    setPending(true);

    // Séquentiel (pas Promise.all) : chaque createDocument écrit dans sa propre transaction
    // Dexie ; en cas d'échec sur un fichier, les précédents restent créés (jamais annulés en
    // bloc) — cohérent avec l'esprit local-first (ne jamais perdre ce qui a déjà été capturé
    // avec succès). projectSelection ne peut pas valoir "none" ici : captureTypeRequiresProject
    // ("document") est true, même garde-fou que pour "note-text"/"voice-note" (Story 5.1/5.2).
    let succeededCount = 0;
    try {
      for (const file of documentFiles) {
        await createDocument({
          projectId: projectSelection as string,
          priority: priority as Priority,
          provenance: detectProvenance(),
          file,
        });
        succeededCount += 1;
      }
    } catch {
      // Retire de la sélection les fichiers déjà créés avec succès avant d'afficher l'erreur —
      // sans ça, un nouveau clic sur "Créer" les resoumettrait aussi, créant des documents en
      // double pour un même fichier (trouvé en revue de code). Seuls le fichier en échec et les
      // suivants, jamais tentés, restent dans la sélection pour un nouvel essai.
      setDocumentFiles((existing) => existing.slice(succeededCount));
      setSubmitError(SUBMIT_FAILED_MESSAGE);
      setPending(false);
      return;
    }

    setPending(false);
    setSuccess(true);
    successTimeoutRef.current = setTimeout(() => {
      successTimeoutRef.current = null;
      setOpen(false);
    }, SUCCESS_CLOSE_DELAY_MS);
  }

  const { active: activeProjects } = groupProjectsByStatus(projects);

  function stepTitle(): string {
    if (step === 1) {
      return "Choisissez un projet";
    }
    if (step === 2) {
      return "Quelle est la priorité ?";
    }
    if (type === "task") {
      return "Nouvelle tâche";
    }
    if (type === "note-text") {
      return "Nouvelle note";
    }
    if (type === "voice-note") {
      return "Nouvelle note vocale";
    }
    if (type === "document") {
      return "Nouveau document";
    }
    return "Que voulez-vous créer ?";
  }

  return (
    <>
      <button
        className={styles.fab}
        type="button"
        aria-label="Capturer"
        onClick={openFlow}
      >
        <span aria-hidden="true">+</span>
      </button>

      {open && (
        <div className={styles.backdrop}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-flow-title"
          >
            <div className={styles.header}>
              <h2 id="capture-flow-title" className={styles.title}>
                {stepTitle()}
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Fermer"
                onClick={closeFlow}
                disabled={pending}
              >
                ✕
              </button>
            </div>

            <StepIndicator step={step} />

            <div ref={contentRef}>
              {step === 1 && (
                <div className={styles.stepBody}>
                  {projectsLoadError && (
                    <p className={styles.error} role="alert">
                      {PROJECTS_LOAD_FAILED_MESSAGE}
                    </p>
                  )}

                  {projectRequiredMessage && (
                    <p className={styles.error} role="alert">
                      {projectRequiredMessage}
                    </p>
                  )}

                  {!projectsLoadError && activeProjects.length === 0 && (
                    <p className={styles.empty}>{NO_PROJECTS_MESSAGE}</p>
                  )}

                  {activeProjects.length > 0 && (
                    <div className={styles.optionList}>
                      {activeProjects.map((project) => (
                        <OptionButton
                          key={project.id}
                          label={project.name}
                          selected={projectSelection === project.id}
                          swatchColor={`var(--color-${project.color})`}
                          onClick={() => selectProject(project.id)}
                        />
                      ))}
                    </div>
                  )}

                  <OptionButton
                    label="Sans projet (tâche uniquement)"
                    selected={projectSelection === "none"}
                    onClick={() => selectProject("none")}
                  />
                </div>
              )}

              {step === 2 && (
                <div className={styles.stepBody}>
                  <div className={styles.optionList}>
                    {PRIORITY_OPTIONS.map((option) => (
                      <OptionButton
                        key={option.value}
                        label={option.label}
                        selected={priority === option.value}
                        priority={option.value}
                        onClick={() => selectPriority(option.value)}
                      />
                    ))}
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => setStep(1)}
                    >
                      Retour
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && type === null && (
                <div className={styles.stepBody}>
                  <div className={styles.optionList}>
                    {TYPE_OPTIONS.map((option) => (
                      <OptionButton
                        key={option.value}
                        label={option.label}
                        selected={false}
                        onClick={() => selectType(option.value)}
                      />
                    ))}
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => setStep(2)}
                    >
                      Retour
                    </button>
                  </div>
                </div>
              )}

              {step === 3 &&
                (type === "task" || type === "note-text" || type === "voice-note" || type === "document") &&
                success && (
                <div className={styles.stepBody}>
                  <p className={styles.success}>{SUCCESS_MESSAGE}</p>
                </div>
              )}

              {step === 3 && type === "task" && !success && (
                <div className={styles.stepBody}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-title">
                      Titre
                    </label>
                    <input
                      className={styles.input}
                      id="task-title"
                      type="text"
                      value={title}
                      onChange={handleTitleChange}
                      disabled={pending}
                    />
                    {titleError && (
                      <p className={styles.error} role="alert">
                        {titleError}
                      </p>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-description">
                      Description
                    </label>
                    <textarea
                      className={styles.textarea}
                      id="task-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      disabled={pending}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-due-date">
                      Échéance
                    </label>
                    <input
                      className={styles.input}
                      id="task-due-date"
                      type="date"
                      value={dueDate}
                      onChange={handleDueDateChange}
                      disabled={pending}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="task-reminder">
                      Rappel
                    </label>
                    <input
                      className={styles.input}
                      id="task-reminder"
                      type="datetime-local"
                      value={reminderAt}
                      onChange={(event) => setReminderAt(event.target.value)}
                      disabled={pending || !canSetReminder(dueDate)}
                    />
                  </div>

                  {submitError && (
                    <p className={styles.error} role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={handleBackToTypeSelection}
                      disabled={pending}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSubmitTask}
                      disabled={pending}
                    >
                      Créer
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && type === "note-text" && !success && (
                <div className={styles.stepBody}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="note-content">
                      Texte
                    </label>
                    <textarea
                      className={styles.textarea}
                      id="note-content"
                      value={noteContent}
                      onChange={(event) => {
                        setNoteContent(event.target.value);
                        if (noteContentError) {
                          setNoteContentError(undefined);
                        }
                      }}
                      disabled={pending}
                    />
                    {noteContentError && (
                      <p className={styles.error} role="alert">
                        {noteContentError}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <p className={styles.error} role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={handleBackToTypeSelection}
                      disabled={pending}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSubmitNote}
                      disabled={pending}
                    >
                      Créer
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && type === "voice-note" && !success && (
                <div className={styles.stepBody}>
                  {micState === "unavailable" && (
                    <p className={styles.error} role="alert">
                      {MIC_UNAVAILABLE_MESSAGE}
                    </p>
                  )}

                  {(micState === "idle" || micState === "requesting") && (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleStartRecording}
                        disabled={pending || micState === "requesting"}
                      >
                        Démarrer l&apos;enregistrement
                      </button>
                    </div>
                  )}

                  {micState === "recording" && (
                    <div className={styles.recordingRow}>
                      <span className={styles.recordingDot} aria-hidden="true" />
                      <span className={styles.recordingTimer} role="status" aria-live="polite">
                        {formatRecordingTime(recordingSeconds)}
                      </span>
                      <button type="button" className={styles.primaryButton} onClick={handleStopRecording}>
                        Arrêter
                      </button>
                    </div>
                  )}

                  {micState === "recorded" && recordedAudioUrl && (
                    <div className={styles.field}>
                      {audioSizeCapped && (
                        <p className={styles.error} role="alert">
                          {AUDIO_SIZE_CAPPED_MESSAGE}
                        </p>
                      )}
                      <audio className={styles.audioPreview} controls src={recordedAudioUrl} />
                      <label className={styles.transcribeOption}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={transcribeAtCreation}
                          onChange={(event) => setTranscribeAtCreation(event.target.checked)}
                          disabled={pending}
                        />
                        <span className={styles.checkboxBox} aria-hidden="true" />
                        Générer la transcription
                      </label>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={handleDiscardRecording}
                          disabled={pending}
                        >
                          Recommencer
                        </button>
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <p className={styles.error} role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={handleBackToTypeSelection}
                      disabled={pending}
                    >
                      Retour
                    </button>
                    {micState === "recorded" && (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSubmitVoiceNote}
                        disabled={pending}
                      >
                        Créer
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && type === "document" && !success && (
                <div className={styles.stepBody}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="document-file">
                      Fichier(s)
                    </label>
                    <input
                      ref={documentFileInputRef}
                      className={styles.visuallyHidden}
                      id="document-file"
                      type="file"
                      multiple
                      onChange={handleFilesChange}
                      disabled={pending}
                    />
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => documentFileInputRef.current?.click()}
                      disabled={pending}
                    >
                      Choisir des fichiers
                    </button>
                    {documentFiles.length > 0 && (
                      <ul className={styles.fileList}>
                        {documentFiles.map((file, index) => (
                          <li key={`${file.name}-${index}`} className={styles.fileRow}>
                            <span className={styles.fileInfo}>
                              {file.name} · {formatFileSize(file.size)}
                            </span>
                            <button
                              type="button"
                              className={styles.removeFileButton}
                              onClick={() => handleRemoveDocumentFile(index)}
                              disabled={pending}
                              aria-label={`Retirer ${file.name}`}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {documentFileError && (
                      <p className={styles.error} role="alert">
                        {documentFileError}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <p className={styles.error} role="alert">
                      {submitError}
                    </p>
                  )}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={handleBackToTypeSelection}
                      disabled={pending}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSubmitDocument}
                      disabled={pending || documentFiles.length === 0}
                    >
                      Créer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className={styles.stepIndicator} aria-hidden="true">
      {([1, 2, 3] as const).map((dot) => (
        <span
          key={dot}
          className={styles.stepDot}
          data-state={dot < step ? "done" : dot === step ? "current" : "upcoming"}
        />
      ))}
    </div>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
  swatchColor,
  priority,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  swatchColor?: string;
  priority?: Priority;
}) {
  return (
    <button
      type="button"
      className={styles.option}
      aria-pressed={selected}
      data-selected={selected}
      data-priority={priority}
      onClick={onClick}
    >
      {swatchColor && (
        <span
          className={styles.optionSwatch}
          style={{ backgroundColor: swatchColor }}
          aria-hidden="true"
        />
      )}
      {label}
    </button>
  );
}
