---
title: Reconciliation — PRD vs Architecture Spine
project: Application de gestion de projets personnelle (Project Note)
date: 2026-08-05
sources:
  - prd-Project Note-2026-08-03/prd.md
  - architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md
---

# Reconciliation — PRD ↔ Architecture Spine

## 1. Cross-Cutting NFRs (PRD §5) — architectural coverage

| NFR | Architectural answer | Verdict |
| --- | --- | --- |
| **Fidélité à la charte graphique Strat'Edge** (branding: couleurs, typo, logo header/splash, favicon) | None in the spine — no mention of branding, couleurs.md, logo, splash screen, or favicon anywhere in ARCHITECTURE-SPINE.md. | **Correctly out of scope.** This NFR is entirely about visual/theme application (colors, typography, logo placement, splash/favicon assets), which is a UX/DESIGN.md concern, not a structural invariant (paradigm, boundary, dependency, data ownership, or mutation rule). The spine's own `sources:` frontmatter lists `DESIGN.md` and `EXPERIENCE.md` as companion documents, confirming branding fidelity is deliberately delegated there rather than needing an AD entry or Deferred line. No gap. |
| **Confidentialité des documents** (sensitive client/contract documents → email/password auth, strict mono-user access) | AD-4 (RLS on every table incl. mono-user, policy restricted to `auth.uid()`), AD-6 (service-role/OpenAI/VAPID secrets server-only, never in client bundle), AD-9 (email/password auth, no magic link, single account, no roles). | **Fully covered.** Three ADs jointly answer the confidentiality requirement: RLS prevents anon-key data exposure, AD-6 prevents secret leakage, AD-9 matches FR-39 exactly (no magic link, because documents may be sensitive). |

Conclusion: both Cross-Cutting NFRs are handled correctly — one via explicit ADs, one via deliberate, correct omission (delegated to DESIGN.md).

## 2. Capability → Architecture Map — FR range audit (PRD §4 vs spine table)

| Spine row | Spine FR range | Actual PRD FR range (per §4.x) | Match? |
| --- | --- | --- | --- |
| 4.1 Capture ("+") | FR-1–FR-5 | FR-1, FR-2, FR-3, FR-4, FR-5 | ✅ |
| 4.2 Gestion des projets | FR-6–FR-9 | FR-6, FR-7, FR-8, FR-9 | ✅ |
| 4.3 Tâches | FR-10–FR-14 | FR-10, FR-11, FR-12, FR-13, FR-14 | ✅ |
| 4.4 Notes | FR-15–FR-17 | FR-15, FR-16, FR-17 | ✅ |
| 4.5 Documents | FR-18–FR-21 | FR-18, FR-19, FR-20, FR-21 | ✅ |
| 4.6 Vue projet | FR-22–FR-26 | FR-22, FR-23, FR-24, FR-25, FR-26 | ✅ |
| 4.7 Calendrier général | FR-27–FR-32 | FR-27, FR-28, FR-29, FR-30, FR-31, FR-32 | ✅ |
| 4.8 Offline & synchro | FR-33–FR-35 | FR-33, FR-34, FR-35 | ✅ |
| 4.9 Notifications push | FR-36–FR-38 | FR-36, FR-37, FR-38 | ✅ |
| 4.10 Authentification | FR-39 | FR-39 | ✅ |

All ten ranges are accurate and contiguous (FR-1 through FR-39, no gaps, no overlaps, no off-by-one errors). The frontmatter `binds: ['FR-1–FR-39']` is consistent with the table. **No FR-range mismatches found.**

## 3. PRD constraints vs architecture decisions — conflict check

### 3.1 Priority scale (FR-3) — ✅ consistent
PRD: "Basse / Normale / Haute (échelle à 3 niveaux)". Spine Consistency Conventions: `priority`: `low` | `normal` | `high`, translated at display time to Basse/Normale/Haute. Exact match, no conflict.

### 3.2 Offline / sync behavior (FR-33–FR-35) — ✅ consistent
- FR-33 (local write when offline) ↔ AD-1 (local-first, all writes go through Dexie first).
- FR-34 (auto-sync on reconnect) ↔ AD-1 + `sync/` engine, AD-2 (sync/ is the only bridge to data/remote/).
- FR-35 (sync status indicator: à jour / en attente / en cours) ↔ spine's queue envelope status enum `pending|syncing|synced|conflict|error`. The spine's enum is a superset of the PRD's 3 UI states — the extra `conflict` state is required by AD-3 (field-level conflict resolution) and `error` is a reasonable operational addition. This is an enrichment, not a contradiction; UI copy for the extra states is explicitly flagged in Deferred as owed to a future EXPERIENCE.md update. No conflict.
- Interrupted large-file upload (§4.8 feature NFR, `[ASSUMPTION]`, Open Question 3) ↔ AD-5 explicitly resolves it: "Un upload interrompu par une coupure réseau reprend depuis le dernier point réussi plutôt que de repartir de zéro." Open Question 3 is answered.
- FR-18 max file size (Open Question 1, undefined in PRD) ↔ AD-5 sets 20 MB/file. Open Question 1 is answered.

### 3.3 Auth (FR-39) — ✅ consistent
PRD: email/password only, no magic link, single account, no roles/permissions. AD-9: identical wording, same constraints. No conflict.

### 3.4 Data model — ⚠️ **conflict found**
The ERD section states:

> `Project`, `Task`, `Note`, `Document` portent chacun `priority` (Basse/Normale/Haute, cf. FR-3), `provenance` (téléphone/ordinateur) et `is_new` (badge "nouveau", cf. FR-25).

This includes **`Project`** as carrying `priority`, `provenance`, and `is_new`. This contradicts the PRD on all three fields for `Project`:

- **`priority`**: FR-3 and the Glossary (§3, "Priorité") both scope priority explicitly to the three *capturable content types* — "note, tâche, document" — set during the "+" flow (Projet → Priorité → Type). A Project is chosen *before* the priority step and is never itself a captured item; FR-6 (project creation) defines only nom/description/couleur, with no priority field. Giving `Project` a `priority` column has no corresponding FR and actively conflicts with the Glossary's explicit 3-type scope.
- **`provenance`**: FR-24 says "chaque élément" (within a project's Task/Note/Document tabs) shows the capturing device. Projects aren't "captured" from a device in the PRD's model — they're administrative containers (FR-6). No FR assigns provenance to Project.
- **`is_new`**: FR-25 scopes the "nouveau" badge to elements inside a project view (Tasks/Notes/Documents tabs, §4.6), not to the Project entity itself. No FR describes a project-level "unread" state.

**Impact:** minor but real — a future implementer following the ERD line literally would add three unused/undefined columns to the `Project` table, or (worse) build UI expecting a Project-level priority/new-badge that no FR justifies and that FR-6/FR-7 (project list, showing only nom/couleur/statut) contradicts.

**Recommendation:** narrow that ERD sentence to `Task`, `Note`, `Document` only (the three FR-3 capturable types), dropping `Project` from it.

## 4. Structural gaps the PRD implies but the spine never addresses

### 4.1 Push subscription storage / ownership — real gap
FR-36–FR-38 and AD-6/AD-7 establish *that* push notifications are sent (Render Cron → server route handler → web-push → service worker), and that VAPID keys are server-only secrets. But nothing in the spine — not the ERD, not the Structural Seed, not Deferred — establishes **where a push subscription (endpoint + keys, one per installed device) is persisted or which layer owns it**.

This matters structurally, not just as an implementation detail, because:
- The PRD's user model is explicitly multi-device single-user ("sur téléphone comme sur ordinateur", UJ-1/UJ-2/UJ-3): the same person installs the PWA on phone and computer, both presumably eligible for reminders.
- The Cron job (server-side, AD-7) needs to read subscription(s) at `reminder_at` time — this data cannot live only in `data/local/` (Dexie, client-side) since a server process can't reach a browser's IndexedDB. It must be owned by `data/remote/` (Supabase), meaning it needs its own table/RLS policy (AD-4 applies) and its own entity in the ERD.
- FR-38 ("ré-enregistrement silencieux du token... lorsqu'il expire") implies an update/upsert lifecycle on this data that the spine's AD-3 field-level conflict model doesn't obviously cover (a subscription isn't user-editable content, so does AD-3 even apply, or is it last-write-wins by device?).

None of this is decided. The Deferred section lists Dexie schema, Supabase table columns, and conflict-indicator copy as intentionally out of scope for the spine — but a **new entity's existence and which layer owns it** is exactly the kind of data-ownership call a spine is supposed to fix, unlike column-level detail. This should either get its own AD (e.g., "AD-10 — Push subscriptions are server-owned, one row per device, keyed by user+endpoint") or at minimum a line in the ERD + a Deferred entry acknowledging it's open.

### 4.2 Minor/secondary — not blocking
- **`device_id` provenance**: the sync envelope convention includes `device_id: string`, and FR-24 requires displaying provenance (téléphone/ordinateur). The spine never states how a device is identified/persisted as "phone" vs "computer" (user-agent sniffing? explicit onboarding step? installed-PWA display-mode detection?) or which layer (`domain/` vs `data/local/`) owns that classification. This is arguably implementation detail rather than a structural invariant, so it's not flagged as a hard gap — but it sits close to the line, since FR-24 is a hard functional requirement and the mechanism has UX implications (what happens on an unrecognized device, e.g. a new/second computer). Worth a one-line Deferred acknowledgment if not already implicit.

## Summary

- **Cross-cutting NFRs**: both covered correctly — branding fidelity is correctly and deliberately left to DESIGN.md/EXPERIENCE.md (not an architectural concern), confidentiality is fully answered by AD-4/AD-6/AD-9.
- **Capability Map FR ranges**: all 10 rows verified accurate against the PRD; no mismatches.
- **Conflicts**: one real conflict — the ERD sentence extends `priority`/`provenance`/`is_new` to `Project`, which contradicts FR-3, the Glossary, FR-6, FR-24, and FR-25 (these fields are scoped to Task/Note/Document only). Recommend narrowing that sentence to drop `Project`.
- **Structural gaps**: one real gap — push subscription storage/ownership (needed by AD-7's Cron→route-handler flow and FR-38's token re-registration) is never assigned to a layer or given an ERD entity/table, despite the PRD's explicit multi-device-single-user model. Recommend a new AD or an ERD + Deferred entry. A secondary, non-blocking note on `device_id` provenance classification is also included.
