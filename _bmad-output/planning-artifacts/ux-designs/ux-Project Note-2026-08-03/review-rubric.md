# Spine Validation — DESIGN.md + EXPERIENCE.md (Project Note, 2026-08-03)

**Overall verdict: ADEQUATE — usable as a contract today, with a defined punch list.**

The vast majority of the surface (visual identity, 7 of the 8 canonical DESIGN.md sections, all three PRD user journeys, IA, voice/tone, accessibility floor, responsive/platform) is coherent, cross-referenced correctly, and calibrated right for "internal tool, high finish." But four load-bearing UI primitives that both files actively rely on — text inputs, modals/dialogs, destructive-action styling, and the project-color rotation palette — have zero visual definition in DESIGN.md despite being named or implied repeatedly. A downstream architect/dev can start building today (cards, chips, segmented control, FAB, calendar, buttons are all fully specified) but will hit an undefined wall the first time they build a form, a confirmation dialog, or project-color assignment. None of these are exotic — they're used in nearly every flow — so this isn't polish-tier, it's contract-tier.

---

## §1 — Flow coverage (EXPERIENCE.md × PRD UJ-1/2/3)

**Verdict: Adequate.**

All three PRD journeys have a corresponding Key Flow with named protagonist (Guillaume), numbered steps, and an explicit `**Climax:**` beat. Content maps correctly:

| PRD | EXPERIENCE.md Flow | Match |
|---|---|---|
| UJ-1 (soir, téléphone, vocal, offline) | Flow 1 — Capture du soir | ✓ steps + climax + failure path (micro refused) |
| UJ-2 (lendemain, ordinateur, badge nouveau) | Flow 2 — Reprise au bureau | ✓ steps + climax; **no failure path** |
| UJ-3 (entre deux rdv, tâche + échéance) | Flow 3 — Tâche entre deux rendez-vous | ✓ steps + climax; **no failure path** |

**Findings:**
- **Flow 2 has no failure/edge path** (EXPERIENCE.md lines 133–139). This is the one flow whose entire dramatic point is cross-device trust ("le badge disparaît... sans ambiguïté"). The one realistic edge — Guillaume opens the desktop before the phone's write has finished syncing, so the note isn't there yet — is exactly where that trust could break, and it's undocumented. The State Patterns table has a "Synchronisation" row (3 states) but the flow itself never connects to it.
- **Flow 3 has no failure/edge path** either. Lower severity — the flow doesn't cross an external dependency (no permission, no network requirement beyond local-first write) — but per the instruction to check "where applicable," a plausible edge (task created without échéance, so it never reaches the calendar per FR-11) goes unaddressed.

## §2 — Token completeness (DESIGN.md)

**Verdict: Adequate, with one critical gap.**

Extracted every YAML token and every `{path.to.token}` reference in prose. Nearly everything resolves cleanly. Four findings:

- **CRITICAL — project-color palette is acknowledged but never defined.** DESIGN.md line 153 explicitly says priority colors are "Palette distincte de la couleur de projet (qui suit sa propre logique, cf. PRD FR-6)" — i.e., it flags that project colors are a separate system — but no token, hex list, or rotation set for that system exists anywhere in the file. FR-6 requires "couleur assignée automatiquement par rotation dans la palette de marque"; FR-29/FR-32 require the calendar to color-code tasks by project color; FR-7 requires the project list to show it. Three FRs and at least one flow depend on a palette that is named but not specified. This is the single highest-impact gap in the document.
- **Missing dark-mode pair on two component tokens.** `segmented-control.item-inactive-text` (line 86) and `button-ghost.text` (line 134) both resolve to `{colors.muted}` (#7A8594, tuned for a light background) with no `-dark` counterpart, even though `colors.muted-dark` (#93A4B8) exists and is the documented dark-theme substitute (line 152). Every other neutral-bearing token in the file (`border`/`border-dark`, `bg`/`bg-dark`, `track-bg`/`track-bg-dark`, etc.) follows the pair convention; these two silently don't. Concretely: inactive segmented-control labels and ghost-button text will render in a light-mode-tuned grey against dark-navy surfaces unless a dev catches this by inspection.
- **`colors.link-hover` (#1C5DC9) is defined but never referenced or explained.** No component uses it, no prose section mentions when/where a link-hover state applies (desktop-only? Which links — in-app text links, the "cf. brief" style reference, or something else?). Orphan token.
- **`rounded.md` (9px) is used by three component tokens** (`button-primary.radius`, `button-ghost.radius`, `status-row.track-radius`) **but the "Shapes" prose section never mentions it** — it narrates only sm/lg/xl/full. Value resolves fine (declared directly in frontmatter), so this isn't broken, but a reader working from the prose narrative alone would miss why buttons and the status-row track get a radius distinct from cards. `rounded.DEFAULT` (10px) is the mirror problem: defined, never referenced by any token and never mentioned in prose — orphan.
- **Priority-chip has no letter/text color token.** DESIGN.md says the chip shows "lettre unique (H/N/B) en contraste" (line 183) but only background colors are tokenized (`haute-bg`, `normale-bg`, `basse-bg`, `basse-bg-dark`) — there's no `text`/`letter` token. Since `basse-bg` is a light neutral (#E9EEF5) while `haute-bg`/`normale-bg` are saturated blues, "in contrast" almost certainly means the letter color must differ per variant, which the current token set can't express.

## §3 — Component coverage (both spines)

**Verdict: Thin.**

Cross-referenced every component name against DESIGN.md `## Components` + frontmatter `components:` keys and EXPERIENCE.md `## Component Patterns` rows. Core visual components (segmented control, task card, priority chip, meta pill, status control, FAB, primary/ghost button, badge) are covered on both sides with real behavioral + visual rules, not one-word descriptions. But EXPERIENCE.md's Component Patterns table names several components that have **no DESIGN.md visual counterpart at all**:

- **Text input fields** — used by "Formulaire de création de projet" (nom, description) and "Champs de tâche" (titre, description, échéance, rappel), i.e. nearly every capture and creation flow. DESIGN.md has zero definition of an input's border, radius, focus state, or label treatment — confirmed via full-file search (no hits for "input," "champ," "focus" as a visual concept).
- **Modal/Dialog/Overlay** — the capture flow ("s'ouvre en overlay/modal," EXPERIENCE.md line 28), the "Action Désarchiver" confirmation, and the document-deletion confirmation all rely on an overlay/dialog surface. DESIGN.md never defines one (no background-dim, radius, shadow, or mobile-full-screen-vs-desktop-centered treatment) — despite EXPERIENCE.md's own Responsive & Platform section stating the overlay behaves differently on mobile (full screen) vs desktop (centered modal), which is exactly the kind of rule that belongs in DESIGN.md's Components section.
- **Checkboxes / "Filtres de tri"** — behaviorally specified (combinable, default state) but no visual spec anywhere (shape, checked/unchecked color).
- **Destructive/error color** — "Actions document" includes an irreversible delete with confirmation (FR-21); nowhere in the entire color palette is there an error/danger/destructive token. A dev implementing the delete-confirmation button has nothing to reference.
- **Stepper step-state color** — "Stepper de capture" explicitly requires "fait/actuel/à venir" states; DESIGN.md's Shapes section gives step numbers a shape (`rounded.full`, line 177) but never defines the three-state color treatment.

## §4 — State coverage (EXPERIENCE.md, walked per IA surface)

**Verdict: Thin.**

| Surface | States present | Notable gaps |
|---|---|---|
| Connexion | Non authentifié | **No login-error state** (invalid credentials, offline-at-login) |
| Général (calendrier) | — | No empty-calendar state; no cold-load state |
| Projets | Aucun projet, Projet archivé | No cold-load / fetch-error state |
| Vue projet | Onglet vide (per type) | No cold-load / fetch-error state |
| Détail d'élément | Note vocale sans transcription | No save/edit-error state |
| Capture "+" | Écriture hors ligne, Accès micro refusé | No camera/gallery permission-denied for document capture (FR-18 mobile path) — the mic-refused pattern (line 80) is never mirrored for camera/gallery |
| Synchronisation (global) | à jour / en attente / en cours | **No permanent-failure state.** Three states cover transient sync, but nothing addresses a sync that fails for good (oversized file, server rejection, unresolvable conflict) |

**Highest-severity finding:** the sync indicator's 3-state model has no failure state. Given SM-1 is literally "zero idée/tâche/document perdu," and the whole architecture is offline-first-write-then-sync, a permanently-failed sync is the one scenario that could actually violate the product's primary success metric — and it's the one state the spine doesn't cover.

## §5 — Visual reference coverage

**Verdict: Adequate.**

`.working/` contains 4 files: `direction-crisp-systematic.html`, `direction-minimal-editorial.html`, `direction-warm-rounded.html`, `wireframe-top-nav-switch.html`. `imports/` is empty (expected, per task framing).

- `wireframe-top-nav-switch.html` and `direction-crisp-systematic.html` are both linked inline at the relevant spot (EXPERIENCE.md § Information Architecture, lines 28 and 30), with the standard "la spine gagne en cas de conflit" precedence note. Correctly done.
- **Orphans: `direction-minimal-editorial.html` and `direction-warm-rounded.html`** are never referenced by either spine. These read as the two rejected visual directions from a 3-way exploration (crisp-systematic won). Neither DESIGN.md's "Brand & Style" nor EXPERIENCE.md's "Inspiration & Anti-patterns" documents *why* Crisp Systematic was chosen over the other two — a missed citation that both example spines' pattern (documenting rejected directions with a one-line rationale) would suggest belongs there.

## §6 — Bloat & overspecification

**Verdict: Strong.**

No padding found. Every Do/Don't row, every Voice-and-Tone example, every component note ties to a concrete PRD requirement or a stated rationale (e.g., the logo-asset note explaining SVG-vs-PNG tradeoffs, or the dark-theme note explicitly rejecting auto-inversion). Density is appropriate for "internal tool, high finish" — nothing reads as filled-in-for-completeness.

## §7 — Inheritance discipline

**Verdict: Adequate.**

- **UJ traceability labels are dropped.** EXPERIENCE.md's Key Flows match UJ-1/2/3 content precisely (verified scenario-by-scenario above) but never cite "UJ-1"/"UJ-2"/"UJ-3" literally in the Flow headers or body — a `grep UJ-2` from a downstream consumer won't land on Flow 2. Minor but mechanical: content fidelity is intact, the traceability tag isn't.
- **Component naming split: "Sélecteur segmenté" vs "Switcher segmenté."** DESIGN.md's `## Components` calls it "Sélecteur segmenté (Tâches / Documents / Notes)" (line 181); EXPERIENCE.md's IA section and Component Patterns table both call it "Switcher segmenté" (lines 28, 53–54). Same component (same frontmatter key `segmented-control`, same behavioral rules), two different French names across the pair. Everything else (Carte de tâche/note/document, Puce de priorité, Contrôle de statut, FAB) is named identically in both files.
- EXPERIENCE.md never uses `{token}` syntax (matches the shape of both example EXPERIENCE.md files, which also keep tokens out of the experience layer) — so there's nothing to resolve/break here; this is by design, not a gap.

## §8 — Shape fit

**Verdict: Strong.**

- DESIGN.md sections run in canonical order: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. Exact match to both example DESIGN.md files.
- EXPERIENCE.md sections run in canonical order and include both optional sections: Foundation → Information Architecture → Voice and Tone → Component Patterns → State Patterns → Interaction Primitives → Accessibility Floor → **Responsive & Platform** → **Inspiration & Anti-patterns** → Key Flows.
- **Responsive & Platform earns its place** — genuinely different behavior per platform (overlay full-screen on mobile vs. centered modal on desktop; switcher full-width vs. constrained-width; calendar default view), not restated boilerplate.
- **Inspiration & Anti-patterns earns its place but is narrower than the pattern** — all 3 entries are substantive "Rejeté" items tied to real PRD/brief decisions (AI assistant deferred to V2, no gamification, no bottom nav). Unlike both example spines, there are no "Lifted from X" positive-inspiration entries, and — consistent with the §5 finding — it doesn't cover the rejected *visual* directions sitting in `.working/`. Not padding, just incomplete relative to the full pattern.

---

## Mechanical notes

- Files reviewed: `DESIGN.md` (198 lines), `EXPERIENCE.md` (148 lines), `prd.md` (411 lines, UJ-1/2/3 at §2.2, FR-1–FR-39).
- `.working/` inventory: 4 files (2 cited, 2 orphaned) — see §5.
- No broken `{token}` references found in DESIGN.md; all resolve to a defined value either directly (hex/px) or transitively through another valid token.
- EXPERIENCE.md contains zero `{token}` syntax — consistent with example-spine convention, not a defect.
- Punch list before this pair is contract-clean for downstream architecture/story-dev, in priority order:
  1. Define the project-color rotation palette (FR-6/29/32).
  2. Define a sync permanent-failure state (protects SM-1).
  3. Define text-input and modal/dialog visual components.
  4. Add dark-mode text pair for `segmented-control.item-inactive-text` and `button-ghost.text`.
  5. Define a destructive/error color token.
  6. Reconcile "Sélecteur" vs "Switcher" naming for the segmented control.
