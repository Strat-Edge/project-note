// lib/device.ts — détection client du type d'appareil ayant réalisé une capture (FR-24).
// Heuristique simple (pointeur grossier = tactile) : aucune spec exacte fournie par
// DESIGN.md/EXPERIENCE.md au-delà de la distinction binaire téléphone/ordinateur.
import type { Provenance } from "@/domain";

export function detectProvenance(): Provenance {
  if (typeof window === "undefined") {
    return "computer";
  }
  return window.matchMedia("(pointer: coarse)").matches ? "phone" : "computer";
}

const DEVICE_ID_STORAGE_KEY = "project-note:device-id";

// Identifiant stable par navigateur/appareil (device_id de l'enveloppe de file de
// synchronisation, cf. ARCHITECTURE-SPINE.md Consistency Conventions) — distinct de
// detectProvenance (classification téléphone/ordinateur), généré une fois puis persisté.
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
}
