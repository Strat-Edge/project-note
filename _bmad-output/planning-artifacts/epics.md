---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Project Note-2026-08-03/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Project Note-2026-08-05/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Project Note-2026-08-03/EXPERIENCE.md
---

# Application de gestion de projets personnelle - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Application de gestion de projets personnelle, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: L'utilisateur peut initier une capture à tout moment via un bouton "+" toujours visible, sur téléphone comme sur ordinateur, depuis n'importe quel écran.
FR-2: L'utilisateur doit choisir un projet existant avant de saisir une Note ou un Document ; pour une Tâche, il peut passer cette étape (tâche générale, sans projet).
FR-3: Après le projet, l'utilisateur définit un niveau de priorité (Basse/Normale/Haute) pour l'élément en cours de capture — s'applique aux trois types (note, tâche, document), manuel, modifiable après coup.
FR-4: Après Projet et Priorité, l'utilisateur choisit le type de contenu à créer : note texte, note vocale, tâche, ou document.
FR-5: L'ensemble du flux de capture (Projet + Priorité + saisie du contenu) fonctionne sans connexion réseau active.
FR-6: L'utilisateur peut créer un projet avec un nom (obligatoire), une description (optionnelle), et une couleur (rotation automatique de la palette de marque, modifiable).
FR-7: L'utilisateur consulte la liste de ses projets, actifs en premier, archivés regroupés et repliés par défaut.
FR-8: L'utilisateur peut archiver un projet actif ; rien n'est supprimé ; le projet archivé disparaît du sélecteur de capture et du calendrier général par défaut.
FR-9: L'utilisateur peut désarchiver un projet, ce qui le restaure dans la liste active, le sélecteur de capture, et le calendrier général.
FR-10: L'utilisateur saisit un titre (obligatoire), une description, une échéance, et un rappel (nécessite une échéance) pour une tâche.
FR-11: Toute tâche avec une échéance apparaît automatiquement dans le calendrier général, colorée selon son projet.
FR-12: Un rappel programmé déclenche une notification push à l'heure définie.
FR-13: L'utilisateur peut faire évoluer le statut d'une tâche : à faire → en cours → terminé, manuellement, sans ordre imposé.
FR-14: La priorité assignée à la capture reste modifiable directement sur la tâche, à tout moment.
FR-15: L'utilisateur saisit librement du texte pour une note, rattachée au projet choisi.
FR-16: L'utilisateur enregistre une note vocale via le micro de l'appareil, sur téléphone comme sur ordinateur ; fonctionne hors ligne.
FR-17: Pour toute note vocale, l'utilisateur choisit — à la création ou après coup — de générer une transcription texte ou de garder l'audio seul ; jamais automatique.
FR-18: L'utilisateur ajoute un document au projet via sélecteur de fichier (desktop) ou caméra/galerie (mobile) ; nom/type/taille enregistrés automatiquement.
FR-19: L'utilisateur consulte la liste des documents d'un projet, avec nom, type, et date d'ajout.
FR-20: L'utilisateur télécharge un document du projet vers son appareil.
FR-21: L'utilisateur supprime un document du projet ; suppression définitive.
FR-22: L'utilisateur navigue entre Tâches, Documents, et Notes au sein d'un projet via un sélecteur à trois onglets.
FR-23: Chaque onglet propose deux filtres cochables et combinables — "Chronologique" et "Prioritaire" (Chronologique par défaut) ; les deux ensemble trient par priorité puis chronologie.
FR-24: Chaque élément affiche l'appareil (téléphone/ordinateur) depuis lequel il a été capturé.
FR-25: Chaque élément non consulté porte un badge visuel "nouveau", qui disparaît à l'ouverture, quel que soit l'appareil.
FR-26: Chaque élément affiche visuellement son niveau de priorité, indépendamment du tri actif.
FR-27: L'utilisateur bascule entre une vue calendrier mensuelle et hebdomadaire.
FR-28: L'utilisateur sélectionne un ou plusieurs projets pour filtrer les tâches affichées dans le calendrier.
FR-29: Chaque tâche affichée dans le calendrier porte la couleur de son projet.
FR-30: L'utilisateur peut créer un nouveau projet ou en sélectionner un existant directement depuis le calendrier général.
FR-31: Les tâches des projets archivés n'apparaissent pas dans le calendrier par défaut, sauf filtre explicite activé.
FR-32: Chaque tâche du calendrier porte un indicateur visuel de priorité, sans affecter son positionnement (la date prime).
FR-33: Toute création/modification est stockée localement et mise en file d'attente si aucune connexion réseau n'est disponible.
FR-34: Dès que la connexion réseau est détectée, la file d'attente se synchronise automatiquement avec le serveur.
FR-35: Un indicateur discret et permanent affiche l'état de synchronisation : à jour / en attente / en cours.
FR-36: Une notification push est envoyée à l'heure exacte définie par le rappel d'une tâche.
FR-37: La notification affiche le titre de la tâche et le nom du projet associé.
FR-38: Le token de notification est ré-enregistré automatiquement et silencieusement lorsqu'il expire ou se réinitialise.
FR-39: L'utilisateur s'authentifie par email + mot de passe (Supabase Auth) ; aucun lien magique ; un seul compte utilisateur, aucune gestion de rôles.

### NonFunctional Requirements

NFR-1: Fidélité stricte à la charte graphique Strat'Edge (couleurs, typographie, logo header/splash/favicon) — exigence de premier ordre, traitée comme porte de sortie de release, pas un polish de fin de projet.
NFR-2: Confidentialité des documents — authentification email/mot de passe obligatoire (pas de lien magique), accès strictement mono-utilisateur aux données (RLS sur chaque table Supabase).
NFR-3: Le flux de capture "+" doit s'ouvrir quasi instantanément (cible : < 1 seconde sur mobile standard).
NFR-4: Dégradation gracieuse — un refus d'accès micro ou caméra/galerie n'empêche pas les autres types de capture de fonctionner.
NFR-5: Résilience réseau — un upload de fichier volumineux (document, audio) interrompu par une coupure reprend depuis le dernier point réussi, ne repart jamais de zéro.
NFR-6: Contrainte plateforme iOS — les notifications push ne fonctionnent que si la PWA a été installée via "Ajouter à l'écran d'accueil" ; le token de notification doit être ré-enregistré silencieusement (risque d'expiration plus fréquent que sur Android).
NFR-7: Simplicité du flux de capture — le nombre d'étapes/champs ne doit jamais croître au point de ralentir la capture d'une idée fugace (contre-métrique SM-C1).
NFR-8: Aucune écriture ne dépend du réseau — architecture Local-First : Dexie/IndexedDB est la source de vérité immédiate, aucune perte de donnée capturée hors ligne (protège SM-1).
NFR-9: Résolution de conflit sans perte silencieuse — deux appareils modifiant le même champ d'une même fiche hors ligne déclenchent un état visible de conflit, jamais un écrasement automatique.
NFR-10: Taille maximale de fichier : 20 Mo par document ou note vocale.

### Additional Requirements

- **Aucun starter/template de démarrage spécifié** — projet Next.js App Router initialisé de zéro (pas de boilerplate imposé par l'architecture) ; impacte Epic 1 Story 1 (setup projet).
- Paradigme Local-First : toute écriture utilisateur passe d'abord par Dexie (`data/local/`) ; `sync/` est l'unique pont vers Supabase (`data/remote/`) ; `domain/` ne dépend d'aucune autre couche.
- Direction de dépendance stricte : `data/remote/` ne peut être importé que par du code qui ne s'exécute jamais dans le bundle client (route handlers, Server Actions, Render Cron).
- Résolution de conflit au niveau du champ : chaque champ éditable après création porte une métadonnée `<champ>_updated_at` et `<champ>_synced_at` ; conflit réel = état visible "conflit de synchronisation — à vérifier", arbitrage manuel par l'utilisateur.
- Row Level Security (RLS) activée sur chaque table Supabase, restreinte au propriétaire (`auth.uid()`), même en mono-utilisateur.
- Stockage hors ligne des fichiers (blobs) via Dexie ; `navigator.storage.persist()` demandé au démarrage pour réduire le risque d'éviction (notamment iOS).
- Entité `PushSubscription` par appareil (pas un abonnement partagé) ; ré-enregistrement silencieux à chaque activation du service worker.
- Tout appel externe (transcription OpenAI `gpt-transcribe`, envoi web-push, Supabase au-delà de la session Auth cliente) s'exécute uniquement en code serveur — jamais dans un composant client.
- Hébergement : Render (Web Service) pour l'application Next.js ; Render Cron Job pour déclencher les rappels de tâches à `reminder_at`.
- Stack adoptée : Next.js App Router (16.3.0), TypeScript (7.0.2), Dexie.js (4.4.4), Serwist (`@serwist/next` 9.5.11) pour le PWA/service worker, `@supabase/supabase-js` (2.112.0), web-push (3.6.7, VAPID).
- Backend Supabase : projet dédié, séparé de toute autre infra existante, avec deux buckets Storage distincts (`documents`, `audio`).
- Pas d'environnement de staging — développement direct contre la production, décision explicite pour un outil interne solo.
- Pas d'outil de supervision/alerting dédié — logs Render + sauvegardes automatiques Supabase jugés suffisants pour ce stade.
- Enveloppe de file de synchronisation précisée : clé d'idempotence `entity_id + field` (jamais un id par tentative), `update` transporte un delta (jamais un instantané complet), `delete` prime sur toute entrée `pending` restante du même `entity_id`.

### UX Design Requirements

UX-DR1: Système de tokens couleur complet (clair + sombre) — primary/secondary, fonds, bordures, header, texte, priorité (avec couleurs de contraste texte dédiées), danger, palette de rotation projet (8 teintes hors bleu de marque).
UX-DR2: Typographie système uniquement (aucune police custom chargée), rôles définis (display/heading/body/label/caption/micro).
UX-DR3: Échelle de rayons (`rounded`) et d'espacement (`spacing`) en base 4px, appliquées de façon cohérente à tous les composants.
UX-DR4: Composant Switcher segmenté (bloc unique, segment actif seul en fond plein) — réutilisé à deux niveaux : navigation Général/Projets, et onglets Tâches/Documents/Notes.
UX-DR5: Composant Carte de tâche/note/document (titre, priorité, provenance, échéance, badge "nouveau", métadonnées fichier pour un document).
UX-DR6: Composant Puce de priorité (3 niveaux, couleur + lettre contrastée) réutilisé sur les cartes, l'étape de capture, et le calendrier.
UX-DR7: Composant Badge "nouveau" (point, disparition automatique à consultation).
UX-DR8: Composant Puce de métadonnée (provenance, date, variante "en retard").
UX-DR9: Composant Contrôle de statut de tâche (3 segments à faire/en cours/terminé).
UX-DR10: Composant FAB "+" persistant, jamais masqué par le clavier virtuel.
UX-DR11: Composant Champ de saisie (bordure focus, libellé au-dessus, sans validation intrusive pendant la frappe).
UX-DR12: Composant Case à cocher (filtres de tri combinables).
UX-DR13: Composant Modale/overlay — plein écran mobile, carte centrée avec fond assombri sur desktop ; fermeture explicite uniquement (pas de tap-en-dehors silencieux).
UX-DR14: Composant Stepper de capture (3 étapes, états fait/actuel/à venir, logique de retour à l'étape Projet si Note/Document choisi après un "sans projet").
UX-DR15: Composants Bouton primaire / fantôme / destructif (destructif réservé exclusivement à la confirmation de suppression de document).
UX-DR16: Usage du logo Strat'Edge : symbole seul (SVG) en header/favicon, logo complet (PNG) au splash screen PWA.
UX-DR17: Architecture de l'information : Connexion, Général (calendrier), Projets (liste), Vue projet (3 onglets), Détail d'élément, Capture "+" — navigation de premier niveau par switcher fixe sous le header.
UX-DR18: Ton de la microcopie : vouvoiement partout, phrases factuelles courtes, aucun emoji/exclamation/jargon technique exposé (table Do/Don't complète dans EXPERIENCE.md).
UX-DR19: États à couvrir : non authentifié, échec de connexion, chargement initial, aucun projet/calendrier vide, onglet vide par type, écriture hors ligne, synchronisation (à jour/en attente/en cours/échec persistant), conflit de synchronisation, accès micro/caméra refusé, note vocale sans transcription, tâche en retard, projet archivé, permission notification refusée, PWA iOS non installée.
UX-DR20: Primitives d'interaction : tap uniquement (pas de swipe/long-press/pull-to-refresh en V1) ; aucune gamification (streaks, scores).
UX-DR21: Accessibilité : cibles tactiles ≥44px/48dp, rôles/états lecteur d'écran (badge "nouveau" et statut de sync annoncés), respect de la taille de texte système, Reduce Motion (suppression des transitions d'ombre), ordre de focus clavier aligné sur la lecture.
UX-DR22: Responsive : switcher pleine largeur mobile / centré desktop, overlay de capture plein écran mobile / modale centrée desktop, calendrier semaine par défaut mobile / mois par défaut desktop.

### FR Coverage Map

FR-1: Epic 3 - Capture universelle depuis n'importe quel écran
FR-2: Epic 3 - Sélection du projet avant saisie (Note/Document obligatoire, Tâche optionnelle)
FR-3: Epic 3 - Sélection de la priorité (3 types)
FR-4: Epic 3 - Choix du type de contenu
FR-5: Epic 3 - Capture fonctionnelle hors ligne
FR-6: Epic 2 - Création d'un projet
FR-7: Epic 2 - Liste des projets
FR-8: Epic 2 - Archivage d'un projet
FR-9: Epic 2 - Désarchivage d'un projet
FR-10: Epic 3 - Création d'une tâche
FR-11: Epic 3 - Apparition automatique dans le calendrier général
FR-12: Epic 3 - Rappel déclenchant une notification (planification ; l'envoi effectif est Epic 7)
FR-13: Epic 3 - Suivi du statut d'une tâche
FR-14: Epic 3 - Modification de la priorité après coup
FR-15: Epic 5 - Création d'une note texte
FR-16: Epic 5 - Création d'une note vocale
FR-17: Epic 5 - Transcription à la demande
FR-18: Epic 6 - Ajout d'un document
FR-19: Epic 6 - Liste des documents d'un projet
FR-20: Epic 6 - Téléchargement d'un document
FR-21: Epic 6 - Suppression d'un document
FR-22: Epic 3 - Sélecteur à trois onglets (Tâches fonctionnel ; Notes/Documents étendus en Epic 5/6)
FR-23: Epic 3 - Filtres de tri combinables
FR-24: Epic 3 - Indicateur de provenance
FR-25: Epic 3 - Statut "nouveau"
FR-26: Epic 3 - Affichage visuel de la priorité
FR-27: Epic 4 - Vue calendrier mois/semaine
FR-28: Epic 4 - Filtre multi-projet
FR-29: Epic 4 - Code couleur par projet
FR-30: Epic 4 - Accès rapide depuis le calendrier
FR-31: Epic 4 - Exclusion des projets archivés par défaut
FR-32: Epic 4 - Affichage visuel de la priorité dans le calendrier
FR-33: Epic 3 - Écriture locale hors ligne
FR-34: Epic 3 - Synchronisation automatique
FR-35: Epic 3 - Indicateur visuel de synchronisation
FR-36: Epic 7 - Déclenchement sur rappel
FR-37: Epic 7 - Contenu de la notification
FR-38: Epic 7 - Ré-enregistrement silencieux du token
FR-39: Epic 1 - Connexion par email et mot de passe

## Epic List

### Epic 1: Fondations & Authentification
Guillaume peut installer l'application (PWA) sur son téléphone et son ordinateur, s'authentifier en sécurité par email et mot de passe, et retrouve dès le premier écran l'identité visuelle Strat'Edge (couleurs, typographie, logo). Pose le socle technique (Next.js, Supabase, RLS, Dexie, Serwist) sur lequel tous les epics suivants s'appuient.
**FRs covered:** FR-39

### Story 1.1: Initialisation et déploiement du projet

As a Guillaume,
I want l'application déployée et installable en tant que PWA,
So that je dispose d'une base technique fonctionnelle sur laquelle construire les fonctionnalités.

**Acceptance Criteria:**

**Given** le dépôt du projet est initialisé avec Next.js App Router et TypeScript
**When** le projet est déployé sur Render (Web Service)
**Then** l'application est accessible via une URL publique et répond avec succès

**Given** un navigateur mobile ou desktop compatible PWA
**When** l'utilisateur visite l'application
**Then** il peut l'installer sur l'écran d'accueil (manifest PWA + service worker Serwist enregistrés)

**Given** le projet Supabase dédié est créé
**When** une table est ajoutée au schéma
**Then** elle active Row Level Security par défaut avant tout déploiement en production

**Given** le stockage local Dexie est initialisé
**When** l'application démarre pour la première fois
**Then** elle demande un stockage persistant au navigateur (`navigator.storage.persist()`)

### Story 1.2: Connexion par email et mot de passe

As a Guillaume,
I want me connecter avec mon email et mon mot de passe,
So that j'accède à mes données en sécurité et personne d'autre ne peut y accéder.

**Acceptance Criteria:**

**Given** je ne suis pas authentifié
**When** j'ouvre l'application
**Then** je vois un écran de connexion demandant email et mot de passe, sans option de lien magique

**Given** je saisis des identifiants valides
**When** je soumets le formulaire
**Then** je suis authentifié via Supabase Auth et redirigé vers l'écran Général

**Given** je saisis des identifiants invalides
**When** je soumets le formulaire
**Then** un message factuel "Email ou mot de passe incorrect." s'affiche, le champ mot de passe est vidé, sans indiquer lequel des deux est erroné

**Given** je suis authentifié
**When** j'effectue une requête vers Supabase
**Then** la politique RLS restreint les résultats à mon propre compte (`auth.uid()`), même mono-utilisateur

### Story 1.3: Application de l'identité visuelle Strat'Edge

As a Guillaume,
I want que l'application affiche les couleurs, la typographie et le logo Strat'Edge dès le premier écran,
So that l'app soit immédiatement crédible visuellement, y compris pour la montrer à un client.

**Acceptance Criteria:**

**Given** les tokens de couleur/typographie/rayons/espacement définis dans DESIGN.md
**When** n'importe quel écran de l'application est affiché
**Then** il utilise exclusivement ces tokens (aucune couleur ou police codée en dur hors palette)

**Given** le thème clair ou sombre sélectionné
**When** l'utilisateur bascule entre les deux
**Then** l'ensemble de l'interface s'adapte sans rupture visuelle, le header restant en couleur de marque fixe dans les deux thèmes

**Given** l'application installée en PWA
**When** l'utilisateur la lance depuis l'écran d'accueil
**Then** le logo complet Strat'Edge apparaît sur l'écran de démarrage (splash screen), et le symbole seul comme favicon et dans le header

**Given** n'importe quel élément interactif de l'interface
**When** il est construit
**Then** il respecte le socle d'accessibilité d'EXPERIENCE.md : cible tactile ≥44px/48dp, rôle et état exposés au lecteur d'écran, ordre de focus clavier aligné sur la lecture, transitions désactivées si Reduce Motion est actif

### Epic 2: Gestion des projets
Guillaume peut créer un projet, consulter la liste de ses projets (actifs en premier), l'archiver sans rien perdre, et le désarchiver. Brique de base indispensable avant toute capture de contenu.
**FRs covered:** FR-6, FR-7, FR-8, FR-9

### Story 2.1: Création d'un projet

As a Guillaume,
I want créer un nouveau projet avec un nom, une description et une couleur,
So that je puisse commencer à y rattacher des tâches, notes et documents.

**Acceptance Criteria:**

**Given** je suis sur l'écran Projets
**When** je lance la création d'un projet et saisis un nom
**Then** le projet est créé avec le statut "actif" (description et couleur optionnelles à la saisie)

**Given** je ne modifie pas la couleur
**When** le projet est créé
**Then** une couleur est assignée automatiquement par rotation dans la palette de projet (8 teintes définies dans DESIGN.md)

**Given** je veux une couleur différente
**When** je la sélectionne manuellement à la création
**Then** le projet est créé avec la couleur choisie

**Given** le nom du projet est vide
**When** je tente de valider
**Then** la création est bloquée (nom obligatoire)

### Story 2.2: Liste et navigation des projets

As a Guillaume,
I want consulter la liste de mes projets et naviguer entre Général et Projets,
So that je retrouve facilement l'ensemble de mon travail organisé.

**Acceptance Criteria:**

**Given** plusieurs projets actifs et archivés existent
**When** j'ouvre l'écran Projets
**Then** les projets actifs s'affichent en premier, les archivés regroupés dans une section repliée par défaut

**Given** je suis sur n'importe quel écran
**When** je tape sur le switcher segmenté en haut
**Then** je bascule entre "Général" et "Projets" sans perdre mon contexte

**Given** un projet actif
**When** il s'affiche dans la liste
**Then** son nom et sa couleur sont visibles avec un indicateur de statut

### Story 2.3: Archivage et désarchivage d'un projet

As a Guillaume,
I want archiver un projet terminé et le désarchiver si besoin,
So that ma liste de projets actifs reste pertinente sans jamais perdre de données.

**Acceptance Criteria:**

**Given** un projet actif
**When** je l'archive
**Then** il disparaît de la liste principale et du sélecteur de capture "+", ses tâches disparaissent du calendrier général par défaut, mais rien n'est supprimé

**Given** un projet archivé
**When** je consulte la section "Archivés"
**Then** je peux l'ouvrir et retrouver intactes ses tâches, notes et documents

**Given** un projet archivé
**When** je le désarchive
**Then** il est immédiatement restauré dans la liste active, le sélecteur de capture, et le calendrier général

### Epic 3: Capture universelle & Tâches
Guillaume peut capturer une tâche en quelques secondes depuis n'importe quel écran, connecté ou non (flux Projet → Priorité → Type), la voir apparaître dans la vue de son projet avec ses indicateurs (provenance, nouveau, priorité), et faire évoluer son statut. Toute écriture passe d'abord en local (Dexie) et se synchronise automatiquement au retour du réseau, avec résolution de conflit par champ si nécessaire. Cet epic prouve de bout en bout l'infrastructure Local-First que les epics suivants réutiliseront sans la reconstruire.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-10, FR-11, FR-12, FR-13, FR-14, FR-22, FR-23, FR-24, FR-25, FR-26, FR-33, FR-34, FR-35

### Story 3.1: Capture d'une tâche via le flux "+"

As a Guillaume,
I want capturer une tâche en choisissant projet, priorité, puis titre/échéance/rappel,
So that je note ce qui me vient à l'esprit en quelques secondes, où que je sois.

**Acceptance Criteria:**

**Given** n'importe quel écran avec contenu
**When** je tape le bouton "+"
**Then** le flux s'ouvre en 3 étapes : Projet → Priorité → Type de contenu

**Given** l'étape Projet
**When** je choisis "Tâche" comme type plus tard dans le flux
**Then** je peux aussi passer l'étape Projet ("Sans projet") et créer une tâche générale

**Given** l'étape Projet pour un type Note ou Document
**When** aucun projet n'est sélectionné
**Then** la validation est bloquée (projet obligatoire pour ces deux types)

**Given** l'étape Priorité
**When** je choisis Basse, Normale ou Haute
**Then** la priorité est enregistrée manuellement, jamais déduite automatiquement

**Given** le type "Tâche" choisi à l'étape 3
**When** je saisis un titre (obligatoire), une description, une échéance et un rappel
**Then** la tâche est créée ; le rappel n'est disponible que si une échéance est renseignée

### Story 3.2: Écriture hors ligne et synchronisation automatique

As a Guillaume,
I want que toute capture fonctionne sans connexion et se synchronise seule au retour du réseau,
So that je ne perde jamais une idée capturée hors ligne.

**Acceptance Criteria:**

**Given** aucune connexion réseau disponible
**When** je capture une tâche
**Then** elle est stockée localement (Dexie) et mise en file d'attente, sans blocage ni message d'erreur

**Given** des éléments en attente de synchronisation
**When** la connexion réseau revient
**Then** la file se synchronise automatiquement avec Supabase, sans action de ma part

**Given** n'importe quel écran
**When** l'état de synchronisation change
**Then** un indicateur discret et permanent affiche l'état courant (à jour / en attente / en cours)

**Given** plusieurs tentatives de synchronisation infructueuses pour un même élément
**When** l'échec persiste
**Then** l'indicateur passe à un état "Non synchronisé — toucher pour réessayer" ; la donnée reste visible et intacte localement

### Story 3.3: Vue projet — onglets et indicateurs

As a Guillaume,
I want ouvrir un projet et voir mes tâches listées avec leur provenance et leur nouveauté,
So that je repère immédiatement ce qui a été capturé ailleurs et reste à traiter.

**Acceptance Criteria:**

**Given** j'ouvre un projet
**When** l'écran s'affiche
**Then** un sélecteur à trois onglets (Tâches, Documents, Notes) est visible, Tâches actif par défaut et fonctionnel (Documents/Notes affichent un état vide en attendant leurs epics dédiés)

**Given** une tâche capturée depuis un autre appareil
**When** elle apparaît dans la liste
**Then** elle porte un badge "nouveau" et un indicateur de provenance (téléphone/ordinateur)

**Given** une tâche marquée "nouveau"
**When** je l'ouvre
**Then** le badge disparaît, quel que soit l'appareil utilisé pour la consulter

**Given** une tâche affichée dans la liste
**When** je la regarde
**Then** son niveau de priorité est visible visuellement, indépendamment du tri actif

### Story 3.4: Tri combinable dans la vue projet

As a Guillaume,
I want trier mes tâches par ordre chronologique et/ou par priorité,
So that je choisisse comment scanner ma liste selon le moment.

**Acceptance Criteria:**

**Given** l'onglet Tâches d'un projet
**When** j'ouvre l'écran
**Then** le filtre "Chronologique" est coché par défaut, "Prioritaire" décoché

**Given** je coche uniquement "Chronologique"
**When** la liste s'affiche
**Then** l'ordre suit la date de capture

**Given** je coche uniquement "Prioritaire"
**When** la liste s'affiche
**Then** l'ordre suit le niveau de priorité

**Given** je coche les deux filtres
**When** la liste s'affiche
**Then** le tri se fait par priorité en premier critère, puis par ordre chronologique au sein de chaque niveau

**Given** je décoche les deux filtres
**When** la liste s'affiche
**Then** elle retombe automatiquement sur l'ordre chronologique

### Story 3.5: Suivi du statut et modification de la priorité d'une tâche

As a Guillaume,
I want faire évoluer le statut d'une tâche et changer sa priorité après coup,
So that mon suivi reste à jour sans avoir à recréer la tâche.

**Acceptance Criteria:**

**Given** une tâche existante
**When** je tape un segment de statut (à faire / en cours / terminé)
**Then** son statut change immédiatement, sans ordre imposé

**Given** une tâche existante
**When** je modifie sa priorité depuis son détail
**Then** la nouvelle priorité est enregistrée et reflétée partout où elle est affichée

**Given** une tâche avec une échéance
**When** elle est créée ou modifiée
**Then** elle porte les données nécessaires à son affichage dans le calendrier général (Epic 4)

### Story 3.6: Résolution de conflit de synchronisation par champ

As a Guillaume,
I want que mes modifications concurrentes sur deux appareils ne s'écrasent jamais silencieusement,
So that je ne perde jamais une décision prise sur l'un ou l'autre appareil.

**Acceptance Criteria:**

**Given** le statut d'une tâche modifié différemment sur deux appareils hors ligne avant synchronisation
**When** les deux se synchronisent
**Then** l'élément passe dans un état visible "conflit de synchronisation — à vérifier", les deux valeurs sont conservées

**Given** un conflit affiché sur une tâche
**When** je l'ouvre
**Then** je vois les deux valeurs en présence et je choisis celle à conserver ; le badge disparaît une fois tranché

**Given** deux appareils modifiant des champs différents de la même tâche hors ligne (ex. statut sur l'un, priorité sur l'autre)
**When** ils se synchronisent
**Then** les deux changements s'appliquent automatiquement, sans conflit déclaré

### Epic 4: Calendrier général
Guillaume peut voir toutes ses échéances tous projets confondus, en vue mois ou semaine, filtrables par projet, colorées par projet, et créer ou sélectionner un projet directement depuis cet écran.
**FRs covered:** FR-27, FR-28, FR-29, FR-30, FR-31, FR-32

### Story 4.1: Vue calendrier mois/semaine

As a Guillaume,
I want voir toutes mes tâches à échéance dans un calendrier, coloré par projet,
So that j'aie une vue d'ensemble de tous mes engagements sans ouvrir chaque projet.

**Acceptance Criteria:**

**Given** des tâches à échéance dans plusieurs projets
**When** j'ouvre l'écran Général
**Then** elles apparaissent dans une grille mensuelle, chacune colorée selon la couleur de son projet

**Given** la vue calendrier
**When** je bascule entre vue mois et vue semaine
**Then** l'affichage change en conservant le filtre de projet actif

**Given** une tâche affichée dans le calendrier
**When** je la regarde
**Then** son niveau de priorité est visible visuellement, sans jamais affecter sa position dans la grille (la date prime)

### Story 4.2: Filtre par projet et gestion des projets archivés

As a Guillaume,
I want filtrer le calendrier par projet et exclure les projets archivés par défaut,
So that je ne voie que ce qui est pertinent aujourd'hui.

**Acceptance Criteria:**

**Given** plusieurs projets actifs
**When** j'en sélectionne un ou plusieurs dans le filtre
**Then** seules les tâches de ces projets restent affichées

**Given** un projet archivé
**When** j'affiche le calendrier sans filtre spécifique
**Then** ses tâches n'apparaissent pas

**Given** je veux revoir les tâches d'un projet archivé
**When** j'active le filtre "afficher les projets archivés"
**Then** elles réapparaissent dans le calendrier

### Story 4.3: Accès rapide à un projet depuis le calendrier

As a Guillaume,
I want créer ou sélectionner un projet directement depuis le calendrier,
So that je n'aie pas besoin de changer d'écran pour organiser mon travail.

**Acceptance Criteria:**

**Given** l'écran Général
**When** je déclenche l'accès rapide
**Then** je peux créer un nouveau projet ou sélectionner un projet existant sans quitter le contexte du calendrier

### Epic 5: Notes (texte & vocal)
Guillaume peut capturer une note texte ou un enregistrement vocal depuis le flux "+", sur téléphone comme sur ordinateur, et demander une transcription texte à la demande sans que ce soit automatique.
**FRs covered:** FR-15, FR-16, FR-17

### Story 5.1: Création d'une note texte

As a Guillaume,
I want capturer une note texte libre depuis le flux "+",
So that je note une idée écrite en quelques secondes.

**Acceptance Criteria:**

**Given** l'étape Type du flux "+"
**When** je choisis "Note texte"
**Then** je saisis librement du texte, rattaché au projet et à la priorité déjà choisis

**Given** une note texte créée
**When** j'ouvre l'onglet Notes du projet
**Then** elle apparaît dans la liste avec les mêmes indicateurs que les tâches (provenance, nouveau, priorité)

### Story 5.2: Enregistrement d'une note vocale

As a Guillaume,
I want enregistrer un vocal directement dans l'app, sur téléphone comme sur ordinateur,
So that je capture une idée à l'oral sans avoir à l'écrire.

**Acceptance Criteria:**

**Given** l'étape Type du flux "+"
**When** je choisis "Note vocale" et j'enregistre via le micro de mon appareil
**Then** l'audio est stocké et rattaché au projet, sur mobile comme sur desktop

**Given** aucune connexion réseau
**When** j'enregistre une note vocale
**Then** l'audio est stocké localement (Dexie) et mis en file de synchronisation comme tout autre contenu

**Given** l'accès micro refusé par le navigateur/OS
**When** je tente d'enregistrer
**Then** un état dégradé explicite s'affiche ("Micro indisponible"), sans bloquer les autres types de capture

### Story 5.3: Transcription à la demande

As a Guillaume,
I want demander la transcription texte d'une note vocale, à la création ou après coup,
So that certaines de mes notes vocales deviennent cherchables en texte, sans que ce soit systématique.

**Acceptance Criteria:**

**Given** une note vocale
**When** je déclenche "Générer la transcription" (à la création ou depuis le détail)
**Then** une transcription texte est générée via l'API `gpt-transcribe`, appelée uniquement côté serveur

**Given** une note vocale sans transcription demandée
**When** je la consulte
**Then** elle reste pleinement valide et consultable (lecture audio), dans un état visuellement distinct d'une note transcrite

### Epic 6: Documents
Guillaume peut attacher un fichier à un projet (sélecteur desktop ou caméra/galerie mobile), consulter la liste des documents d'un projet, en télécharger un, ou le supprimer définitivement.
**FRs covered:** FR-18, FR-19, FR-20, FR-21

### Story 6.1: Ajout d'un document

As a Guillaume,
I want attacher un fichier à un projet depuis le flux "+",
So that mes documents et photos liés à un projet soient centralisés au même endroit.

**Acceptance Criteria:**

**Given** l'étape Type du flux "+"
**When** je choisis "Document" et sélectionne un fichier (sélecteur desktop, ou caméra/galerie mobile)
**Then** le fichier est ajouté au projet choisi, avec nom/type/taille enregistrés automatiquement

**Given** un fichier de plus de 20 Mo
**When** je tente de l'ajouter
**Then** l'ajout est refusé avec un message explicite (limite de taille)

**Given** aucune connexion réseau
**When** j'ajoute un document
**Then** il est stocké localement (blob Dexie) jusqu'à upload réussi vers Supabase Storage

**Given** un upload interrompu par une coupure réseau
**When** la connexion revient
**Then** l'upload reprend depuis le dernier point réussi, sans repartir de zéro

### Story 6.2: Liste et consultation des documents d'un projet

As a Guillaume,
I want consulter la liste des documents d'un projet,
So that je retrouve rapidement un fichier déjà ajouté.

**Acceptance Criteria:**

**Given** un projet avec des documents
**When** j'ouvre son onglet Documents
**Then** chaque document affiche son nom, son type, et sa date d'ajout, avec les mêmes indicateurs que les autres types (provenance, nouveau, priorité)

### Story 6.3: Téléchargement et suppression d'un document

As a Guillaume,
I want télécharger ou supprimer un document,
So that je récupère un fichier sur mon appareil ou nettoie un projet.

**Acceptance Criteria:**

**Given** un document dans la liste
**When** je déclenche le téléchargement
**Then** le fichier est enregistré sur mon appareil

**Given** un document dans la liste
**When** je déclenche la suppression
**Then** une modale de confirmation s'affiche avec un bouton destructif clairement identifié (couleur dédiée), distincte d'une simple annulation

**Given** je confirme la suppression
**When** l'action est validée
**Then** le document est supprimé définitivement du projet et de Supabase Storage

### Epic 7: Notifications push
Guillaume reçoit une notification push au moment exact défini par un rappel de tâche, avec le titre de la tâche et le nom du projet, de façon fiable sur chacun de ses appareils (ré-enregistrement silencieux du token en cas d'expiration).
**FRs covered:** FR-36, FR-37, FR-38

### Story 7.1: Abonnement aux notifications par appareil

As a Guillaume,
I want que chacun de mes appareils s'abonne indépendamment aux notifications,
So that je reçoive mes rappels de façon fiable, même si je change d'appareil ou que mon abonnement expire.

**Acceptance Criteria:**

**Given** l'application ouverte sur un appareil pour la première fois
**When** la permission de notification est accordée
**Then** un abonnement push est créé pour cet appareil spécifiquement (entité `PushSubscription`), sans écraser celui d'un autre appareil

**Given** un abonnement existant qui expire ou se réinitialise
**When** le service worker s'active
**Then** il se ré-enregistre silencieusement, sans action requise de l'utilisateur

**Given** la permission de notification refusée
**When** je continue à utiliser l'application
**Then** mes rappels restent visibles et fonctionnels dans l'app, avec un état explicite signalant l'absence de notification push

### Story 7.2: Déclenchement du rappel et envoi de la notification

As a Guillaume,
I want recevoir une notification à l'heure exacte du rappel d'une tâche,
So that je sois alerté au bon moment, même si l'application n'est pas ouverte.

**Acceptance Criteria:**

**Given** une tâche avec un rappel programmé (`reminder_at`)
**When** l'heure du rappel est atteinte
**Then** le Render Cron Job déclenche l'envoi d'une notification push via le route handler serveur protégé

**Given** une notification envoyée
**When** elle s'affiche
**Then** elle contient le titre de la tâche et le nom du projet associé

**Given** un appareil iOS
**When** l'application n'a pas été installée via "Ajouter à l'écran d'accueil"
**Then** un message explicite informe que les notifications nécessitent cette installation
