---
title: Application de gestion de projets personnelle — Expérience
status: final
created: 2026-08-03
updated: 2026-08-04
sources:
  - _bmad-output/planning-artifacts/briefs/brief-Project Note-2026-08-03/brief.md
  - _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md
---

# Application de gestion de projets personnelle — Experience Spine

## Foundation

PWA mono-utilisateur, multi-surface avec parité totale entre mobile et desktop (capture, consultation, note vocale — tout fonctionne identiquement sur les deux). Pas de UI system nommé — composants construits sur mesure, décrits dans `DESIGN.md`. Bascule thème clair/sombre disponible ; les deux thèmes sont pleinement supportés (pas de thème par défaut imposé). Hors ligne par défaut : toute écriture fonctionne sans réseau, synchronisation automatique au retour. `DESIGN.md` est la référence d'identité visuelle ; cette spec porte le comportement.

## Information Architecture

| Surface | Atteint depuis | Rôle |
|---|---|---|
| Connexion | Ouverture de l'app, non authentifié | Email + mot de passe |
| Général | Switcher haut (par défaut à l'ouverture) | Calendrier général (mois/semaine), filtre multi-projet, accès rapide à la création d'un projet ou à la sélection d'un projet existant |
| Projets | Switcher haut | Liste des projets — actifs en premier, archivés repliés — accès création |
| Vue projet | Tap sur un projet (depuis Général ou Projets) | 3 onglets Tâches / Documents / Notes, tri combinable, indicateurs (provenance, nouveau, priorité) |
| Détail d'élément | Tap sur une tâche/note/document dans la vue projet | Consultation/édition ; le badge "nouveau" disparaît à l'ouverture |
| Capture "+" | FAB, accessible depuis tout écran avec contenu | Flux en 3 étapes : Projet → Priorité → Type |

Navigation de premier niveau : switcher segmenté fixe sous le header (Général / Projets) — cf. `mockups/wireframe-top-nav-switch.html`. Le FAB "+" est persistant en bas à droite sur tous les écrans avec contenu (absent sur Connexion). La capture s'ouvre en overlay/modal — un seul niveau de pile, jamais deux (retour direct à l'écran d'origine à la fermeture).

→ Référence de composition : `mockups/wireframe-top-nav-switch.html` (switcher), `mockups/direction-crisp-systematic.html` (direction visuelle + étape 2/3 de capture + état vide), `mockups/key-general-calendar.html` (calendrier + légende couleurs de projet), `mockups/key-project-view.html` (vue projet, filtres, priorité), `mockups/key-delete-confirmation.html` (modale de suppression). La spine gagne en cas de conflit avec ces mocks.

## Voice and Tone

Microcopie. Le ton de marque et la posture esthétique vivent dans `DESIGN.md.Brand & Style`.

**Vouvoiement partout** — cohérent avec le registre professionnel et l'usage de l'app comme vitrine face aux clients.

| Do | Don't |
|---|---|
| "Enregistré." | "C'est noté ! 🎉" |
| "Aucune tâche pour l'instant." | "Rien à faire, profitez-en !" |
| "Vos données restent sur cet appareil — synchronisation dès que la connexion revient." | "Erreur réseau" |
| "Micro indisponible — les autres captures restent possibles." | "Erreur : permission refusée" |
| Phrases courtes, complètes, factuelles. | Points d'exclamation, emojis, ton encourageant/ludique, jargon technique exposé. |
| "Enregistré." | "On a bien tout noté pour vous, comme ça vous n'oubliez rien !" — l'app ne compense pas une mémoire défaillante, elle centralise ; le ton ne doit jamais sous-entendre l'inverse. |

## Component Patterns

Comportemental. Les specs visuelles vivent dans `DESIGN.md.Components`.

| Composant | Usage | Règles comportementales |
|---|---|---|
| Switcher segmenté (niveau 1) | Sous le header, partout sauf Connexion | Général / Projets. Un seul actif à la fois. Change le contenu sous le switcher, le switcher reste fixe. |
| Switcher segmenté (niveau 2) | Vue projet | Tâches / Documents / Notes. Même traitement visuel que le niveau 1. |
| Carte de tâche/note/document | Vue projet, listes | Tap → détail. Affiche titre, priorité, provenance, échéance (si applicable), badge "nouveau" (si non consulté). Pour un document : nom de fichier, type, taille, date d'ajout. |
| Ajout de document (étape 3, type Document) | Overlay "+" | Sélecteur de fichier natif sur desktop ; choix caméra ou galerie sur mobile. Le fichier ajouté alimente directement la carte document (nom, type, taille, date). |
| Filtres de tri | Vue projet, chaque onglet | Deux cases "Chronologique" / "Prioritaire", cochables indépendamment et combinables. Chronologique coché par défaut. Aucune case cochée → retombe sur Chronologique. |
| Contrôle de statut | Carte de tâche | 3 segments (à faire / en cours / terminé), tap pour changer, aucun ordre imposé. |
| Badge "nouveau" | Carte de tâche/note/document | Visible tant que l'élément n'a pas été ouvert. Disparaît au premier tap, quel que soit l'appareil de consultation. |
| Puce de priorité | Toute carte + étape 2 du flux "+" | 3 niveaux (Basse/Normale/Haute), toujours visible indépendamment du tri actif. |
| FAB "+" | Persistant, tous écrans avec contenu | Ouvre le flux de capture en overlay. Jamais masqué par le clavier virtuel. |
| Stepper de capture | Overlay "+" | 3 étapes (Projet → Priorité → Type). Étape 1 propose aussi "Sans projet (tâche uniquement)" ; si l'utilisateur choisit ensuite Note ou Document à l'étape 3, il est renvoyé à l'étape 1 avec un message explicite ("Un projet est requis pour une note ou un document" — obligatoire pour ces deux types, cf. FR-2). Navigation Retour/Continuer, état "fait/actuel/à venir" par étape. |
| Formulaire de création de projet | Depuis "Projets" ou "Général" | Nom (obligatoire), description (optionnelle), couleur — assignée automatiquement par rotation de la palette de marque, modifiable manuellement. |
| Champs de tâche (étape 3, type Tâche) | Overlay "+" | Titre (obligatoire), description (optionnelle), échéance (optionnelle), rappel (optionnel, actif seulement si une échéance est saisie). |
| Contrôle de transcription | Détail d'une note vocale | Bouton explicite "Générer la transcription" — jamais déclenché automatiquement ; disponible à la création (étape 3) ou après coup depuis le détail. |
| Actions document | Carte document, détail | Deux actions visibles (pas de swipe) : Télécharger, Supprimer (confirmation avant suppression, irréversible). |
| Action Désarchiver | Ligne de projet, section "Archivés" | Tap ouvre une confirmation légère ("Réactiver ce projet ?") — pas de swipe, cohérent avec l'absence de gestes cachés. |
| Puce de priorité (calendrier) | Calendrier général | Même code visuel que la puce de priorité des cartes ; n'affecte jamais la position de la tâche dans la grille (la date prime, cf. FR-32). |
| Notification push | Système (hors app) | Contenu : titre de la tâche + nom du projet. Sur iOS, ne fonctionne que si l'app a été installée via "Ajouter à l'écran d'accueil" — cf. State Patterns. |
| Champ de saisie | Formulaires (création projet, tâche, connexion) | Libellé visible au-dessus, bordure focus au clavier/tap, aucune validation intrusive pendant la frappe. |
| Case à cocher | Filtres de tri | Tap pour cocher/décocher, état visuel immédiat, pas de délai. |
| Modale/overlay | Capture "+", confirmation Désarchiver, confirmation suppression document | Plein écran sur mobile, carte centrée avec fond assombri sur desktop — cf. Responsive & Platform. Fermeture : bouton Retour/Annuler explicite, jamais de tap-en-dehors silencieux (évite les pertes accidentelles). |
| Bouton destructif | Confirmation de suppression de document | Toujours dans une modale de confirmation à deux actions (Annuler / Supprimer), jamais en action directe sans confirmation. |

## State Patterns

| État | Surface | Traitement |
|---|---|---|
| Non authentifié | Connexion | Formulaire email/mot de passe uniquement, aucun lien magique. |
| Échec de connexion | Connexion | "Email ou mot de passe incorrect." — champ mot de passe vidé, aucun indice sur lequel des deux est erroné. |
| Chargement initial | Toute surface avec données | Contenu en cache affiché immédiatement s'il existe (cohérent avec l'offline-first) ; sinon état de chargement neutre et bref, sans placeholder animé superflu. |
| Aucun projet | Projets | "Aucun projet pour l'instant." + invite à créer via "+". |
| Calendrier sans échéance | Général | Grille affichée normalement, aucun message d'erreur — un calendrier vide n'est pas un problème à signaler. |
| Onglet vide (tâche/note/document) | Vue projet | Message dédié par type (ex. "Aucune note pour l'instant. Touchez + pour en créer une.") + renvoi implicite vers le FAB. |
| Écriture hors ligne | N'importe quel écran de capture | Sauvegarde locale silencieuse, aucun blocage, aucune bannière d'erreur. |
| Synchronisation | Indicateur discret, persistant | 3 états courants : à jour / en attente / en cours. Jamais bloquant, jamais modal. |
| Échec de synchronisation persistant | Indicateur de synchronisation | Après plusieurs tentatives automatiques infructueuses, l'indicateur passe à un 4e état distinct et actionnable ("Non synchronisé — toucher pour réessayer"). La donnée reste visible et intacte localement, jamais supprimée silencieusement — protège directement SM-1 (zéro idée perdue). |
| Conflit de synchronisation | Carte de tâche/note/document concernée | Un même champ modifié différemment sur deux appareils avant synchronisation (cf. Architecture, résolution par champ) déclenche un badge "Conflit de synchronisation — à vérifier" sur la fiche concernée, même mécanique visuelle que le badge "nouveau". L'ouverture de la fiche présente les deux valeurs et demande à l'utilisateur de choisir laquelle garder ; le badge disparaît une fois tranché. Jamais d'écrasement automatique et silencieux. |
| Échec d'enregistrement d'une modification | Détail d'élément | La modification reste visible localement, jamais perdue ; se traite comme une entrée en attente dans la file de synchronisation (même état que ci-dessus). |
| Accès micro refusé | Capture note vocale | État dégradé visible ("Micro indisponible") ; les autres types de capture restent pleinement utilisables. |
| Accès caméra/galerie refusé | Capture document (mobile) | Même traitement que le micro refusé : état dégradé explicite, les autres types de capture restent pleinement utilisables. |
| Note vocale sans transcription | Détail note | État "audio seul" visuellement distinct de "transcrit" — pas une erreur, un choix assumé de l'utilisateur. |
| Tâche en retard | Carte de tâche | Puce de métadonnée dédiée ("· en retard"), couleur primaire pleine pour se distinguer des puces neutres. |
| Projet archivé | Projets, Général | Retiré du sélecteur de capture et du calendrier par défaut ; réapparaît via filtre explicite "afficher les projets archivés". |
| Permission notification refusée | Système, première demande | Rappels toujours visibles et fonctionnels dans l'app ; état explicite signalant l'absence de notification push (pas de blocage de la fonctionnalité de rappel elle-même). |
| PWA iOS non installée sur l'écran d'accueil | Premier rappel programmé sur iOS | Message explicite invitant à installer l'app ("Ajouter à l'écran d'accueil") pour recevoir les notifications — contrainte de plateforme, pas une erreur de l'app. |

## Interaction Primitives

- Tap pour agir — pas de geste caché (pas de swipe, pas de long-press) tant qu'un besoin réel ne l'impose pas : cohérent avec la préférence "épuré mais cohérent".
- Cases à cocher pour les filtres de tri, combinables librement.
- Contrôle de statut : tap sur un segment pour basculer directement dessus (pas de cycle forcé).
- FAB toujours atteignable, jamais recouvert par un clavier virtuel ou un overlay.
- Pas de pull-to-refresh — la synchronisation est automatique, une action de rafraîchissement manuel serait redondante.
- **Banni :** carrousels, animations d'accueil/splash superflues, badges de gamification (streaks, compteurs de performance) — cohérent avec l'absence de tracking business dans l'app (cf. PRD, Non-Goals).

## Accessibility Floor

Comportemental. Le contraste visuel vit dans `DESIGN.md`.

- Cibles tactiles ≥ 44px (iOS) / 48dp (Android) sur tous les éléments interactifs, y compris les cases de filtre et les segments de statut.
- Lecteur d'écran (VoiceOver / TalkBack / lecteur desktop) : chaque élément interactif porte un rôle et un état ; le badge "nouveau" et le changement de statut de synchronisation sont annoncés à l'apparition/disparition.
- Respect des préférences de taille de texte du système/navigateur — aucun contrôle tronqué aux réglages les plus grands.
- Reduce Motion : suppression des transitions d'ombre/élévation si le réglage système est actif.
- Ordre de focus clavier (desktop) aligné sur l'ordre de lecture visuel ; l'indicateur de focus reste visible en permanence.
- État dégradé du micro (accès refusé) annoncé explicitement, jamais un simple silence.

## Responsive & Platform

- **Mobile** : switcher niveau 1 pleine largeur sous le header ; FAB ancré bas-droite ; overlay de capture plein écran.
- **Desktop** : switcher niveau 1 centré, largeur contrainte (pas d'étirement pleine largeur) ; FAB ancré bas-droite de la fenêtre de contenu ; overlay de capture en modal centrée plutôt que plein écran.
- Le calendrier général bascule automatiquement en vue semaine (mobile étroit) / vue mois par défaut (desktop, plus d'espace) — l'utilisateur peut changer manuellement sur les deux.
- Aucune divergence fonctionnelle entre plateformes — la parité (§Foundation) prime sur toute optimisation spécifique à un appareil.

## Inspiration & Anti-patterns

- **Rejeté — assistant IA de synthèse/classement automatique :** envisagé puis explicitement écarté pour V1 (voir addendum du brief). La capture reste un geste manuel et prévisible (Projet → Priorité → Type) plutôt qu'un dialogue avec un système qui interprète.
- **Rejeté — gamification (streaks, scores, badges de performance) :** l'app ne mesure ni n'affiche de performance business ; l'introduire visuellement contredirait ce choix produit.
- **Rejeté — barre de navigation basse à deux entrées :** écarté au profit du switcher en haut, pour ne jamais entrer en collision avec le FAB et pour partager un seul pattern de navigation entre mobile et desktop.

## Key Flows

### Flow 1 — Capture du soir (Guillaume, en rentrant, une idée pour un projet de formation) — réalise UJ-1

1. Guillaume ouvre l'app sur son téléphone, hors connexion.
2. Il tape le FAB "+".
3. Étape 1/3 : il choisit le projet "Formation Vente B2B — Session Automne".
4. Étape 2/3 : il choisit une priorité.
5. Étape 3/3 : il choisit "Note vocale" et enregistre son idée.
6. **Climax :** l'écran affiche "Enregistré." et se referme sur l'écran d'origine — aucune connexion n'a été nécessaire à aucune étape.

Échec : accès micro refusé → message dégradé affiché, les autres types de capture (texte, tâche) restent proposés sans interruption.

### Flow 2 — Reprise au bureau (Guillaume, le lendemain, sur son ordinateur) — réalise UJ-2

1. Guillaume ouvre l'app sur son ordinateur, bascule sur "Projets".
2. Il tape sur le projet concerné.
3. Dans l'onglet Notes, il repère la carte marquée du badge "nouveau" et de l'icône téléphone (provenance).
4. Il tape dessus pour consulter la note vocale de la veille.
5. **Climax :** le badge "nouveau" disparaît — la reprise du fil est visible et sans ambiguïté sur ce qui reste à traiter.

Échec : si Guillaume ouvre l'ordinateur avant que la synchronisation du téléphone ne soit terminée, la note n'apparaît pas encore. L'indicateur de synchronisation affiche "en attente" plutôt que "à jour" — signal explicite qu'il s'agit d'un délai, pas d'une perte (cf. État "Synchronisation").

### Flow 3 — Tâche entre deux rendez-vous (Guillaume, sur son téléphone) — réalise UJ-3

1. Guillaume tape le FAB "+".
2. Étape 1/3 : choisit le projet. Étape 2/3 : choisit la priorité. Étape 3/3 : choisit "Tâche", saisit un titre et une échéance.
3. Il enregistre et referme le flux.
4. Il bascule sur "Général".
5. **Climax :** la tâche apparaît immédiatement dans le calendrier général, à la date choisie, colorée selon le projet — visible sans action supplémentaire.

Échec : si Guillaume n'a pas saisi d'échéance, la tâche n'apparaît jamais dans le calendrier général (cf. FR-11) — elle reste visible uniquement dans l'onglet Tâches du projet, ce qui n'est pas traité comme une erreur mais comme le comportement attendu d'une tâche sans date.
