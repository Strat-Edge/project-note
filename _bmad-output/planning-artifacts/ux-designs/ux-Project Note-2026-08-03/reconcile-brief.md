---
title: Reconciliation — Brief/Addendum vs. UX Spine (DESIGN.md / EXPERIENCE.md)
status: draft
created: 2026-08-04
sources:
  - _bmad-output/planning-artifacts/briefs/brief-Project Note-2026-08-03/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-Project Note-2026-08-03/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md
---

# Reconciliation — what the brief/addendum say that the UX spine doesn't carry

Method: read brief.md + addendum.md in full, then DESIGN.md + EXPERIENCE.md in full, then cross-checked the brand color hex values against `Strat'Edge/Branding/couleurs.md` (they match exactly). Findings below are ideas/signals/requirements present in the source documents with no counterpart — not even an indirect one — in the two UX documents.

## 1. "Vitrine professionnelle" is treated as a look, not as a functional requirement

The brief pushes this well past aesthetics. It's a **business argument**: "l'app a... pris une place dans le discours commercial de Strat'Edge : c'est l'outil qu'on montre en rendez-vous client comme preuve vivante de ce que l'entreprise sait construire" (brief, Vision). The addendum reinforces it as a credibility stake, not a preference (see §3 below).

DESIGN.md and EXPERIENCE.md both acknowledge the showcase angle, but only as a **visual register cue**:
- DESIGN.md, Brand & Style: "l'app double comme vitrine face aux clients Strat'Edge, donc chaque écran doit lire comme 'on sait construire des outils sérieux'" — this only informs the "crisp, polished, not minimal-to-a-fault" styling choice.
- EXPERIENCE.md, Voice and Tone: vouvoiement is justified "cohérent avec... l'usage de l'app comme vitrine face aux clients" — again, only a tone choice.

**What's missing:** the *functional* implications of an app that gets opened live in front of a client. Neither document addresses:
- A demo-safe way to show the app without exposing Guillaume's real, possibly confidential, project/client notes (no "sample project," no privacy-conscious demo state, no guidance on what to show vs. hide in a client meeting).
- Whether the empty/first-run state (a genuinely likely state to be shown cold, e.g. a new project created live for the demo) is polished enough to carry the "preuve de compétence" weight the brief assigns it. EXPERIENCE.md's empty states ("Aucun projet pour l'instant.", "Aucune note pour l'instant...") are functionally fine but were clearly written for the personal-use case, not for the credibility-showcase case.
- PWA install/app-icon presentation (see §2) — the literal first thing a client sees if Guillaume adds it to a phone's home screen mid-demo.

This is a real gap: the brief elevates "vitrine" to a first-class use case with its own success condition (it should read as "on sait construire"), but the UX spine only lets it shape color/type/tone choices already being made for other reasons, never a dedicated flow, state, or component decision.

## 2. Logo usage is entirely absent

The addendum names the branding-fidelity requirement explicitly as "`Strat'Edge/Branding/couleurs.md` **+ logos**" (addendum, "Enjeu de branding"). Verified: DESIGN.md's color tokens are faithful to `couleurs.md` (all hex values match exactly, including header navy `#0F2A44`, primary `#2F80ED`, secondary `#56A3FF`, borders, muted gray, etc.) — so the *color* half of the requirement is honored.

The *logo* half has no counterpart anywhere in DESIGN.md or EXPERIENCE.md:
- No mention of where/whether the Strat'Edge logo (`Strat'Edge/Branding/Logos/logo-complet.png`, `logo-seul.svg`) appears — login screen, header, empty states, anywhere.
- No mention of the PWA app icon / manifest / splash screen — which for an installable PWA is a mandatory deliverable, and is exactly the kind of client-visible touchpoint (home-screen icon, install prompt, splash on cold launch) the "vitrine" argument would care about most.

Given the addendum pairs colors and logos in the same sentence as the credibility requirement, and colors got full treatment while logos got none, this reads as a dropped half of an explicit requirement rather than an intentional omission.

## 3. "First-order requirement" framing for branding fidelity doesn't propagate

The addendum is explicit about *priority*, not just content: "à traiter comme une exigence de premier ordre, pas comme un item de polish de fin de projet" (addendum, "Enjeu de branding"). This is a directive about how the requirement should be *handled downstream* (e.g., a design-QA gate before ship, not a nice-to-have cleanup pass at the end).

DESIGN.md happens to satisfy the content of the requirement (colors verified accurate), but nothing in either document carries forward the *prioritization signal* itself — there's no equivalent of "don't ship without verifying against `couleurs.md`," no acceptance-criteria hook, no Do's/Don'ts entry framing brand fidelity as non-negotiable the way e.g. "ne jamais recouvrir le FAB" is treated as non-negotiable for the FAB. If this spine is meant to hand off into PRD/architecture/build without the addendum in hand, the "first order, not polish" instruction is lost.

## 4. Push notifications are unaddressed in both UX documents

Brief scope (In Scope V1): "Notifications push sur les rappels de tâches." This is a committed V1 feature, not a maybe.

Neither DESIGN.md nor EXPERIENCE.md mentions notifications at all — no component, no permission-state pattern, no tone guidance for notification copy. This stands out because EXPERIENCE.md *does* carefully spec the analogous permission-denied case for microphone access ("Accès micro refusé... État dégradé visible ('Micro indisponible')") — the same treatment is conspicuously missing for notification permission (browsers/PWAs routinely have users deny notification permission, which would silently break the reminder feature with no documented fallback state or copy).

## 5. "Memory is an asset, not a flaw" — a value stance that should shape tone but doesn't

Brief, Who This Serves: "Sa mémoire est un atout, pas une faiblesse : le problème n'est pas d'oublier une idée, mais de ne disposer d'aucun endroit unique... pour la déposer sur le moment et la retrouver ensuite structurée." This is a specific, deliberate reframe: the app is not a crutch for a bad memory, it's fast externalized storage for someone whose memory already works fine and is overloaded. It directly informs the emotional promise behind "Zéro idée perdue" (Success Criteria) — the product's job is to be a trustworthy, low-friction drop point, not to "help you remember."

EXPERIENCE.md's Voice and Tone section is generic professional/factual (short declarative sentences, no exclamation points, no emoji, vouvoiement) and gets the *register* right, but never captures this specific stance. The Do/Don't table's examples ("Enregistré." vs. "C'est noté ! 🎉") avoid being patronizing but don't actively reinforce the "your memory is fine, this is just where things live now" framing — e.g., no guidance steering copy away from language that implies the app is compensating for forgetfulness (which would undercut the brief's explicit "atout, pas une faiblesse" framing) versus language that treats capture as simply filing what the user already thought of. This is a subtle miss, but it's a value judgment stated explicitly in the brief with no trace in the tone spec.

---

## Not gaps (checked and found covered)

- Offline-first behavior, sync queue/indicator, provenance badges, "nouveau" badge, priority as manual-only, calendar filter/color-by-project, capture flow (Projet → Priorité → Type), voice-transcription-on-demand with a distinct "audio only" state, archived-project handling, no-AI/no-gamification/no-tracking anti-patterns — all present and consistent between the source documents and the UX spine.
- Brand color fidelity itself (the hex values) — verified accurate against `Strat'Edge/Branding/couleurs.md`.
