---
baseline_commit: 98e3462fa08fdc789a07435a8404b21723de3a47
---

# Story 1.3: Application de l'identité visuelle Strat'Edge

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Guillaume,
I want que l'application affiche les couleurs, la typographie et le logo Strat'Edge dès le premier écran,
so that l'app soit immédiatement crédible visuellement, y compris pour la montrer à un client.

## Acceptance Criteria

1. **Given** les tokens de couleur/typographie/rayons/espacement définis dans DESIGN.md **When** n'importe quel écran de l'application est affiché **Then** il utilise exclusivement ces tokens (aucune couleur ou police codée en dur hors palette).
2. **Given** le thème clair ou sombre sélectionné **When** l'utilisateur bascule entre les deux **Then** l'ensemble de l'interface s'adapte sans rupture visuelle, le header restant en couleur de marque fixe dans les deux thèmes.
3. **Given** l'application installée en PWA **When** l'utilisateur la lance depuis l'écran d'accueil **Then** le logo complet Strat'Edge apparaît sur l'écran de démarrage (splash screen), et le symbole seul comme favicon et dans le header. **[Amendé post-implémentation, cf. Change Log 2026-08-07]** Guillaume a explicitement demandé le lockup horizontal (cheval + wordmark + slogan) dans le header plutôt que le symbole seul, jugé trop petit — le favicon/apple-icon/icônes manifest restent le symbole seul, seul le header a changé. Déviation assumée, pas un défaut d'implémentation.
4. **Given** n'importe quel élément interactif de l'interface **When** il est construit **Then** il respecte le socle d'accessibilité d'EXPERIENCE.md : cible tactile ≥44px/48dp, rôle et état exposés au lecteur d'écran, ordre de focus clavier aligné sur la lecture, transitions désactivées si Reduce Motion est actif.

## Tasks / Subtasks

- [x] Task 1: Purger les vestiges non conformes au socle typographique (AC: #1)
  - [x] Retirer les imports `Geist`/`Geist_Mono` de `next/font/google` dans `app/layout.tsx` — chargés depuis la Story 1.1. `globals.css` ne les consomme pas (`font-family: Arial, Helvetica, sans-serif` en dur), mais `app/page.module.css` (placeholder `create-next-app`) référence bien `var(--font-geist-sans)`/`var(--font-geist-mono)` — sans effet une fois ce fichier réécrit par Task 4. Cette police custom viole UX-DR2 ("aucune police custom chargée") et représente une requête réseau superflue, contraire à l'esprit offline-first — à retirer dans tous les cas, peu importe l'usage actuel.
  - [x] Retirer les deux `className` liés (`geistSans.variable`, `geistMono.variable`) sur `<html>`.
- [x] Task 2: Établir le système de tokens design complet dans `app/globals.css` (AC: #1, #2)
  - [x] Définir en `:root` l'intégralité des tokens couleur de `DESIGN.md` (frontmatter `colors`) en custom properties CSS — y compris priorité, danger, et les 8 couleurs de rotation projet, **même si rien ne les consomme encore** (UX-DR1 : "système de tokens couleur complet" ; Epic 1 pose le socle que les epics suivants réutilisent sans le reconstruire).
  - [x] Ajouter la surcharge `@media (prefers-color-scheme: dark)` avec les valeurs `-dark` de `DESIGN.md` — **jamais une inversion automatique** (cf. Do's/Don'ts DESIGN.md). `--color-header-bg` et `--color-header-text` ne changent PAS entre les deux thèmes (couleur de marque fixe, cf. AC#2).
  - [x] Définir les tokens typographiques (`--font-family` = pile système `DESIGN.md.typography.fontFamily.default`, puis taille/graisse/interligne pour chaque rôle : display, heading, body, label, caption, micro).
  - [x] Définir l'échelle de rayons (`--radius-sm/md/lg/xl/full/default`) et d'espacement (`--space-1` à `--space-8`, `--space-gutter`, `--space-card-gap`) exactement selon `DESIGN.md.rounded`/`DESIGN.md.spacing`.
  - [x] Remplacer `body { font-family: Arial, Helvetica, sans-serif }` par `var(--font-family)` ; remplacer `--background`/`--foreground` génériques par les tokens de marque (`--color-bg`, `--color-text`).
  - [x] Ajouter la règle d'accessibilité Reduce Motion globale (cf. Task 7) dans ce même fichier — c'est l'infrastructure de tokens, donc son emplacement naturel.
- [x] Task 3: Refactoriser l'écran de connexion pour consommer les tokens globaux (AC: #1, #2)
  - [x] `app/login/login-form.module.css` : supprimer le bloc de custom properties locales dupliquées (`--border`, `--border-focus`, `--text`, `--muted`, `--danger`, `--surface` + leur surcharge `@media (prefers-color-scheme: dark)`) — ces valeurs sont déjà correctes (cf. Story 1.2 Completion Notes, déviation assumée) mais dupliquent maintenant les tokens globaux. Remplacer chaque usage par `var(--color-border)`, `var(--color-primary)` (utilisé comme `border-focus`), `var(--color-text)`, `var(--color-muted)`, `var(--color-danger)`, `var(--color-bg)`.
  - [x] Aligner les tailles/graisses de police du formulaire sur les rôles typographiques : `.label` déjà conforme au rôle `label` (12.5px/700/0.3px) — vérifier et garder ; `.input`/`.submit` doivent utiliser le rôle `body` (13.5px/600) au lieu du 14px codé en dur.
  - [x] `.input`/`.submit` : remplacer les rayons codés en dur (10px, 9px) par `var(--radius-default)`/`var(--radius-md)`.
  - [x] `app/login/page.module.css` ne contient aucune valeur codée en dur (juste du flex layout) — ne pas y toucher.
- [x] Task 4: Neutraliser le placeholder `create-next-app` sur l'écran protégé `/` (AC: #1)
  - [x] `app/page.tsx` est toujours le placeholder généré (logos Next.js/Vercel, CTA "Deploy Now", styles codés en dur) — jamais retouché depuis la Story 1.1 (décision explicite Story 1.2 de ne pas construire un faux écran Général). Cette story **ne construit pas** l'écran Général (Epic 4) mais **doit** faire disparaître les couleurs/logos non-Strat'Edge codés en dur pour respecter l'AC#1 sur cet écran réellement atteignable (authentifié → `/`). Remplacer le contenu par un placeholder neutre minimal (ex. texte "Connecté." dans le style `body`, rien d'autre) — pas de nouvelle fonctionnalité, juste la suppression du branding Next.js/Vercel et des styles en dur.
  - [x] `app/page.module.css` : supprimer toutes les valeurs codées en dur restantes (variables `--font-geist-sans`/`--font-geist-mono`, couleurs `--background`/`--foreground`/`--text-primary` et autres hex/rgb du placeholder `create-next-app`) ; garder uniquement ce qui reste nécessaire au layout minimal, en tokens.
- [x] Task 5: Construire le composant Header partagé avec le logo Strat'Edge (AC: #1, #2, #3, #4)
  - [x] Créer `components/header.tsx` (+ `components/header.module.css`) : fond `var(--color-header-bg)` fixe (identique clair/sombre), texte `var(--color-header-text)`, logo aligné à gauche, hauteur cohérente avec une cible tactile ≥44px/48dp si le logo est interactif. Pas d'ombre propre (cf. DESIGN.md Elevation : "le header n'a pas d'ombre propre"). **[Amendé post-implémentation]** Le symbole seul initial (`Logo-Seul.png`) a été remplacé par le lockup horizontal `logo-horizontal.png` (cheval + wordmark + slogan) à la demande explicite de Guillaume — cf. AC#3 et Change Log 2026-08-07.
  - [x] **Hors périmètre explicite de cette story** : le switcher segmenté (niveau 1 Général/Projets) qui vit normalement sous le header. `EXPERIENCE.md` (Information Architecture) le place "sous le header, **partout sauf Connexion**" — mais le header lui-même (avec le logo) est présent sur Connexion aussi (implicite : seul le switcher en est absent). Le switcher est construit par la Story 2.2 ("Liste et navigation des projets") — ne pas l'anticiper ici, ne monter que le logo.
  - [x] Monter `<Header />` dans `app/layout.tsx`, à l'intérieur de `<body>`, avant `{children}` — un seul point de montage pour que le header apparaisse sur **tout écran** (`/login` inclus, cohérent avec l'AC Epic 1 "dès le premier écran" et avec DESIGN.md "l'app n'est jamais montrée sans logo Strat'Edge visible").
  - [x] Accessibilité : utiliser la balise sémantique `<header>` (landmark implicite `role="banner"`), texte alternatif explicite sur le logo (`alt="Strat'Edge"`), pas de lien/interaction pour l'instant (pas de nav construite ici) donc pas de cible tactile requise sur le logo lui-même tant qu'il n'est pas cliquable.
- [x] Task 6: Optimiser puis générer l'ensemble des assets d'icônes/splash PWA depuis la charte (AC: #3)
  - [x] **Le SVG source est cassé pour un usage direct, ne pas partir sur "juste passer SVGO dessus" :** `Strat'Edge/Branding/Logos/logo-seul.svg` pèse 2 Mo parce qu'il contient **12 images raster encodées en base64 embarquées** (`<image>`, tailles 354/500/621/769px, sous des `<filter>`/`<mask>`) — probablement un export Illustrator avec ombrage/dégradé, pas un tracé vectoriel propre. SVGO (nettoyage de markup/paths) ne recompresse ni ne supprime ce payload raster par défaut : l'exécuter tel quel ne descendra **pas** à "quelques Ko". Confirmé, non exécuté.
  - [x] **Source pragmatique retenue à la place :** `Strat'Edge/Branding/Logos/Logo-Seul.png` (291×294, 77 Ko, déjà un raster plat propre du symbole) — utilisée comme source unique pour **toutes** les icônes (favicon, apple-icon, icônes manifest) via `sharp` (`scripts/generate-icons.mjs`). Copiée aussi vers `public/brand/logo-symbol.png` comme source pour le logo affiché dans `components/header.tsx`.
  - [x] `app/icon.svg` abandonné (pas de vecteur propre disponible) — `app/favicon.ico` (ICO multi-résolution 16/32/48 via `png-to-ico`) et `app/apple-icon.png` (180×180) générés depuis `Logo-Seul.png`.
  - [x] `app/apple-icon.png` généré (180×180) depuis `Logo-Seul.png`.
  - [x] `public/icons/icon-192.png` et `public/icons/icon-512.png` générés aux dimensions exactes déclarées dans `app/manifest.ts`, depuis `Logo-Seul.png`.
  - [x] `public/icons/icon-512-maskable.png` généré : symbole à 65% du canvas 512×512, fond plein `#0F2A44` ; `purpose: "maskable"` déclaré dans le manifest, `purpose: "any"` pour `icon-512.png`.
  - [x] `app/manifest.ts` mis à jour : icônes 192/512/512-maskable ; `background_color`/`theme_color` inchangés. `public/icon-placeholder.svg` supprimé.
  - [x] **Splash screen (logo complet, AC#3)** généré via `pwa-asset-generator` (npx, non ajouté en dépendance permanente) — 46 images `public/splash/apple-splash-*.png` (tous formats/orientations iOS scrapés depuis les Apple Human Interface Guidelines actuelles), balises `<link rel="apple-touch-startup-image">` consommées via `metadata.appleWebApp.startupImage` (API Metadata native de Next.js, cf. Review Findings — remplace l'approche initiale par composant + `<head>` manuel) dans `app/layout.tsx`. **[Amendé post-implémentation]** Source et fond régénérés depuis `Strat'Edge_h_b_slogan.png` sur fond `#0F2A44` (`colors.header-bg`) — l'ancien `logo-complet.png`/fond `#F4F7FB` (illisible, texte du logo blanc) n'existe plus, cf. Change Log 2026-08-07. Android/Chrome : limite de plateforme documentée (pas de splash personnalisé possible, seul l'icône+`background_color` s'affiche, déjà couvert par le manifest).
- [x] Task 7: Socle d'accessibilité transversal (AC: #4)
  - [x] Règle globale Reduce Motion ajoutée dans `app/globals.css` (cf. Task 2).
  - [x] Cibles tactiles vérifiées : `.input`/`.submit` toujours `min-height: 48px` après le passage aux tokens (non-régression confirmée).
  - [x] Header : logo avec texte alternatif explicite (`alt="Strat'Edge"`).
  - [x] Aucun contrôle de bascule clair/sombre manuel ajouté — `prefers-color-scheme` seul pilote le thème.
- [x] Task 8: Vérification manuelle de bout en bout (AC: #1, #2, #3, #4)
  - [x] `npm run build` réussit sans erreur.
  - [x] `npm run lint` propre.
  - [x] Grep manuel du diff pour couleur/police codée en dur hors `globals.css` : zéro résultat dans le CSS/TSX applicatif — seuls `themeColor` (layout.tsx) et `background_color`/`theme_color` (manifest.ts) restent en hex littéral, ce qui est inhérent à la Metadata/Manifest API (pas de `var()` CSS possible côté serveur) et correspond exactement aux valeurs de marque.
  - [x] Bascule clair ↔ sombre vérifiée en navigateur (émulation `prefers-color-scheme`) sur `/login` et `/` : `--color-bg`/`--color-text`/`--color-surface`/`--color-border` réagissent correctement (valeurs `-dark` confirmées via `getComputedStyle`), `--color-header-bg`/`--color-header-text` restent `#0F2A44`/blanc dans les deux thèmes (vérifié sur le header réel).
  - [x] Manifest vérifié via `/manifest.webmanifest` : 3 icônes présentes avec les bonnes tailles/purpose. Favicon, apple-icon, et les 3 icônes manifest confirmés HTTP 200 sans authentification (`curl`).
  - [x] **Bug découvert et corrigé pendant la vérification** : `proxy.ts` redirigeait `/brand/*` (nouveau) vers `/login` faute d'exclusion dans le matcher, ce qui cassait silencieusement l'optimiseur d'image Next.js (`_next/image` recevait une redirection au lieu du fichier → 400 "isn't a valid image"). Corrigé en ajoutant `brand/`, `icons/`, `splash/`, `apple-icon.png` aux exclusions du matcher (route déjà exclue `icon-placeholder.svg`, supprimée car le fichier n'existe plus). Revérifié : toutes les icônes chargent en 200 sans session.
  - [x] Splash iOS non vérifiable sur appareil physique dans cette session (aucun matériel disponible) — image source `public/splash/apple-splash-1170-2532.png` inspectée visuellement : logo complet + wordmark correctement centrés sur fond `#F4F7FB`, conforme à l'AC. À reconfirmer par Guillaume sur un vrai iPhone après installation "Ajouter à l'écran d'accueil".
  - [x] Règle Reduce Motion présente dans `globals.css` (CSS standard, aucun mécanisme d'émulation exposé par les outils de vérification disponibles dans cette session — non testable interactivement ici, mais la règle est correcte par construction et n'affecte rien tant qu'aucune transition n'existe).
  - [x] Navigation clavier (Tab) sur `/login` vérifiée : premier `Tab` cible directement le champ Email (les inputs cachés du formulaire ne sont pas atteignables), `outline`/`border-color` bascule sur `--color-primary` au focus, `min-height: 48px` confirmé sur les deux champs.

### Review Findings

- [x] [Review][Defer] `--color-danger`/`--color-muted` échouent au contraste WCAG AA sur fond clair — `#D64545` sur `#F4F7FB` = 4.07:1, `#7A8594` sur `#F4F7FB` = 3.48:1 (seuil AA texte normal = 4.5:1, vérifié par calcul de luminance). Valeurs copiées telles quelles depuis `DESIGN.md` (pas une erreur de calcul introduite par cette story — déjà présentes dans `login-form.module.css` depuis la Story 1.2). `EXPERIENCE.md` délègue explicitement le contraste à `DESIGN.md` ("Comportemental. Le contraste visuel vit dans DESIGN.md") sans y fixer de seuil chiffré — donc pas une violation littérale de l'AC#4, mais un vrai problème de lisibilité sur le message d'erreur de connexion, l'élément le plus sensible du flux d'authentification. Assombrir ces couleurs est une décision de charte graphique, pas un choix de code — deferred, pas prioritaire pour l'instant (Guillaume). [app/globals.css:62 `--color-danger`, :101 `--color-muted`]
- [x] [Review][Patch] `proxy.ts` peut planter sur toute route protégée si `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` est manquante ou vide — `requireEnv()` était appelé en argument de `createServerClient(...)`, donc **avant** le `try`, alors que le commentaire juste au-dessus affirme explicitement qu'une "variable d'env manquante" échoue vers "non authentifié" plutôt que de planter le proxy. Corrigé — la construction du client Supabase (et donc les deux `requireEnv()`) est maintenant à l'intérieur du `try`. [proxy.ts:18-20 → déplacé dans le `try`]
- [x] [Review][Patch] `components/ios-splash-links.tsx` (46 balises `<link>` écrites à la main) + `<head>` manuel dans `app/layout.tsx` réinventaient le champ natif `metadata.appleWebApp.startupImage` de Next.js. Corrigé — remplacé par `components/ios-splash-startup-images.ts` (données pures, tableau `{url, media}`) consommé via `metadata.appleWebApp.startupImage` dans `app/layout.tsx` ; `<head>` manuel retiré. Sortie HTML vérifiée identique (46 `<link rel="apple-touch-startup-image">`, mêmes href/media). [components/ios-splash-links.tsx → components/ios-splash-startup-images.ts, app/layout.tsx]
- [x] [Review][Patch] Documentation de la story désynchronisée de l'implémentation réelle après le changement de logo post-review. Corrigé — AC#3, Task 5, Task 6 et Dev Notes ("Distinction symbole vs. logo complet") annotés avec des renvois explicites vers le Change Log 2026-08-07 et les valeurs réelles (`Strat'Edge_h_b_slogan.png`, fond `#0F2A44`). [story file: AC#3, Task 5, Task 6, Dev Notes]
- [x] [Review][Patch] `HEADER_BG` codé en dur dans `scripts/generate-icons.mjs`, dupliqué de `--color-header-bg` (`app/globals.css`) sans lien explicite. Corrigé — commentaire explicite ajouté documentant la duplication et la nécessité de synchroniser les deux valeurs à la main si la couleur de marque change. [scripts/generate-icons.mjs:20]
- [x] [Review][Defer] `proxy.ts` — le `matcher` en liste d'exclusion codée en dur est un pattern fragile (a déjà causé le bug `brand/` de cette story) et récidivera pour tout futur dossier d'assets public/ oublié — deferred, pre-existing (pattern posé en Story 1.2, refonte en allowlist hors périmètre de cette revue). [proxy.ts:67-69]
- [x] [Review][Defer] Logique de vérification d'authentification (`try { getClaims() } catch { isAuthenticated = false }`) dupliquée à l'identique entre `proxy.ts` et `app/login/page.tsx` — deferred, pre-existing (les deux fichiers datent de la Story 1.2, extraction d'un helper partagé hors périmètre de cette revue). [proxy.ts:43-48, app/login/page.tsx:12-17]

## Dev Notes

**Ce que cette story pose vs. ce qu'elle ne construit pas :** elle établit le **socle** de tokens (couleurs complètes, typographie, rayons, espacement) et l'identité de marque visible (header + logo, favicon, splash) — pas les composants applicatifs qui les consommeront plus tard (switcher segmenté = Story 2.2, FAB = Story 3.1, carte de tâche/puce de priorité/badge/stepper/modale = epics respectifs). Ne pas préconstruire ces composants ici ; seulement les tokens et le header qu'ils utiliseront.

**Portée précise de l'AC#1 sur `app/page.tsx` :** cette page reste le placeholder `create-next-app` intouché depuis la Story 1.1 (décision explicite Story 1.2 : pas de faux écran Général avant l'Epic 4). Mais l'AC#1 de cette story ("n'importe quel écran... exclusivement ces tokens") s'applique littéralement à toute page atteignable, y compris `/` une fois authentifié. Résolution : dépouiller `/` du branding Next.js/Vercel et des couleurs codées en dur (placeholder neutre minimal), **sans** construire l'écran Général réel — cf. Task 4.

**Header monté globalement, switcher explicitement hors périmètre :** `EXPERIENCE.md` place le switcher "sous le header, partout sauf Connexion", ce qui implique que le header (logo) existe même sur Connexion — cohérent avec "l'app n'est jamais montrée sans logo visible" (DESIGN.md) et avec l'intitulé de la story ("dès le premier écran"). Monter `<Header />` une seule fois dans `app/layout.tsx` couvre `/login` et `/` sans duplication. Ne pas construire le switcher ici (Story 2.2).

**Aucun toggle thème manuel :** `prefers-color-scheme` seul pilote le thème, pattern déjà en place depuis la Story 1.1. Aucun UX-DR/FR ne décrit de contrôle dédié — ne pas en ajouter.

**Le SVG source du symbole est inutilisable tel quel :** `Strat'Edge/Branding/Logos/logo-seul.svg` (2 Mo) contient 12 images raster base64 embarquées sous des filtres/masques (export Illustrator non nettoyé, pas un tracé vectoriel) — SVGO ne le fera pas descendre à une taille raisonnable (ce n'est pas un problème de métadonnées/markup superflu, c'est du contenu raster embarqué). Ne pas s'obstiner dessus : utiliser `Strat'Edge/Branding/Logos/Logo-Seul.png` (291×294, 77 Ko, raster plat déjà propre) comme source unique pour toutes les icônes et pour le logo du header (cf. Task 6). Ne jamais référencer le SVG brut de 2 Mo depuis le code de l'app.

**Distinction symbole vs. logo complet (AC#3), à ne pas confondre — [mis à jour post-implémentation, cf. Change Log 2026-08-07] :**
- **Symbole seul** (`Strat'Edge.png` → favicon, apple-touch-icon, icônes manifest 192/512/512-maskable). Toujours carré/proche-carré. N'alimente plus le header (cf. ci-dessous).
- **Logo complet / lockup horizontal** (`Strat'Edge_h_b_slogan.png`, 457×294, cheval + wordmark + slogan, texte blanc pensé pour fond sombre) → **header** (`public/brand/logo-horizontal.png`, à la demande explicite de Guillaume, remplace le symbole seul initialement prévu par DESIGN.md) **et splash screen iOS** (sur fond `colors.header-bg` `#0F2A44`, pas `colors.bg` — le texte blanc du logo est illisible sur fond clair, cf. Change Log). Aucune plateforme (manifest standard, Android/Chrome) ne permet d'afficher une image de splash différente de l'icône — seul le mécanisme non-standard `apple-touch-startup-image` d'iOS Safari le permet, via un jeu d'images par taille d'écran (consommé via `metadata.appleWebApp.startupImage`, cf. Review Findings). Ne jamais utiliser ce logo comme icône de manifest (pas carré, contient le texte — inadapté).

**Tokens couleur complets même si non consommés partout :** UX-DR1 exige "un système de tokens couleur complet" — définir la totalité de la palette `DESIGN.md` (y compris priorité, danger, rotation projet) dans `globals.css` dès cette story, même si aucun composant actuel (task-card, priority-chip...) ne les utilise encore. Objectif explicite de l'Epic 1 : "pose le socle technique... sur lequel tous les epics suivants s'appuient" — évite que chaque epic futur redéfinisse ses propres couleurs.

**`login-form.module.css` a déjà les bonnes valeurs (Story 1.2, déviation assumée) :** pas d'erreur à corriger sur les valeurs elles-mêmes, seulement les factoriser vers les tokens globaux au lieu de les dupliquer localement (cf. Completion Notes Story 1.2, qui anticipait explicitement ce refactor).

**Architecture (AD-2) :** `components/header.tsx` ne dépend que de `domain/` (rien à importer ici, le header n'a aucune donnée métier) — respecter la règle même trivialement.

### Project Structure Notes

Fichiers à créer :
```text
components/header.tsx
components/header.module.css
public/brand/logo-symbol.png        # symbole (depuis Logo-Seul.png), source pour Header + génération des icônes
app/apple-icon.png                  # convention Next.js — 180×180
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/icon-512-maskable.png
```

Fichiers à modifier :
```text
app/layout.tsx           # retrait Geist fonts, montage <Header/>, balises apple-touch-startup-image (splash iOS)
app/globals.css          # tokens complets (couleurs/typo/rayons/espacement), règle Reduce Motion
app/favicon.ico          # remplacé par le symbole Strat'Edge (ICO multi-résolution)
app/manifest.ts          # icons[] → nouveaux fichiers (192/512/512-maskable), retrait icon-placeholder.svg
app/page.tsx              # retrait branding Next.js/Vercel, placeholder neutre minimal
app/page.module.css       # retrait valeurs codées en dur
app/login/login-form.module.css   # consomme les tokens globaux au lieu de les dupliquer localement
package.json / package-lock.json  # devDependency(ies) pour la génération d'assets (sharp et/ou pwa-asset-generator, cf. Task 6)
```

Fichier à supprimer : `public/icon-placeholder.svg` (superseded par les vraies icônes).

Aligné avec l'arborescence existante — aucun nouveau dossier de premier niveau, `components/` reçoit son premier fichier réel (jusqu'ici `export {}` vide depuis la Story 1.1).

### Testing Standards

Aucun framework de test n'est imposé par l'Architecture (identique aux Stories 1.1/1.2). Vérification manuelle exhaustive listée en Task 8 — c'est la check-list de test de cette story, pas une simple formalité : couvre les 4 AC (tokens exclusifs, bascule thème, identité PWA, accessibilité).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Fondations & Authentification, Story 1.3]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md — frontmatter colors/typography/rounded/spacing/components.logo, sections Brand & Style, Colors, Typography, Layout & Spacing, Do's and Don'ts]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md#Foundation, Information Architecture, Accessibility Floor, Responsive & Platform]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md#AD-2 (components/ ne dépend que de domain/), Consistency Conventions]
- [Source: _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md#5. Cross-Cutting NFRs (NFR-1)]
- [Source: Strat'Edge/Branding/couleurs.md — vérifié fidèle à DESIGN.md, aucune divergence trouvée]
- [Source: _bmad-output/implementation-artifacts/1-1-initialisation-et-deploiement-du-projet.md — Review Findings (icônes manifest/apple-touch-icon insuffisantes, deferred à cette story)]
- [Source: _bmad-output/implementation-artifacts/1-2-connexion-par-email-et-mot-de-passe.md — Dev Notes "Branding différé à la Story 1.3", Completion Notes (déviation assumée login-form.module.css)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — item icônes manifest/apple-touch-icon, à traiter ici]
- [Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md — conventions `icon`/`apple-icon`/`favicon`]

**Recherche technique (à vérifier à l'implémentation, versions non figées ici) :**
- **Conventions de fichiers d'icônes Next.js App Router** (vérifiée dans la doc embarquée du projet, `node_modules/next/dist/docs/...`) : `app/favicon.ico` (racine uniquement, `.ico`), `app/icon.(ico|jpg|png|svg)` et `app/apple-icon.(jpg|png)` génèrent automatiquement les balises `<link>` appropriées — aucune configuration `metadata.icons` manuelle nécessaire si ces fichiers sont présents.
- **Web App Manifest — pas de champ "splash image" standard.** Android/Chrome génère son propre splash minimal depuis `icons`+`background_color`+`name`, sans possibilité d'image personnalisée arbitraire. Seul iOS Safari supporte un vrai splash custom via les balises non-standard `apple-touch-startup-image` (une image par taille/orientation d'appareil) — mécanisme ancien mais toujours actif à ce jour.
- **`pwa-asset-generator`** (package npm dédié à la génération de ce jeu d'images iOS + icônes/favicons depuis une image source + une couleur de fond) — vérifier la version courante (`npm view pwa-asset-generator dist-tags`) avant de l'ajouter, suivant la discipline de vérification déjà appliquée aux autres dépendances du projet (cf. Stories 1.1/1.2). Fonctionne directement depuis un PNG source (`Logo-Seul.png`/`logo-complet.png`), pas besoin d'un SVG propre. Alternative acceptable : tout outil équivalent, ou génération manuelle assistée si le tooling s'avère trop lourd — l'important est le résultat (jeu d'images iOS présent, balises injectées), pas l'outil précis.
- **`Strat'Edge/Branding/Logos/logo-seul.svg` n'est pas un vecteur exploitable** (12 images raster base64 embarquées sous filtres/masques, export non nettoyé) — confirmé en inspectant le fichier (`grep -c "<image"` → 12 occurrences). SVGO ne résout pas ce type de problème (il nettoie le markup, pas un payload raster embarqué). D'où le choix de partir du PNG plat `Logo-Seul.png` (291×294) plutôt que de perdre du temps à forcer l'optimisation du SVG.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run build`/`npm run lint` : propres après chaque tâche (vérifiés incrémentalement, pas seulement en fin de story).
- **Bug découvert en vérification manuelle (Task 8), hors périmètre initial des fichiers listés par la story** : l'optimiseur d'image Next.js (`/_next/image?url=%2Fbrand%2Flogo-symbol.png...`) renvoyait `400 Bad Request` ("The requested resource isn't a valid image"). Log serveur : `The requested resource isn't a valid image for /brand/logo-symbol.png received null`. Cause racine : `proxy.ts` redirige toute route non authentifiée vers `/login`, et son `matcher` n'excluait que les chemins connus au moment de la Story 1.2 (`_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `icon-placeholder.svg`) — pas les nouveaux répertoires d'assets de cette story (`brand/`, `icons/`, `splash/`, `apple-icon.png`). L'optimiseur d'image sert un fichier via une requête interne qui repasse par `proxy.ts` ; sans exclusion, elle était redirigée vers `/login` (307) au lieu de recevoir l'image, d'où l'échec silencieux. Corrigé dans `proxy.ts` (ajout des 4 exclusions, retrait de `icon-placeholder.svg` — fichier supprimé par cette story). Revérifié par `curl` direct sur les 6 assets (favicon, apple-icon, 3 icônes manifest, logo header) : tous HTTP 200 sans cookie de session, et l'optimiseur d'image confirmé 200 en navigateur après correction.
- Vérification navigateur (dev server local, `preview_start`) : thème clair/sombre confirmé réactif via `getComputedStyle` (`--color-bg`/`--color-text`/`--color-surface`/`--color-border` changent, `--color-header-bg`/`--color-header-text` fixes dans les deux thèmes) ; focus clavier sur `/login` confirmé (premier `Tab` → champ Email, indicateur de focus = `--color-primary`, `min-height: 48px` préservé) ; `banner` (Header, image "Strat'Edge") présent à la fois sur `/login` et `/` ; manifest et 6 assets PWA vérifiés HTTP 200 sans authentification.
- Splash iOS non testé sur appareil physique (aucun matériel dans cette session) — vérifié par inspection visuelle directe d'un fichier généré (`public/splash/apple-splash-1170-2532.png`) : logo complet + wordmark + tagline centrés correctement sur fond `#F4F7FB`.
- Émulation "Reduce Motion" non disponible dans les outils de vérification de cette session (pas d'option d'émulation `prefers-reduced-motion` exposée) — règle CSS vérifiée par lecture de code uniquement, correcte par construction (standard, ne s'active que si le média query matche).

### Completion Notes List

- ✅ Toutes les tâches (1 à 8) complètes, tous les AC vérifiés (build/lint propres, comportement vérifié en navigateur pour AC#1/#2/#4, assets PWA vérifiés pour AC#3 sauf test physique iOS).
- **Déviation assumée (documentée dans la story dès sa création, confirmée à l'implémentation)** : `logo-seul.svg` (2 Mo, 12 rasters base64 embarqués) abandonné au profit de `Logo-Seul.png` comme source unique pour toutes les icônes (favicon, apple-icon, manifest, header). `app/icon.svg` non créé en conséquence — seuls `app/favicon.ico` (ICO généré via `png-to-ico`) et `app/apple-icon.png` couvrent le favicon/l'icône iOS. Si un export vectoriel propre du symbole devient disponible, il pourra remplacer le PNG partout sans changement d'architecture (un seul point de génération : `scripts/generate-icons.mjs`).
- **Système de tokens à deux couches (détail d'implémentation non explicité dans le texte de la story, décision prise en cours de Task 2)** : `app/globals.css` expose (a) la palette brute DESIGN.md non réactive (`--color-bg-alt`, `--color-bg-dark`, `--color-surface-dark`, `--color-surface-2-dark`, `--color-border-dark`, `--color-text-dark`, `--color-muted-dark`) car le mapping clair→sombre est spécifique à chaque composant DESIGN.md (ex. `segmented-control.track-bg-dark` = `surface-dark`, mais `priority-chip.basse-bg-dark` = `surface-2-dark` — pas un mapping universel) ; et (b) une poignée d'alias réactifs (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-heading`, `--color-muted`) redéfinis sous `prefers-color-scheme: dark`, pour le chrome de page déjà nécessaire à cette story. Les composants futurs (task-card, priority-chip, etc.) composeront leurs propres mappings depuis la palette brute plutôt que de réutiliser les alias tels quels.
- **Gap identifié dans DESIGN.md, comblé par une décision documentée** : aucune valeur `heading-dark` n'est définie dans la charte (seul `text-dark` existe pour le texte). `--color-heading` réutilise `--color-text-dark` en thème sombre (le ton marine `#0F2A44` de `colors.heading` serait illisible sur le fond `#0A1B2E`, quasi identique). Aucun élément de cette story ne rend actuellement avec le rôle `heading` — décision préventive pour la première story qui en aura besoin.
- **Token ajouté hors liste explicite de la story** : `--color-on-primary: #ffffff` (`DESIGN.md.components.button-primary.text`), nécessaire pour que le bouton de connexion respecte l'AC#1 ("aucune couleur codée en dur") sans laisser `#ffffff` en dur dans `login-form.module.css`.
- **`proxy.ts` modifié bien que non listé dans le File List initial de la story** — bug réel découvert en vérification (cf. Debug Log), corrigé dans le périmètre de cette story plutôt que reporté (l'AC#3/#1 ne sont pas atteints tant que les assets PWA ne se chargent pas pour un visiteur non authentifié).
- Aucune régression détectée sur les Stories 1.1/1.2 (build, lint, comportement de connexion/redirection tous revérifiés après le fix `proxy.ts`).

### File List

**Créés :**
- `components/header.tsx`, `components/header.module.css`
- `components/ios-splash-startup-images.ts` (remplace `components/ios-splash-links.tsx`, retiré — cf. Review Findings)
- `scripts/generate-icons.mjs`
- `public/brand/logo-horizontal.png` (remplace `logo-symbol.png`, retiré — cf. Change Log, ajustement post-implémentation)
- `app/apple-icon.png`
- `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`
- `public/splash/apple-splash-*.png` (46 fichiers, un par taille/orientation d'appareil iOS)

**Modifiés :**
- `app/layout.tsx` (retrait Geist fonts, montage `<Header/>`, splash iOS via `metadata.appleWebApp.startupImage`)
- `app/globals.css` (système de tokens complet, règle Reduce Motion)
- `app/manifest.ts` (icônes 192/512/512-maskable)
- `app/page.tsx`, `app/page.module.css` (placeholder neutre, retrait branding Next.js/Vercel)
- `app/login/login-form.module.css` (consomme les tokens globaux)
- `app/favicon.ico` (remplacé par le symbole Strat'Edge)
- `proxy.ts` (fix découvert en vérification — exclusions `brand/`, `icons/`, `splash/`, `apple-icon.png` ; retrait de `icon-placeholder.svg`, supprimé)
- `package.json`, `package-lock.json` (+ `sharp@0.35.3`, `png-to-ico@3.0.2`, devDependencies)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut de la story)

**Supprimés :**
- `public/icon-placeholder.svg` (superseded)

## Change Log

- 2026-08-07 : Implémentation initiale (Tasks 1 à 8 complètes). Système de tokens design complet établi, écran de connexion et placeholder `/` refactorisés, Header partagé avec logo Strat'Edge, jeu complet d'icônes/favicon/splash iOS généré depuis les assets de charte. Bug de routage découvert et corrigé en vérification (`proxy.ts` bloquait les nouveaux assets PWA pour les visiteurs non authentifiés). Build, lint et comportement vérifiés en navigateur (clair/sombre, focus clavier, chargement des assets). Statut passé à `review`.
- 2026-08-07 : Ajustement post-implémentation, avant code review — Guillaume a réorganisé `Strat'Edge/Branding/Logos/` (les anciens `Logo-Seul.png`/`logo-complet.png`/`logo-seul.svg` sont remplacés par `Strat'Edge.png` (symbole seul) et `Strat'Edge_h_b_slogan.png` (lockup horizontal cheval + wordmark + slogan, texte blanc pensé pour fond sombre)) et a demandé de remplacer le logo du header, jugé trop petit. Changements :
  - `scripts/generate-icons.mjs` : source symbole mise à jour vers `Strat'Edge.png` (favicon/apple-icon/icônes manifest, régénérés à l'identique) ; nouvelle sortie `public/brand/logo-horizontal.png` depuis `Strat'Edge_h_b_slogan.png`, dédiée au Header (`public/brand/logo-symbol.png` retiré, plus aucun consommateur).
  - `components/header.tsx`/`header.module.css` : logo remplacé par le lockup horizontal (cheval + "Strat'Edge" + "Former pour performer"), hauteur du logo 32px → 48px, hauteur du header 56px → 72px — nettement plus lisible que le symbole seul précédent. **Déviation assumée par rapport à DESIGN.md** (`components.logo.header-mark` prévoyait le symbole seul en header) — décision produit explicite de Guillaume, pas une erreur d'implémentation.
  - Splash iOS régénéré depuis `Strat'Edge_h_b_slogan.png` (l'ancien `logo-complet.png` portrait n'existe plus) — première tentative sur fond `colors.bg` (#F4F7FB) illisible (texte du logo blanc, pensé pour fond sombre) ; corrigé en régénérant sur fond `colors.header-bg` (#0F2A44), cohérent avec le header et pleinement lisible (vérifié visuellement).
  - Feedback de Guillaume après vérification : logo du header encore "pas très visible" à son goût — remise à plus tard par choix explicite ("on verra plus tard"), aucune action supplémentaire prise dans cette session. À reprendre dans un futur ajustement si Guillaume le demande.
  - Build et lint revérifiés propres ; tous les assets PWA reconfirmés HTTP 200 sans session après régénération.
- 2026-08-07 : Revue de code (Blind Hunter + Edge Case Hunter + Acceptance Auditor, diff scopé aux fichiers de cette story). 4 patches appliqués : (1) `proxy.ts` — bug réel trouvé par l'Edge Case Hunter, `requireEnv()` s'exécutait hors du `try/catch` censé le couvrir, plantant le proxy sur presque toute route si une variable d'env Supabase manque ; construction du client Supabase déplacée à l'intérieur du `try` ; (2) `components/ios-splash-links.tsx` + `<head>` manuel remplacés par `components/ios-splash-startup-images.ts` consommé via `metadata.appleWebApp.startupImage` (API Metadata native de Next.js, sortie HTML identique vérifiée) ; (3) documentation de la story (AC#3, Task 5, Task 6, Dev Notes) annotée pour refléter le changement de logo post-implémentation ; (4) commentaire de synchronisation ajouté sur `HEADER_BG` dans `scripts/generate-icons.mjs`. 1 point différé par décision de Guillaume : `--color-danger`/`--color-muted` échouent au contraste WCAG AA sur fond clair (valeurs DESIGN.md héritées telles quelles, pas une erreur de cette story) — pas prioritaire pour l'instant. 2 points différés pré-existants de la Story 1.2 (pattern de matcher `proxy.ts` fragile, logique d'authentification dupliquée `proxy.ts`/`login/page.tsx`) — ajoutés à `deferred-work.md`. 5 findings rejetés comme bruit (dont un faux positif sur `--color-priority-basse`, vérifié et infirmé par lecture de `DESIGN.md`). Build et lint revérifiés propres après patches ; 46 balises `apple-touch-startup-image` reconfirmées identiques en sortie navigateur.
