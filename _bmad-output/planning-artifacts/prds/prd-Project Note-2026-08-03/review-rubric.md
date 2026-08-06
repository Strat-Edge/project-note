# PRD Quality Review — Application de gestion de projets personnelle (Project Note, 2026-08-03)

## Overall verdict

This is a well-calibrated internal-tool PRD: the capability-spec shape fits a mono-user consultant tool, the thesis (single capture point, structured retrieval, works offline) is carried consistently from Vision through Features to Success Metrics, and assumptions/open questions are tagged and indexed rather than smuggled in. The main risks are mechanical, not conceptual — an FR numbering break (FR-39 lodged between FR-31 and FR-32) and a stray cross-reference (§8 vs §9) — plus a couple of places where a decision is stated without its rationale (on-demand transcription) or a bound is left as an adjective ("discret"). Nothing here blocks downstream UX/architecture work, but the numbering gap should be fixed before FR IDs get cited in story files.

## Decision-readiness — strong

Trade-offs are mostly surfaced with what was given up, not just what was chosen. §4.10's rejection of magic-link auth in favor of email/password is justified directly by document sensitivity. §4.9's `[NOTE FOR PM]` on iOS notification limits is a real tension — it says the risk is low-priority *today* because Guillaume's device is Android, but keeps it because the tech spec requires iOS 16.4+ support, i.e. it doesn't resolve the tension, it names it and defers the priority call. §5's branding NFR explicitly states it's "exigence de premier ordre, pas un item de polish," which is a genuine prioritization statement rather than balanced-everything language.

### Findings
- **medium** On-demand transcription trade-off stated without rationale (§4.4, FR-17) — FR-17 says transcription is generated "à la demande" rather than automatically, but never states why (API cost per call? user preference for audio-only? latency?). Downstream architecture will need to know whether this is a cost constraint or a UX choice, since that changes whether it's ever worth revisiting. *Fix:* add one sentence naming the reason (e.g. "évite un coût Whisper sur chaque note vocale non pertinente").

## Substance over theater — strong

No persona inflation (one user, three UJs, all load-bearing — UJ-1 drives FR-1/FR-5, UJ-2 drives FR-24/FR-25, UJ-3 drives FR-11). The two Cross-Cutting NFRs (§5) are both specific and traceable to a concrete cause — branding fidelity ties to an actual file path (`Strat'Edge/Branding/couleurs.md`) and a stated commercial reason (showcase to clients), and document confidentiality ties directly to the auth decision in FR-38. Neither reads as template boilerplate. The Vision statement (§1) is anchored in Guillaume's specific situation (~10 concurrent projects, ideas arriving off-hours) rather than being swappable into a generic PM-tool PRD.

No findings.

## Strategic coherence — strong

The thesis — "seul endroit" for capture, retrievable structured by project, regardless of connectivity — is carried through consistently: capture flow (§4.1), offline-first (§4.8), provenance/"nouveau" badges (§4.6) all serve it. SM-1 ("zéro idée/tâche/document perdu") and SM-2 (immediate retrieval via nouveau/provenance) validate the thesis directly rather than measuring activity. The counter-metric SM-C1 is correctly targeted at the exact tension the thesis creates (capture speed vs. field richness) rather than being a generic counter-metric. SM-3 (regular usage) is activity-flavored but is explicitly Secondary, which is an honest way to handle it.

No findings.

## Done-ness clarity — adequate

Most FRs carry explicit, testable consequences (FR-8, FR-23, FR-25 are good examples — FR-23 in particular fully specifies sort-combination behavior). Where FRs lack a "Consequences" block, the FR statement itself is usually self-evidently testable (e.g. FR-20 "télécharge un document"). Two spots fall short of that bar.

### Findings
- **low** FR-18 file-type expectation isn't a testable rule (§4.5, FR-18) — "Types de fichiers attendus en usage courant : photos et PDF (pas de vidéo ou fichier volumineux anticipé à ce stade)" reads as a scoping expectation, not a functional constraint. An engineer can't tell whether to validate/reject unexpected file types or simply accept anything. *Fix:* state explicitly whether upload validates file type/size or accepts anything without restriction in MVP.
- **low** "Indicateur discret" is an unbounded adjective (§4.8, FR-34) — the sync-status indicator is specified only as "discret et permanent" with three states named, but "discret" carries no visual/behavioral bound. Low stakes for a solo tool, but it's the kind of adjective the rubric flags on sight. *Fix:* not urgent; can be resolved in UX phase.
- **low** SM-1 has no stated verification method (§8) — "absence de tout cas connu d'information capturée devenue irrécupérable" is a reasonable metric for a mono-user tool but doesn't say how Guillaume would notice or log a loss event. *Fix:* optional — a one-line note on how this gets checked (e.g. periodic manual review) would close the loop.

## Scope honesty — strong

§6 Non-Goals is decisive, not hedged ("ne sera jamais vendue à des tiers"), and §7.2 cleanly separates the one deferred-to-V2 item (AI note synthesis, cross-referenced to the brief addendum) from items with no V2 path identified. All 5 inline `[ASSUMPTION]` tags round-trip cleanly to the 5 entries in §10 Assumptions Index (FR-3 priority levels, capture-flow open time, FR-18 file size, FR-23 default sort, FR-32 upload resume). Open-items density (4 Open Questions + 5 Assumptions + 2 NOTE FOR PM across 39 FRs) is proportionate to an internal tool, not a red flag.

No findings.

## Downstream usability — adequate

§0 states this PRD feeds UX/architecture/epics workflows, so ID hygiene matters here more than it would for a standalone PRD. The Glossary (§3) is used consistently across FRs with no case/synonym drift, and all three UJs carry a named protagonist (Guillaume) inline. Two mechanical issues will trip up anything that parses FRs in numeric or document order.

### Findings
- **medium** FR-39 breaks ID contiguity (§4.7) — FR-39 ("Affichage visuel de la priorité dans le calendrier") sits between FR-31 and FR-32 in document order, i.e. after the FR-1…FR-31 run and before FR-32…FR-38. Anything downstream that assumes FR IDs are contiguous or monotonically ordered by document position (story generation, traceability matrices) will stumble on this. *Fix:* renumber FR-39 to fit the sequence (e.g. FR-31a or a full renumber pass) or leave a one-line note explaining it was appended later.
- **low** Assumption tag cites the wrong section (§4.5, FR-18) — the inline tag reads "`[ASSUMPTION: taille maximale de fichier non définie — indexé en §8 Open Questions]`" but Open Questions is §9, not §8 (§8 is Success Metrics). *Fix:* correct the inline reference to §9.
- **low** "Tâche générale" used but not glossed (§4.1 FR-2, §4.3) — a task without a project is called "tâche générale" in FR-2 and implied elsewhere, but the term isn't in the §3 Glossary alongside Tâche. *Fix:* add a one-line Glossary entry or fold it into the existing Tâche definition.

## Shape fit — strong

The capability-spec shape (Features §4.1–4.10, each with nested numbered FRs) is the right call for a single-operator internal tool — it avoids forcing UJ density where FRs alone would do. The three UJs that do exist are used sparingly and each maps to specific FRs rather than existing for their own sake. Success Metrics are operational (capture reliability, retrieval speed) rather than forced into consumer-engagement framing. No enterprise scaffolding (stakeholder sign-off, SLAs, compliance) is present, which is correct for this PRD's stakes.

No findings.

## Mechanical notes

- **ID continuity**: FR-39 is out of sequence (see Downstream usability finding above) — the only numbering break found; FR-1 through FR-38 otherwise run contiguously section by section.
- **Cross-reference**: FR-18's assumption tag points to "§8 Open Questions" when Open Questions is actually §9 (see above).
- **Assumptions Index roundtrip**: clean — all 5 inline `[ASSUMPTION]` tags (FR-3, FR-1 NFR, FR-18, FR-23, FR-32 NFR) appear in §10, and all 5 index entries have a matching inline tag.
- **Glossary drift**: none of significance; terms (Projet, Tâche, Note, Provenance, Statut "nouveau", Calendrier général, Synchronisation, Rappel) are used consistently across FRs. Only gap is "tâche générale" (see above).
- **UJ protagonist naming**: clean — all three UJs (§2.3) name Guillaume and carry device/context inline (téléphone/soir for UJ-1, ordinateur/lendemain for UJ-2, téléphone/entre deux rendez-vous for UJ-3).
