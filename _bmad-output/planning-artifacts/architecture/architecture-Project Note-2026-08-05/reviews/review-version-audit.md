---
name: 'Version Audit — Architecture Spine Stack'
type: review
purpose: verification
altitude: initiative
target: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md
reviewed: 2026-08-05
---

# Version Audit — Stack Section vs. Fresh Web Research

Method: for every pinned technology/version in the Stack table, (1) checked whether the `.memlog.md` contains a `(version)` entry showing evidence of web verification, then (2) ran an independent fresh web search/fetch today (2026-08-05) — preferring the npm registry API (`registry.npmjs.org/<pkg>/latest`) for exact package versions, and vendor docs/GitHub for framework and API claims — to confirm the pin is still accurate and still the right fit.

## Summary verdict

**PASS.** Every pinned technology has a corresponding `(version)` memlog entry with an explicit verification claim, and every one of my fresh independent checks confirms the pin is accurate or within normal patch-level drift of an actively-released package. No pin is asserted from training data without memlog evidence. Two packages (`@serwist/next`, `@supabase/supabase-js`) have since ticked up by one patch version in the time since the memlog was written — expected drift for fast-moving packages, not a defect in the architecture, but worth a refresh before implementation starts.

## Per-technology findings

### 1. Next.js 16.3.0 (App Router, React 19.2)
- **Memlog evidence:** line 15 — "Next.js 16.3.0 (App Router, React 19.2) — vérifié web, actif."
- **Fresh check:** `registry.npmjs.org/next/latest` → `"version": "16.3.0"`. Exact match.
- **Verdict:** CONFIRMED, still current and correct.

### 2. Serwist / `@serwist/next` 9.5.11
- **Memlog evidence:** line 16 — "vérifié web, toolkit PWA/service worker recommandé pour Next.js App Router en 2026 (successeur de next-pwa, lui-même à l'arrêt)."
- **Fresh check:** `registry.npmjs.org/@serwist/next/latest` → `"version": "9.5.12"` (one patch ahead of the pin). The framing (Serwist as the maintained successor to next-pwa) still holds.
- **Verdict:** CONFIRMED as the right choice; **minor drift** — 9.5.11 → 9.5.12 patch released since the memlog was written. Not a correctness issue, just re-pin before implementation.

### 3. Dexie.js 4.4.4
- **Memlog evidence:** line 17 — "vérifié web, stockage de Blob confirmé pour fichiers/audio hors ligne."
- **Fresh check:** `registry.npmjs.org/dexie/latest` → `"version": "4.4.4"`. Exact match. Blob storage in IndexedDB via Dexie remains a supported, standard pattern.
- **Verdict:** CONFIRMED.

### 4. `@supabase/supabase-js` 2.112.0
- **Memlog evidence:** line 18 — "vérifié web, actif."
- **Fresh check:** `registry.npmjs.org/@supabase/supabase-js/latest` → `"version": "2.112.1"` (one patch ahead; this package publishes very frequently — a prior search even showed a build published ~21h before this audit).
- **Verdict:** CONFIRMED as the right package/major line; **minor drift** — expected given release cadence. Re-pin at implementation time rather than treating 2.112.0 as frozen truth.

### 5. web-push (Node, VAPID) 3.6.7
- **Memlog evidence:** line 19 — "vérifié web, standard VAPID toujours utilisé, cadence de release ralentie mais pas de remplaçant clair."
- **Fresh check:** `registry.npmjs.org/web-push/latest` → `"version": "3.6.7"` confirmed as the current `latest` dist-tag; independent search corroborated "last published" a long time ago with no newer release and no announced successor/deprecation notice on the GitHub repo.
- **Verdict:** CONFIRMED, and the memlog's own caveat about slowed release cadence is accurate and appropriately flagged — this is the one pin where the "evidence" already anticipated the risk rather than asserting blind confidence. No action needed beyond what's already noted.

### 6. OpenAI transcription — `gpt-transcribe` (replacing `whisper-1`)
- **Memlog evidence:** line 20 — explicit note that whisper-1 is legacy, replaced by gpt-transcribe in 2026, cheaper and more reliable; also a dedicated decision entry (line 25) documenting that Web Speech API was evaluated and rejected as an alternative.
- **Fresh check:** OpenAI's current speech-to-text guide explicitly recommends starting with `gpt-transcribe` for transcribing recorded speech; `whisper-1` is **not deprecated** but is now scoped to niche cases (word/segment timestamps, translation-to-English) rather than general transcription. This is a more precise picture than the memlog's "legacy/retiré" framing — whisper-1 is still supported, just no longer the recommended default — but the architecture's actual choice (`gpt-transcribe` for batch file transcription, server-side only) is correct and matches OpenAI's current guidance.
- **Verdict:** CONFIRMED as the right model choice. **Minor wording nuance:** the Stack table's parenthetical "remplace whisper-1, legacy/retiré" slightly overstates whisper-1's status (it's de-emphasized, not retired/removed) — cosmetic, does not affect the architecture decision.

### 7. TypeScript 7.0.2
- **Memlog evidence:** line 21 — "vérifié web, c'est la version que Next.js 16.3 cible nativement (toolchain natif Go, gain de perf ~10x sur le typechecking). Pairing officiel confirmé malgré quelques accrocs de détection initiaux déjà corrigés."
- **Fresh check:** `registry.npmjs.org/typescript/latest` → `"version": "7.0.2"`. Exact match. Independent search confirms TypeScript 7.0 (native Go-based compiler) shipped stable July 8, 2026, delivering the claimed 8–12x build-speed improvement — consistent with the memlog's "~10x" framing.
- **Verdict:** CONFIRMED.

### 8. Render hosting (Web Service + Cron Job)
- **Memlog evidence:** line 11 — explicit rationale (existing Render usage, full App Router support via Web Service including route handlers/server actions/middleware, Cron Jobs from ~$1/month) presented as "vérifié."
- **Fresh check:** Independent research confirms Render runs Next.js as a standard Node.js process (Web Service) supporting route handlers, server actions, and middleware; Render Cron Jobs are billed per-minute with a confirmed **$1/month minimum** floor, matching the memlog's "~1$/mois" claim exactly.
- **Verdict:** CONFIRMED, still the right fit as of today.

## Discrepancies / flags

| Item | Type | Detail | Action needed |
| --- | --- | --- | --- |
| `@serwist/next` | Minor version drift | Pinned 9.5.11, registry now shows 9.5.12 | None for the spine (architecture-level, not a lockfile); re-verify exact version at implementation start |
| `@supabase/supabase-js` | Minor version drift | Pinned 2.112.0, registry now shows 2.112.1 | Same as above — re-verify at implementation start, this package ships near-daily |
| `gpt-transcribe` wording | Cosmetic | Stack table says whisper-1 is "legacy/retiré"; OpenAI docs show it's de-emphasized but still supported for niche use (timestamps, translation) | Optional: soften wording in AD-8/Stack table from "legacy/retiré" to "no longer recommended for general transcription" — does not change the technology decision |

No pin was found to be asserted without memlog verification evidence, and no fresh search surfaced a materially different or better-fit technology than what's already committed in the spine.
