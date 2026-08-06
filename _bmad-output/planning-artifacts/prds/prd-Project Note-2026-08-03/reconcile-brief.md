---
title: "Reconciliation: Brief vs PRD — Application de gestion de projets personnelle"
created: 2026-08-03
---

# Reconciliation — Brief vs PRD

Source brief: `_bmad-output/planning-artifacts/briefs/brief-Project Note-2026-08-03/brief.md`
Source PRD: `_bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md`

Method: read both documents fully, section by section, and checked every substantive idea, requirement, nuance, and qualitative signal in the brief against the PRD's FRs, Non-Goals, Open Questions, and narrative sections (Vision, Target User, Document Purpose).

## Gaps found (present in brief, absent from PRD)

### 1. Competitive positioning and the "no moat, it's alignment" argument — MISSING

Brief §"What Makes This Different" makes an explicit, reasoned case that:
- The brief names competitors considered and rejected — Notion, Todoist, ClickUp — because the "notes + tasks + projects + calendar" combination already exists there, partially.
- Two concrete reasons for rejecting them: (1) **centralisation stricte** — refusing to juggle multiple tools/licenses for something that must fit in one gesture, one place; (2) the vitrine argument (this half survives into PRD §1 Vision).
- The brief's closing line frames this deliberately as *not* a product moat: *"L'avantage réel n'est donc pas un moat produit, mais l'alignement total entre l'outil, le flux de travail réel de Guillaume, et l'image que Strat'Edge veut renvoyer à ses clients."*

The PRD's Vision (§1) keeps the vitrine/showcase motivation but drops the competitive-rejection reasoning (why not just use an existing tool) and drops the explicit "this is not a moat, it's alignment" framing entirely. This is a meaningful positioning/rationale signal — it explains *why* build custom rather than buy — that a future reader of the PRD alone would not recover.

### 2. Explicit boundary: never becomes a product sold to third parties — MISSING

Brief §Vision, closing sentence: *"...sans jamais devenir un produit vendu à des tiers, ce qui reste hors de propos pour ce projet."* This is a deliberate scope boundary on the tool's long-term trajectory (even the V2 AI-assistance layer is bounded by it).

Nothing in the PRD's Non-Goals (§5), Open Questions (§8), or Vision (§1) captures this. It is not merely a V1/V2 scope line (which the PRD does cover for the AI assistant) — it is a standing constraint on what this project is allowed to become, ever. Worth carrying forward, especially since it could matter if "productize and resell" is ever raised later.

### 3. V1 scoping philosophy — "ship a reliable base fast, enrich later once usage is proven" — MISSING

Brief Executive Summary: *"V1 reste volontairement resserré — classement manuel, priorité manuelle, pas d'intelligence artificielle de synthèse — pour livrer vite une base fiable, quitte à enrichir plus tard une fois l'usage réel éprouvé."*

The PRD documents the *what* (manual classification, manual priority, no AI — via FR-3, Non-Goals) but not the *why*/*tone*: this is a stated value judgment about sequencing (reliability and speed over completeness, defer enrichment until real usage validates the need). The PRD's Document Purpose (§0) and Vision (§1) read as neutral requirement statements; this deliberate "resist scope creep, prove the base first" posture isn't voiced anywhere, even though it directly motivates the Non-Goals list and SM-C1's counter-metric.

### 4. "His memory is an asset, not a weakness" reframe — MISSING

Brief §"Who This Serves": *"Sa mémoire est un atout, pas une faiblesse : le problème n'est pas d'oublier une idée, mais de ne disposer d'aucun endroit unique, accessible partout, pour la déposer sur le moment et la retrouver ensuite structurée par projet."*

This is a specific, almost identity-level framing of the user: the product isn't compensating for a personal deficiency, it's providing infrastructure his (perfectly fine) memory doesn't need to substitute for. The PRD's Target User (§2.1, "Émotionnels") states the emotional job ("ne plus porter la charge mentale...") but strips out this reframe. It's a subtle but real tone/values loss — it affects how one should talk about the product's premise (not "help him remember better" but "give his ideas somewhere to land").

### 5. The specific cost of unrealized business-growth ideas — DILUTED

Brief §"The Problem": *"Le coût réel n'est pas la perte d'idées ponctuelles, mais le temps et l'énergie mentale dépensés à essayer de tout retenir, et les idées de développement d'entreprise qui n'aboutissent jamais faute d'un endroit où les laisser mûrir puis les reprendre."*

Brief §Success Criteria, third bullet: *"Plus d'idées d'entreprise qui aboutissent"* — explicitly named as a success criterion distinct from "zéro idée perdue," with a note that measuring it is Guillaume's own responsibility, not a feature.

The PRD's Vision (§1) generalizes this to "ses meilleures idées lui viennent hors du bureau" without naming *company-growth ideas specifically* as the ones most at risk of dying for lack of an incubation space. The PRD's Success Metrics (§7) has SM-3 ("usage régulier et durable") as its only secondary metric, which is a retention proxy — it does not carry forward the brief's sharper claim that success looks like *more business ideas actually being followed through*. The Non-Goals section (§5) captures the "no in-app business measurement" half but not the qualitative aspiration itself.

### 6. Long-term vision — invisibility and scaling beyond a dozen projects — MISSING

Brief §Vision: two to three years out, the tool has become invisible (Guillaume no longer wonders where to put an idea), and the number of simultaneous projects has been able to grow past the current ten without a corresponding rise in mental load. The brief also notes, as an emergent (not designed-for) outcome, that the app has taken on a role in Strat'Edge's sales conversations.

The PRD has no forward-looking narrative of this kind. Its Vision (§1) is scoped to the present/V1 reality; nothing carries forward the "invisible tool" aspiration or the explicit scaling goal (more projects, same cognitive load). Since this describes what "done well" looks like beyond feature-completeness, it's a qualitative signal a PRD reader would benefit from, even if it doesn't translate into a testable FR today.

## Not gaps (verified present in PRD)

- Vitrine/showcase business motivation — carried into PRD §1 Vision and §2.1 "Sociaux/contextuels".
- All V1 concrete scope items (capture flow, offline, notes/tasks/documents, calendar, push notifications, auth) — fully translated into FR-1–FR-37.
- All explicit V1 exclusions (multi-user, third-party calendar integration, native apps, business reporting, AI synthesis assistant) — carried into Non-Goals §5 and MVP Scope §6.2.
- "Zéro idée perdue" and "reprise sans effort" success criteria — carried into SM-1 and SM-2.
- V2 AI-assistant addendum pointer — carried into Non-Goals §5 and MVP §6.2.
