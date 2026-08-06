# Reconciliation — DESIGN.md vs. Strat'Edge Brand Source

Sources compared:
- `Strat'Edge/Branding/couleurs.md` (brand color reference, French, sourced from Impreza palette on www.stratedge.ch)
- `_bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md` (frontmatter `colors` block + prose)
- Logo assets in `Strat'Edge/Branding/Logos/`: `logo-complet.png`, `Logo-Seul.png`, `logo-seul.svg`

## 1. Hex Color Verification

Every DESIGN.md frontmatter color that maps to a value present in `couleurs.md` was checked hex-for-hex.

| DESIGN.md token | DESIGN.md hex | couleurs.md source value | Match |
|---|---|---|---|
| primary | `#2F80ED` | Couleur principale `#2F80ED` | ✅ exact |
| secondary | `#56A3FF` | Couleur secondaire `#56A3FF` | ✅ exact |
| bg | `#F4F7FB` | Fond clair `#F4F7FB` | ✅ exact |
| bg-alt | `#E9EEF5` | Fond alternatif `#E9EEF5` | ✅ exact |
| border | `#D5DCE5` | Bordure `#D5DCE5` | ✅ exact |
| header-bg | `#0F2A44` | Arrière-plan header `#0F2A44` | ✅ exact |
| header-text | `#FFFFFF` | Texte/Liens header `#FFFFFF` | ✅ exact |
| text | `#2B2F33` | Texte courant (body) `#2B2F33` | ✅ exact |
| heading | `#0F2A44` | Titres/Entêtes (body) `#0F2A44` | ✅ exact |
| muted | `#7A8594` | Texte délavé/secondaire `#7A8594` | ✅ exact |
| link-hover | `#1C5DC9` | Liens au survol (body) `#1C5DC9` | ✅ exact |
| priority-haute | `#2F80ED` (= primary) | Couleur principale `#2F80ED` | ✅ exact |
| priority-normale | `#56A3FF` (= secondary) | Couleur secondaire `#56A3FF` | ✅ exact |
| priority-basse | `#7A8594` (= muted) | Texte délavé `#7A8594` | ✅ exact |

**Result: no mismatches.** All 14 tokens that trace to a specific `couleurs.md` value match exactly, character for character.

### Dark-theme tokens — not a mismatch, but not verifiable against the source either

`bg-dark #0A1B2E`, `surface-dark #13293F`, `surface-2-dark #1B3350`, `border-dark #2B4560`, `text-dark #E7ECF3`, `muted-dark #93A4B8` have **no corresponding entries in `couleurs.md`** — the brand reference only defines a light-theme palette (Impreza site palette). DESIGN.md's own prose (line 145) is explicit that these are *"dérivations tonales de la marine de marque (`#0F2A44`) et du gris `#7A8594`"* — i.e., deliberately hand-derived, not claimed as literal brand hex values. Since they don't claim direct brand sourcing, they are excluded from the mismatch check per the task's scope. Flagging only as an observation: `bg-dark #0A1B2E` is close to but distinct from `couleurs.md`'s `#0A1F33` ("Barre d'outils navigateur" / footer fond alternatif) — if the intent was ever to reuse that specific brand value rather than derive a new one, that's a design choice to confirm with the author, not an error.

## 2. Logo Usage Guidance vs. Available Assets

**Finding: DESIGN.md contains no logo usage guidance at all.** A full-text search for "logo", "splash", "favicon", "PNG", "SVG", "icon", "vector/vectoriel" turns up zero mentions of logo placement, splash-screen branding, or favicon treatment anywhere in the document (frontmatter or prose). The only marque-related content is the color palette and the note that `header-bg`/`primary` are brand-fixed colors.

This means the document cannot be checked for whether it "accounts for" the asset gap — it never engages with the logo files at all. That is itself the gap to flag:

- Available assets: `logo-complet.png` (raster, full logo w/ wordmark), `Logo-Seul.png` (raster, mark only), `logo-seul.svg` (vector, **mark only**). **No vector version of the full/complet logo exists.**
- DESIGN.md specifies a header (`header-bg`, `header-text` tokens, section "Entête") and describes it as "fond du header... couleur de marque, ne varie pas avec le thème" but never specifies what logo/mark, if any, sits in that header, nor its source file or format.
- No splash-screen section exists in the document at all.
- No favicon guidance exists at all.
- Consequently, DESIGN.md does **not** assume a vector full-logo that doesn't exist — but only because it never specifies a logo asset or format for any of these three placements. This is a completeness gap, not an incorrect-assumption gap: whoever implements the header/splash/favicon will have to make an undocumented call, and the natural failure mode is reaching for `logo-complet.png` at a large display size (e.g. splash) or trying to vectorize it, since only the mark-only version (`logo-seul.svg`) is actually vector.

**Recommendation:** add an explicit "Logo Usage" subsection to DESIGN.md that: (a) specifies mark-only (`Logo-Seul.png` / `logo-seul.svg`) for small/high-DPI contexts like favicon and compact header, since it's the only vector asset; (b) specifies whether the header uses the mark alone or mark+wordmark, and if the latter, flags that `logo-complet.png` is raster-only and will need re-export or redrawing as SVG if crisp scaling is required (e.g., splash screen at large sizes); (c) confirms favicon source (raster PNG will need multi-resolution export since no SVG "complet" exists, and even mark-only SVG will need favicon-specific sizing/simplification).

---

*Prepared for: Strat'Edge — Project Note UX design reconciliation, 2026-08-03/04.*
