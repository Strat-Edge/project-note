"use client";

// components/confirm-dialog.tsx — modale de confirmation partagée (DESIGN.md.components.modal).
// Premier consommateur réel : la confirmation "Désarchiver" (Story 2.3, FR-9). La Story 6.3
// (suppression de document, FR-21) le réutilise, en ajoutant une variante destructive (bouton
// de confirmation en `--color-danger`, cf. DESIGN.md.components.button-destructive) et une
// description optionnelle sous le titre.
import { useEffect, useRef, type KeyboardEvent } from "react";
import styles from "./confirm-dialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
  variant = "default",
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Restaure le focus sur l'élément déclencheur (ex. "Désarchiver") à la fermeture,
    // qu'elle vienne d'Annuler ou de Confirmer.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    return () => {
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    // Piège à focus minimal : seuls Annuler et Confirmer sont focusables dans la dialog.
    if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
      event.preventDefault();
      confirmButtonRef.current?.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === confirmButtonRef.current
    ) {
      event.preventDefault();
      cancelButtonRef.current?.focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onKeyDown={handleKeyDown}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-description" className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.ghostButton}
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={variant === "destructive" ? styles.destructiveButton : styles.primaryButton}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
