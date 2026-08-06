# Architecture Spine Review — Good-Spine Checklist

**Spine reviewed:** `ARCHITECTURE-SPINE.md` (Application de gestion de projets personnelle — Strat'Edge, altitude=initiative, purpose=build-substrate)
**Sources checked:** PRD (`prd.md`), `DESIGN.md`, `EXPERIENCE.md`, `spec-app-gestion-projets.md`, `.memlog.md`
**Reviewer stance:** fresh read, independent of the session that produced the spine. Not penalizing for absence of enterprise ceremony (sign-off, compliance register) — this is a solo-developer internal PWA.

---

## Verdict

Structurally sound and unusually disciplined for a solo/internal spine — layering, conflict resolution, RLS, secrets boundary, and hosting are all fixed with enforceable rules, and the Capability Map covers all ten PRD §4 features. But it has one real self-contradiction in its own dependency diagram, one under-specified invariant that two independently-built entities could implement incompatibly, and one Deferred entry that is factually stale.

---

## Findings (most → least severe)

### 1. [HIGH] AD-2's own diagram contradicts AD-2's own rule and the Design Paradigm — genuine two-unit divergence risk

**Location:** AD-2 Rule (lines 41-45) vs. its mermaid diagram (lines 47-57); Design Paradigm section (lines 22-32); Consistency Conventions "State & cross-cutting" row (line 113).

- Design Paradigm states: `domain/` = "règles métier pures, **indépendantes de toute source de données**."
- AD-2's Rule states: "`domain/` ne dépend d'aucune implémentation de `data/*` (interfaces uniquement)."
- But AD-2's own mermaid diagram draws `domain --> sync`, i.e. `domain/` depends directly on `sync/` — which is itself the module whose entire job is bridging to `data/local/` and `data/remote/` (IO). A `domain/` that imports `sync/` is not independent of a data source; it's one hop removed from Supabase/Dexie.
- The Conventions table adds a third, slightly different framing: "Toute mutation transite par `domain/` — jamais un composant qui... appelle `sync/` en le contournant" — implying `domain/` is expected to call `sync/` directly, reinforcing the diagram over the "pure, no data-source dependency" prose.

**Two-unit test — fails.** Story A (e.g. Task status changes) reads the Design Paradigm literally, keeps `domain/` pure, and puts the `sync/`-enqueue call in `app/` route handlers or a thin adapter. Story B (e.g. Note transcription) reads the diagram + Conventions table literally and has `domain/` call `sync/` directly. Both comply with *some* sentence in the spine; the resulting codebases have `domain/` at different dependency depths, and a future consistency check has no single rule to appeal to.

**Fix:** Pick one direction and make prose, rule, diagram, and Conventions table agree — e.g. "domain/ exposes pure functions; a thin `app/`-level (or dedicated) mutation dispatcher calls `sync/` after domain validates" — and redraw the AD-2 diagram to match.

### 2. [MEDIUM-HIGH] AD-3 doesn't specify how a conflicting field's two values are persisted pending arbitration — a real per-entity divergence point

**Location:** AD-3 Rule (lines 59-63); ERD section (lines 187); Deferred (line 220).

AD-3 is otherwise a strong, enforceable rule (per-field `_updated_at` metadata, no silent overwrite). But the Rule only says the two values "sont conservées jusqu'à arbitrage manuel" — it never states *where*. Candidates that are all consistent with the Rule's wording but structurally incompatible: (a) a shadow column per conflict-prone field (`status_conflict_value`), (b) a separate `sync_conflicts` table keyed by entity/field, (c) leaving both pending sync-queue entries un-resolved and reading them at render time. The Deferred section only defers "exact table/column definitions," which reads as ordinary schema detail — it does not flag that the *conflict-storage mechanism itself* is undecided, even though EXPERIENCE.md requires a uniform "Conflit de synchronisation — à vérifier" badge and two-value picker UI across Task/Note/Document/Project alike.

**Two-unit test — fails.** A story implementing Task conflict handling and a story implementing Note conflict handling, built independently, could each invent a different storage shape for "the other value," producing three or four incompatible conflict-resolution code paths instead of one shared mechanism — despite each fully complying with AD-3's literal text.

**Fix:** Either name the mechanism as an invariant (e.g., "conflicting values are held in the pending sync-queue entry, never written back to the entity table until resolved") or explicitly move it into Deferred with a note that it must be decided once, centrally, in `sync/` — not per entity.

### 3. [MEDIUM] Deferred item is stale — the "future EXPERIENCE.md update" it describes has already happened

**Location:** Deferred, 3rd bullet (line 221): *"Copie UI de l'indicateur de conflit de synchronisation... appartient à une future mise à jour d'`EXPERIENCE.md`, déjà signalée dans le memlog de cette session."*

`EXPERIENCE.md` (updated 2026-08-04, one day before the spine's 2026-08-05) already contains this exact copy in its State Patterns table: *"Conflit de synchronisation | ... badge 'Conflit de synchronisation — à vérifier' ... L'ouverture de la fiche présente les deux valeurs et demande à l'utilisateur de choisir laquelle garder..."* — a complete behavioral spec, not a placeholder. The spine's own `.memlog.md` confirms this reconciliation already ran: *"Sources en amont mises à jour... EXPERIENCE.md (nouvel état 'Conflit de synchronisation')."* The Deferred bullet describes this as still-future work, which is simply incorrect as of the spine's own `updated:` date. This is a genuinely-decided invariant mischaracterized as an open item — a future story could waste effort re-deciding copy that already exists, or worse, invent divergent copy because the spine pointed away from the answer.

**Fix:** Remove this Deferred bullet (or repoint it to "see EXPERIENCE.md State Patterns, already resolved").

### 4. [LOW-MEDIUM] Operations dimension (monitoring, alerting, backup/restore) is entirely silent

**Location:** "Déploiement & environnements" table (lines 167-175); Consistency Conventions (line 113).

Deployment & environments and infra/provider strategy are both explicitly decided (Render Web Service + Cron, dedicated Supabase project, no staging — with reasoning in the memlog). Logging scope is even decided ("logging technique serveur limité aux erreurs de synchronisation et d'appels API externes"). But nothing addresses: what happens when the Render Cron job fails silently, whether Supabase's default Postgres backups are relied upon as-is or need configuring, or whether any error-alerting exists beyond in-app UI (e.g., does Guillaume find out if reminders silently stop firing for a week?). For a solo internal tool this could reasonably resolve to "not needed, rely on platform defaults" — but that's a decision the spine should state in one line, not leave completely unaddressed. As written, it's a silent dimension rather than a decided-as-minimal one.

**Fix:** One line in the Déploiement & environnements table or Deferred: e.g. "Backups: relies on Supabase's default Postgres backup retention, not separately configured. Alerting: none beyond in-app sync-status indicator — acceptable for solo use."

### 5. [LOW] AD-3's Binds list uses an unscoped plural ("descriptions") among otherwise-precise field names

**Location:** AD-3 Binds line (line 61): *"...Note.transcription, descriptions)."*

Every other example in the Binds/Rule is entity-qualified (`Task.status`, `priority partagée Task/Note/Document`, `Note.transcription`). "descriptions" alone doesn't say whose — Task.description? Project.description? Both? The Rule's general principle ("tout champ modifiable après capture") does resolve this correctly if read carefully, so this is a readability nit rather than a true divergence risk, but it's the one place the spine's usual precision slips.

**Fix:** Either qualify it (`Task.description`, `Project.description`) or drop the example since the general rule already covers it.

---

## Checklist walk-through (summary)

| Checklist item | Verdict |
| --- | --- |
| Fixes real divergence points, misses none | Mostly yes — see Finding 1-2 for the two it doesn't fully fix |
| Every AD's Rule enforceable & actually prevents its divergence | 8/10 clean (AD-1, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10); AD-2 and AD-3 have the gaps above |
| Nothing under Deferred could let two units diverge | 3/4 items are genuine code-detail; 1 (conflict-copy) is stale/mischaracterized (Finding 3) |
| Named tech verified-current | Yes — `.memlog.md` has an explicit "(version) ... vérifié web" entry for every stack item (Next.js 16.3.0, Serwist 9.5.11, Dexie 4.4.4, supabase-js 2.112.0, web-push 3.6.7, TypeScript 7.0.2), plus reasoned justification for the whisper-1→gpt-transcribe swap and a rejected alternative (Web Speech API) |
| Capability → Architecture Map covers PRD §4 | Yes — all ten features (4.1–4.10) present and correctly governed |
| Every initiative-owned dimension decided/deferred/open | Deployment & infra: decided. Operations (monitoring/backup/alerting): silent — Finding 4 |
| Diagrams valid mermaid, real content | Yes, all 3 (dependency graph, containers, ERD) are syntactically valid and non-trivial — but see Finding 1 for a content contradiction, not a syntax issue |
| Decisions only, not rationale-as-prose | Good — rationale is consistently pushed to `.memlog.md`; the spine's "Prevents" bullets state consequences, not justification |

## Two-unit-built-independently test (applied explicitly to 3 ADs)

- **AD-1** (no direct client writes to Supabase) — **passes.** Mechanically checkable (grep/lint for `data/remote` imports outside `sync/`/server contexts); no room for two compliant-but-divergent implementations.
- **AD-2** (dependency direction) — **fails**, see Finding 1: the rule, the diagram, and the Conventions table each imply a different position for the `domain/` → `sync/` boundary.
- **AD-3** (field-level conflict resolution) — **fails**, see Finding 2: the per-field `_updated_at` metadata is well specified, but the storage of the losing/pending value during arbitration is not, leaving room for incompatible per-entity implementations.
