---
name: Application de gestion de projets personnelle — Strat'Edge
description: Interface interne "Crisp Systematic" — cartes nettes, profondeur réelle, registre logiciel professionnel, sur la palette de marque Strat'Edge, thèmes clair et sombre.
status: final
created: 2026-08-03
updated: 2026-08-04
colors:
  primary: '#2F80ED'
  secondary: '#56A3FF'
  bg: '#F4F7FB'
  bg-alt: '#E9EEF5'
  border: '#D5DCE5'
  header-bg: '#0F2A44'
  header-text: '#FFFFFF'
  text: '#2B2F33'
  heading: '#0F2A44'
  muted: '#7A8594'
  link-hover: '#1C5DC9'
  bg-dark: '#0A1B2E'
  surface-dark: '#13293F'
  surface-2-dark: '#1B3350'
  border-dark: '#2B4560'
  text-dark: '#E7ECF3'
  muted-dark: '#93A4B8'
  priority-haute: '#2F80ED'
  priority-normale: '#56A3FF'
  priority-basse: '#7A8594'
  priority-haute-text: '#FFFFFF'
  priority-normale-text: '#0F2A44'
  priority-basse-text: '#7A8594'
  danger: '#D64545'
  danger-text: '#FFFFFF'
  project-1: '#2F9E44'
  project-2: '#E8590C'
  project-3: '#9C36B5'
  project-4: '#E64980'
  project-5: '#F08C00'
  project-6: '#0CA678'
  project-7: '#C2255C'
  project-8: '#495057'
typography:
  fontFamily:
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  display:
    fontSize: '19px'
    fontWeight: 800
    lineHeight: 1.25
  heading:
    fontSize: '16.5px'
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontSize: '13.5px'
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontSize: '12.5px'
    fontWeight: 700
    letterSpacing: '0.3px'
  caption:
    fontSize: '10.5px'
    fontWeight: 600
  micro:
    fontSize: '9.5px'
    fontWeight: 800
    letterSpacing: '0.4px'
rounded:
  sm: '6px'
  md: '9px'
  lg: '12px'
  xl: '16px'
  full: '9999px'
  DEFAULT: '10px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '7': '32px'
  '8': '40px'
  gutter: '20px'
  card-gap: '10px'
components:
  logo:
    header-mark: "Strat'Edge/Branding/Logos/logo-seul.svg"
    favicon: "Strat'Edge/Branding/Logos/logo-seul.svg"
    splash-screen: "Strat'Edge/Branding/Logos/logo-complet.png"
    note: "Seule la version symbole-seul existe en vectoriel (SVG) — à utiliser partout où la taille varie (header, favicon multi-résolutions). La version complète (symbole + nom) n'existe qu'en PNG raster — utilisable telle quelle au splash screen PWA (taille fixe), mais une version vectorielle devrait être demandée si elle doit un jour être redimensionnée dynamiquement."
  segmented-control:
    track-bg: '{colors.bg-alt}'
    track-bg-dark: '{colors.surface-dark}'
    track-radius: '{rounded.xl}'
    track-padding: '{spacing.1}'
    item-radius: '{rounded.lg}'
    item-active-bg: '{colors.primary}'
    item-active-text: '#FFFFFF'
    item-inactive-text: '{colors.muted}'
    item-inactive-text-dark: '{colors.muted-dark}'
    note: 'Bloc unique (track) avec fond neutre ; seul le segment actif porte un fond plein — pas de bordure individuelle par segment.'
  task-card:
    bg: '{colors.bg}'
    bg-dark: '{colors.surface-dark}'
    border: '{colors.border}'
    border-dark: '{colors.border-dark}'
    radius: '{rounded.lg}'
    padding: '{spacing.3} {spacing.4}'
    shadow: '0 4px 14px rgba(0,0,0,.08)'
    shadow-dark: '0 4px 14px rgba(0,0,0,.35)'
  priority-chip:
    radius: '{rounded.sm}'
    size: '20px'
    haute-bg: '{colors.priority-haute}'
    haute-text: '{colors.priority-haute-text}'
    normale-bg: '{colors.priority-normale}'
    normale-text: '{colors.priority-normale-text}'
    basse-bg: '{colors.bg-alt}'
    basse-bg-dark: '{colors.surface-2-dark}'
    basse-text: '{colors.priority-basse-text}'
  badge-new:
    shape: 'dot'
    size: '11px'
    bg: '{colors.primary}'
    ring: '2px solid {colors.bg}'
    ring-dark: '2px solid {colors.bg-dark}'
  meta-pill:
    radius: '{rounded.sm}'
    bg: '{colors.bg-alt}'
    bg-dark: '{colors.surface-2-dark}'
    overdue-bg: '{colors.primary}'
    overdue-text: '#FFFFFF'
  status-row:
    track-bg: '{colors.bg-alt}'
    track-bg-dark: '{colors.surface-2-dark}'
    track-radius: '{rounded.md}'
    active-bg: '{colors.primary}'
    active-done-bg: '{colors.secondary}'
  fab:
    size: '56px'
    radius: '{rounded.xl}'
    bg: '{colors.primary}'
    shadow: '0 10px 24px rgba(47,128,237,.45)'
  button-primary:
    bg: '{colors.primary}'
    text: '#FFFFFF'
    radius: '{rounded.md}'
  button-ghost:
    border: '{colors.border}'
    border-dark: '{colors.border-dark}'
    text: '{colors.muted}'
    text-dark: '{colors.muted-dark}'
    radius: '{rounded.md}'
  button-destructive:
    bg: '{colors.danger}'
    text: '{colors.danger-text}'
    radius: '{rounded.md}'
  text-input:
    bg: '{colors.bg}'
    bg-dark: '{colors.surface-dark}'
    border: '{colors.border}'
    border-dark: '{colors.border-dark}'
    border-focus: '{colors.primary}'
    radius: '{rounded.DEFAULT}'
    label: '{typography.caption}'
  checkbox:
    size: '13px'
    radius: '4px'
    border: '{colors.muted}'
    border-dark: '{colors.muted-dark}'
    checked-bg: '{colors.primary}'
    checkmark: '#FFFFFF'
  modal:
    backdrop: 'rgba(15,42,68,.35)'
    bg: '{colors.bg}'
    bg-dark: '{colors.surface-dark}'
    radius-desktop: '{rounded.lg}'
    shadow: '0 20px 50px rgba(0,0,0,.25)'
    shadow-dark: '0 20px 50px rgba(0,0,0,.55)'
    note: 'Mobile : plein écran, pas de backdrop ni de radius. Desktop : carte centrée avec backdrop et radius. Cf. EXPERIENCE.md Responsive & Platform.'
  stepper:
    step-done-bg: '{colors.secondary}'
    step-done-text: '{colors.priority-normale-text}'
    step-current-bg: '{colors.primary}'
    step-current-text: '#FFFFFF'
    step-upcoming-bg: '{colors.bg-alt}'
    step-upcoming-bg-dark: '{colors.surface-2-dark}'
    step-upcoming-text: '{colors.muted}'
  project-color:
    rotation: ['{colors.project-1}', '{colors.project-2}', '{colors.project-3}', '{colors.project-4}', '{colors.project-5}', '{colors.project-6}', '{colors.project-7}', '{colors.project-8}']
    note: "Rotation automatique à la création (FR-6), modifiable manuellement. 8 teintes délibérément hors du bleu de marque (primary/secondary) pour ne jamais se confondre avec une couleur système ou de priorité. Identiques en clair et en sombre (utilisées en petites touches — points, puces — pas en grandes surfaces de texte). Validée en contexte via `mockups/key-general-calendar.html`."
---

## Brand & Style

Registre "logiciel professionnel" net et quadrillé — cartes, puces, libellés en petites capitales, profondeur réelle (ombres visibles, pas plates). Pensé pour quelqu'un qui trie une dizaine de projets et veut une structure scannable, pas de la prose. C'est délibérément *soigné* plutôt que minimal à l'extrême : l'app fait aussi office de vitrine face aux clients Strat'Edge, donc chaque écran doit lire comme "on sait construire des outils sérieux" au premier coup d'œil — sans jamais surcharger l'écran (densité maîtrisée, pas dense).

Retenue parmi 3 directions explorées (`.working/direction-minimal-editorial.html`, `.working/direction-warm-rounded.html` — écartées ; `mockups/direction-crisp-systematic.html` — retenue) : préférée à **Minimal Editorial** (trop sobre pour porter l'argument "vitrine" — manque de structure visible à l'œil) et à **Warm Rounded** (chaleureuse mais moins "logiciel pro" ; son seul apport retenu est le traitement du switcher segmenté, fusionné ici). Écrans clés supplémentaires : `mockups/key-general-calendar.html`, `mockups/key-project-view.html`, `mockups/key-delete-confirmation.html`.

**Usage du logo** — `{components.logo.header-mark}` (symbole seul, SVG) dans le header sur tous les écrans authentifiés et comme favicon ; `{components.logo.splash-screen}` (logo complet, PNG) sur l'écran de démarrage de la PWA à l'installation. L'app n'est jamais montrée sans logo Strat'Edge visible — c'est un des points de contact directs avec l'argument commercial "vitrine".

## Colors

- **{colors.primary}** (`#2F80ED`) — couleur de marque principale. Boutons primaires, FAB, segment actif du sélecteur, priorité Haute, liens.
- **{colors.secondary}** (`#56A3FF`) — accents secondaires. Priorité Normale, puces de statut "terminé", accents de projet.
- **{colors.bg}** / **{colors.bg-alt}** — fond de contenu et fond alterné (cartes, pistes de contrôle) en thème clair.
- **{colors.border}** — séparateurs et bordures discrètes en thème clair.
- **{colors.header-bg}** (`#0F2A44`) — fond du header, identique en clair et en sombre (couleur de marque, ne varie pas avec le thème).
- **{colors.text}** / **{colors.heading}** / **{colors.muted}** — texte courant, titres, texte secondaire en thème clair.
- **Thème sombre** — `bg-dark` / `surface-dark` / `surface-2-dark` / `border-dark` / `text-dark` / `muted-dark` sont des dérivations tonales de la marine de marque (`#0F2A44`) et du gris `#7A8594` — jamais une inversion automatique du thème clair, qui produirait un gris violacé sans lien avec la marque. `{colors.primary}` et `{colors.secondary}` restent inchangés en sombre : ils tiennent déjà bien sur un fond marine.
- **Priorité** — `priority-haute` = primary, `priority-normale` = secondary, `priority-basse` = muted/neutre. Chaque niveau a aussi une couleur de texte dédiée (`priority-*-text`) pour garantir le contraste de la lettre (H/N/B) sur son fond.
- **{colors.danger}** (`#D64545`) — unique couleur destructive de l'app. Réservée à la confirmation de suppression (documents, FR-21) et à ses boutons associés. Jamais utilisée ailleurs, pour que sa rareté signale le caractère irréversible de l'action.
- **{colors.link-hover}** (`#1C5DC9`) — réservée pour un futur lien textuel in-app (renvoi contextuel) ; aucun composant actuel de la V1 n'en a besoin, conservée car héritée telle quelle de la charte de marque.
- **Palette de projet** (`project-1` à `project-8`, cf. `components.project-color`) — 8 teintes dédiées à la rotation automatique des couleurs de projet (FR-6), volontairement hors du bleu de marque pour ne jamais se confondre avec `primary`/`secondary`/priorité.
- **Jamais** utiliser les couleurs de label de projet comme couleurs d'interface système (boutons, fonds) — elles servent exclusivement à l'identification visuelle d'un projet.

## Typography

Police système uniquement (`{typography.fontFamily.default}`) — aucune police custom chargée. Choisie pour la performance (zéro requête réseau pour une police) et la cohérence avec l'exigence offline-first : l'app doit rester pleinement lisible dès le premier lancement, même hors ligne.

- **display** — titres d'écran (ex. "Quelle est la priorité ?" en flux de capture)
- **heading** — nom de projet dans le header
- **body** — titres de tâche/note/document, texte d'interaction principal
- **label** — libellés de contrôle (segments, filtres, statuts) — petites capitales
- **caption** — métadonnées (dates, provenance)
- **micro** — puces de priorité, numéros d'étape

## Layout & Spacing

Échelle en base 4px (`{spacing.1}` = 4px → `{spacing.8}` = 40px). `{spacing.gutter}` (20px) cadre les écrans mobiles ; `{spacing.card-gap}` (10px) espace les cartes de liste. Densité maîtrisée : privilégier l'air entre les cartes plutôt que la compression, même avec de nombreux éléments à afficher — la liste défile, elle ne se tasse pas.

## Elevation & Depth

Profondeur réelle et assumée, pas plate. Cartes de tâche : ombre douce (`0 4px 14px rgba(0,0,0,.08)` en clair, `.35` d'opacité en sombre). FAB : ombre plus marquée pour le détacher du contenu (`0 10px 24px rgba(47,128,237,.45)`), teintée de la couleur primaire plutôt que neutre. Le header n'a pas d'ombre propre — il s'impose par sa couleur pleine, pas par la profondeur.

## Shapes

Rayons modérés, jamais anguleux ni extrêmes : `{rounded.sm}` (6px) pour les petits éléments (puces, chips), `{rounded.md}` (9px) pour les boutons et la piste du contrôle de statut, `{rounded.DEFAULT}` (10px) pour les champs de saisie, `{rounded.lg}` (12px) pour les cartes et les modales desktop, `{rounded.xl}` (16px) pour le FAB et la piste du switcher segmenté, `{rounded.full}` pour les éléments circulaires (badge "nouveau", radio, numéros d'étape).

## Components

- **Switcher segmenté** (niveau 1 : Général / Projets ; niveau 2 : Tâches / Documents / Notes) — un bloc unique (`{components.segmented-control.track-bg}`, rayon `{rounded.xl}`) contenant les segments ; seul le segment actif porte un fond plein (`{colors.primary}`) et une ombre légère. Aucun segment inactif n'a de bordure ou de fond propre — ce qui évite l'effet "boutons flottants qui se déplacent" au profit d'un état de sélection net à l'intérieur d'un seul contrôle. Texte inactif `{colors.muted}` / `{colors.muted-dark}` selon le thème.
- **Carte de tâche/note/document** — fond, bordure fine, rayon `{rounded.lg}`, ombre douce. Le badge "nouveau" (point plein, `{rounded.full}`, cerclé de la couleur de fond) est positionné en léger débord du coin supérieur droit de la carte.
- **Puce de priorité** — carré arrondi (`{rounded.sm}`) coloré selon le niveau (Haute/Normale/Basse), lettre unique (H/N/B) dont la couleur (`{components.priority-chip.haute-text}` etc.) garantit le contraste sur chaque fond.
- **Puce de métadonnée** (date, provenance) — fond neutre, icône + texte ; variante "en retard" en fond plein couleur primaire.
- **Contrôle de statut** (à faire / en cours / terminé) — piste à 3 segments dans un bloc neutre, segment actif en fond plein (primaire pour à faire/en cours, secondaire pour terminé).
- **FAB (+)** — carré arrondi `{rounded.xl}`, fond primaire, toujours ancré en bas à droite, persistant sur tous les écrans avec contenu.
- **Bouton primaire / fantôme / destructif** — primaire en fond plein pour l'action principale ; fantôme (bordure seule) pour Retour/Annuler ; destructif (`{colors.danger}`) réservé à la confirmation de suppression, jamais ailleurs.
- **Champ de saisie** — fond `{colors.bg}`/`{colors.surface-dark}`, bordure `{colors.border}`/`{colors.border-dark}` au repos, bordure `{colors.primary}` au focus, rayon `{rounded.DEFAULT}`, libellé en style `{typography.caption}` au-dessus du champ.
- **Case à cocher** — 13px, rayon 4px, bordure `{colors.muted}`/`{colors.muted-dark}` au repos, fond `{colors.primary}` avec coche blanche à l'état coché. Utilisée pour les filtres de tri (Chronologique/Prioritaire), combinable librement.
- **Modale/overlay** — mobile : plein écran, sans backdrop ni rayon (la modale EST l'écran). Desktop : carte centrée (`{rounded.lg}`), backdrop `{components.modal.backdrop}`, ombre marquée. Utilisée par le flux de capture, la confirmation de désarchivage, et la confirmation de suppression de document.
- **Stepper de capture** — 3 pastilles rondes (`{rounded.full}`) : étape faite en `{colors.secondary}`, étape actuelle en `{colors.primary}`, étape à venir en fond neutre (`{colors.bg-alt}`/`{colors.surface-2-dark}`) avec texte `{colors.muted}`.

## Do's and Don'ts

- **Do** garder le sélecteur segmenté en un seul bloc visuel — jamais trois boutons séparés.
- **Do** réserver `{colors.primary}` aux actions et à la priorité Haute — ne pas le diluer en couleur décorative.
- **Do** garder le header en `{colors.header-bg}` fixe, identique en clair et en sombre.
- **Do** traiter la conformité à la charte graphique (couleurs, logo) comme une porte de sortie de release, pas une passe de polish de fin de projet — cohérent avec le PRD (§5 Cross-Cutting NFRs).
- **Don't** utiliser les couleurs de label de projet pour des éléments d'interface système (boutons, fonds de carte).
- **Don't** surcharger la liste de tâches — préférer le défilement à la compression verticale.
- **Don't** inverser automatiquement les couleurs claires pour produire le thème sombre — les tokens sombres sont dérivés à la main de la marine et du gris de marque.
- **Don't** utiliser `{colors.danger}` pour autre chose que la confirmation de suppression — sa rareté est ce qui la rend lisible comme signal "irréversible".
