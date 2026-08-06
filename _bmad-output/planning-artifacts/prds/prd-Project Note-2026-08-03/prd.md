---
title: Application de gestion de projets personnelle
status: final
created: 2026-08-03
updated: 2026-08-03
---

# PRD: Application de gestion de projets personnelle

## 0. Document Purpose

Ce PRD s'adresse à Guillaume en tant que PM et futur exécutant (via les workflows UX/architecture/epics en aval). Il s'appuie sur le Product Brief déjà produit (`brief-Project Note-2026-08-03/brief.md`) et sur la spec technique initiale (`spec-app-gestion-projets.md`) — ce document ne les duplique pas, il les traduit en exigences fonctionnelles précises. Vocabulaire ancré dans le Glossaire (§3) ; fonctionnalités regroupées avec exigences fonctionnelles (FR) numérotées à l'intérieur ; hypothèses signalées `[ASSUMPTION]` inline et indexées en §10.

## 1. Vision

Une PWA mono-utilisateur qui devient le seul endroit où Guillaume dépose une idée, une tâche, un document ou une note vocale liée à l'un de ses projets professionnels — où qu'il soit, connecté ou non — et où il les retrouve ensuite structurés par projet, sans effort de mémoire ni de tri manuel entre outils.

Elle existe parce que Guillaume pilote une dizaine de projets professionnels simultanés chez Strat'Edge et que ses meilleures idées lui viennent hors du bureau — le soir, en déplacement — au moment où il est le moins équipé pour les traiter. Aujourd'hui, sa mémoire et des notes éparpillées dans l'app native de son téléphone ne suffisent plus à garantir qu'aucune idée ne se perd, ni qu'elle atterrisse au bon endroit.

Au-delà de l'usage quotidien, l'app sert aussi de vitrine : construite sur mesure aux couleurs de Strat'Edge, elle démontre concrètement, face aux clients, le savoir-faire que l'entreprise vend en organisation et en création d'outils.

## 2. Target User

### 2.1 Jobs To Be Done

**Fonctionnels**
- Capturer une idée, une tâche, un rendez-vous ou un document en quelques secondes, sur téléphone comme sur ordinateur, connecté ou non
- Retrouver, sur n'importe quel appareil, tout ce qui a été capturé ailleurs — classé par projet, situé dans le temps (téléphone et ordinateur offrent tous deux la capture et la consultation ; "arriver au bureau" n'est qu'un exemple de moment de reprise, pas une répartition des rôles entre appareils)
- Consulter en un coup d'œil, depuis n'importe quel appareil, les échéances de tous les projets, filtrables (calendrier général)

**Émotionnels**
- Ne plus porter la charge mentale de "je dois me souvenir d'avoir noté ça, et d'aller le relire"
- Avoir confiance que rien n'est perdu, même capturé dans l'urgence ou hors ligne

**Sociaux / contextuels**
- Pouvoir sortir, en rendez-vous client, un outil interne construit sur mesure — preuve concrète du savoir-faire Strat'Edge en organisation et création d'outils

### 2.2 Key User Journeys

- **UJ-1.** Guillaume, un soir en rentrant, a une idée pour un projet de formation — il ouvre l'app sur son téléphone, appuie sur "+", choisit le projet, dicte un vocal, et referme l'app en quelques secondes, sans connexion nécessaire.
- **UJ-2.** Guillaume, le lendemain sur son ordinateur au bureau, ouvre le projet concerné et retrouve le vocal de la veille dans la liste chronologique, marqué "nouveau" et identifié comme provenant du téléphone, prêt à être traité.
- **UJ-3.** Guillaume, entre deux rendez-vous, capture depuis son téléphone une tâche avec échéance pour un projet — elle apparaît immédiatement dans le calendrier général, consultable depuis n'importe quel appareil.

## 3. Glossary

- **Projet** — Regroupement thématique de tâches, notes et documents autour d'un objectif professionnel. Possède un nom, une description, une couleur, un statut (actif / archivé).
- **Tâche** — Élément actionnable rattaché à un projet, avec échéance optionnelle, rappel optionnel, priorité, et statut (à faire / en cours / terminé).
- **Tâche générale** — Tâche créée sans projet associé (seul type de contenu capturable pouvant se passer de projet, cf. FR-2).
- **Note** — Élément d'information libre rattaché à un projet, de type texte ou vocal.
- **Note vocale** — Note enregistrée sous forme audio, avec transcription textuelle optionnelle générée à la demande (Whisper).
- **Document** — Fichier rattaché à un projet, stocké et téléchargeable.
- **Capture ("+")** — Geste d'entrée unique de l'application : sélection du projet, puis saisie d'une note, d'une tâche, ou d'un document.
- **Priorité** — Niveau d'urgence assigné manuellement par l'utilisateur à une tâche, une note, ou un document, à la capture ou après coup. Jamais détecté automatiquement.
- **Provenance** — Appareil (téléphone ou ordinateur) depuis lequel un élément a été capturé.
- **Statut "nouveau"** — Marqueur visuel indiquant qu'un élément n'a pas encore été consulté par l'utilisateur, quel que soit l'appareil de consultation.
- **Calendrier général** — Vue agrégée, tous projets confondus, des tâches ayant une échéance, filtrable et codée par couleur de projet.
- **Synchronisation** — Processus automatique de mise à jour des données locales (créées hors ligne) vers le serveur, dès que la connexion réseau est rétablie.
- **Rappel** — Horodatage associé à une tâche qui déclenche une notification push à l'heure définie.

## 4. Features

### 4.1 Capture rapide ("+")

**Description:** Bouton "+" toujours accessible, sur mobile comme sur desktop, quel que soit l'écran affiché. Le flux demande, dans l'ordre : le **Projet** (obligatoire pour une Note ou un Document ; optionnel pour une Tâche, qui devient alors une tâche générale), puis la **Priorité** (s'applique aux trois types de contenu — note, tâche, document), puis le type de contenu à saisir : note texte, note vocale, tâche, ou document. Fonctionne entièrement hors ligne. Réalise UJ-1, UJ-3.

**Functional Requirements:**

#### FR-1: Capture universelle depuis n'importe quel écran

L'utilisateur peut initier une capture à tout moment via un bouton "+" toujours visible, sur téléphone comme sur ordinateur.

**Consequences (testable):**
- Le bouton "+" reste accessible depuis le calendrier général, une vue projet, ou tout autre écran de l'app
- Le déclenchement ouvre le flux en 3 étapes : Projet → Priorité → Type de contenu

#### FR-2: Sélection du projet avant saisie

L'utilisateur doit choisir un projet existant avant de saisir une Note ou un Document ; pour une Tâche, il peut passer cette étape (tâche générale, sans projet).

**Consequences (testable):**
- Impossible de valider une Note ou un Document sans projet sélectionné
- Une Tâche sans projet est acceptée et classée comme tâche générale
- La liste de sélection affiche les projets actifs en premier

#### FR-3: Sélection de la priorité

Après avoir choisi le projet, l'utilisateur définit un niveau de priorité pour l'élément en cours de capture, avant de choisir le type de contenu. S'applique aux trois types capturables (note, tâche, document).

**Consequences (testable):**
- La priorité est un champ manuel, jamais déduit automatiquement (cf. Glossaire)
- Le champ Priorité est disponible et modifiable après coup sur l'élément créé, quel que soit son type
- Niveaux de priorité : Basse / Normale / Haute (échelle à 3 niveaux, confirmée)

**Notes:** Étend le modèle de données de la spec technique initiale, qui ne prévoyait un champ priorité que sur `Task` — Note et Document en héritent également ici.

#### FR-4: Choix du type de contenu

Après le Projet et la Priorité, l'utilisateur choisit le type d'élément à créer : note texte, note vocale, tâche, ou document — chacun ouvrant son formulaire minimal dédié (détaillé dans les features 4.3-4.5).

#### FR-5: Capture fonctionnelle hors ligne

L'ensemble du flux de capture (Projet + Priorité + saisie du contenu, tous types confondus) fonctionne sans connexion réseau active. Réalise UJ-1.

**Feature-specific NFRs:**
- Le flux de capture doit s'ouvrir quasi instantanément (`[ASSUMPTION: < 1 seconde sur mobile standard]`) — une idée fugace ne doit pas être perdue à cause d'un temps de chargement.

### 4.2 Gestion des projets

**Description:** Création, consultation et cycle de vie des Projets. Un Projet regroupe tâches, notes et documents ; il peut être archivé sans jamais être supprimé.

**Functional Requirements:**

#### FR-6: Création d'un projet

L'utilisateur peut créer un projet avec un nom (obligatoire), une description (optionnelle), et une couleur.

**Consequences (testable):**
- La couleur est assignée automatiquement par rotation dans la palette de marque Strat'Edge, modifiable manuellement à la création
- Le projet créé a le statut "actif"

#### FR-7: Liste des projets

L'utilisateur consulte la liste de ses projets, actifs affichés en premier, archivés regroupés dans une section séparée et repliée par défaut.

**Consequences (testable):**
- Chaque entrée affiche nom et couleur, avec un indicateur visuel de statut (actif/archivé)

#### FR-8: Archivage d'un projet

L'utilisateur peut archiver un projet actif. Rien n'est supprimé : tâches, notes et documents du projet restent intacts et consultables en ouvrant le projet archivé.

**Consequences (testable):**
- Un projet archivé disparaît de la liste principale et du sélecteur de projet du flux "+" (FR-2)
- Les tâches à échéance du projet archivé disparaissent du calendrier général par défaut
- Le calendrier général propose un filtre explicite "afficher les projets archivés" pour les faire réapparaître

#### FR-9: Désarchivage d'un projet

L'utilisateur peut désarchiver un projet, ce qui le restaure immédiatement dans la liste active, le sélecteur de capture, et le calendrier général.

### 4.3 Tâches

**Description:** Une Tâche capturée via le "+" (avec Projet et Priorité déjà choisis, cf. 4.1) peut recevoir un titre, une description, une échéance et un rappel — chacun optionnel — puis suit un cycle de statut simple. Réalise UJ-3.

**Functional Requirements:**

#### FR-10: Création d'une tâche

L'utilisateur saisit un titre (obligatoire), une description (optionnelle), une échéance (optionnelle), et un rappel (optionnel, nécessite une échéance).

**Consequences (testable):**
- Une tâche sans échéance est valide (simple item à faire, sans date)
- Un rappel ne peut être défini que si une échéance existe

#### FR-11: Apparition automatique dans le calendrier général

Toute tâche avec une échéance apparaît automatiquement dans le calendrier général (cf. 4.7), colorée selon son projet.

#### FR-12: Rappel déclenchant une notification

Un rappel programmé (`reminder_at`) déclenche une notification push à l'heure définie (détaillé en 4.9).

#### FR-13: Suivi du statut

L'utilisateur peut faire évoluer le statut d'une tâche : à faire → en cours → terminé.

**Consequences (testable):**
- Le changement de statut est manuel, à tout moment, sans ordre imposé

#### FR-14: Modification de la priorité après coup

La priorité assignée à la capture (FR-3) reste modifiable directement sur la tâche, à tout moment.

### 4.4 Notes

**Description:** Deux types de Note rattachée à un Projet : texte ou vocale. Une note vocale est enregistrée directement dans l'app (accès micro), stockée sous forme audio, avec transcription textuelle disponible à la demande via Whisper. Réalise UJ-1.

**Functional Requirements:**

#### FR-15: Création d'une note texte

L'utilisateur saisit librement du texte, rattaché au projet choisi lors de la capture.

#### FR-16: Création d'une note vocale

L'utilisateur enregistre un audio directement dans l'app via le micro de l'appareil, sur téléphone comme sur ordinateur (parité totale, cf. §2.1) ; l'audio est stocké et rattaché au projet.

**Consequences (testable):**
- L'enregistrement vocal est disponible depuis n'importe quel appareil disposant d'un micro, mobile ou desktop
- L'enregistrement fonctionne hors ligne (l'audio est mis en file de synchronisation comme tout autre contenu, cf. 4.7)

#### FR-17: Transcription à la demande

Pour toute note vocale, l'utilisateur choisit — à la création ou après coup — de générer une transcription texte (via Whisper) ou de garder l'audio seul. Choix à la demande plutôt que systématique : chaque transcription a un coût et une latence, et toutes les notes vocales n'ont pas besoin d'être cherchables en texte.

**Consequences (testable):**
- La transcription n'est jamais générée automatiquement sans action explicite de l'utilisateur
- Une note vocale sans transcription reste pleinement valide et consultable (lecture audio)

**Feature-specific NFRs:**
- Demande d'autorisation micro gérée nativement par le navigateur/OS ; l'app doit rester utilisable (autres captures) si l'accès micro est refusé

### 4.5 Documents

**Description:** Fichiers rattachés à un Projet, ajoutés par upload direct — sélecteur fichier sur desktop, caméra ou galerie sur mobile.

**Functional Requirements:**

#### FR-18: Ajout d'un document

L'utilisateur ajoute un document au projet choisi lors de la capture, via sélecteur de fichier (desktop) ou caméra/galerie (mobile).

**Consequences (testable):**
- Nom, type et taille du fichier sont enregistrés automatiquement à l'ajout
- Types de fichiers attendus en usage courant : photos et PDF (pas de vidéo ou fichier volumineux anticipé à ce stade)
- `[ASSUMPTION: taille maximale de fichier non définie — indexé en §9 Open Questions]`

#### FR-19: Liste des documents d'un projet

L'utilisateur consulte la liste des documents d'un projet, avec nom, type, et date d'ajout.

#### FR-20: Téléchargement d'un document

L'utilisateur télécharge un document du projet vers son appareil.

#### FR-21: Suppression d'un document

L'utilisateur supprime un document du projet. La suppression est définitive.

### 4.6 Vue projet — affichage et repérage

**Description:** À l'intérieur d'un projet, un sélecteur (segmented control) donne accès à trois onglets : Tâches, Documents, Notes `[NOTE FOR PM: intitulés exacts à valider en design, cf. spec §5.3, non bloquant]`. Chaque onglet affiche son contenu avec deux filtres de tri cochables indépendamment — Chronologique et Prioritaire — combinables entre eux, Chronologique coché par défaut. Chaque élément affiche sa provenance et un badge "nouveau" tant qu'il n'a pas été consulté. Réalise UJ-2.

**Functional Requirements:**

#### FR-22: Sélecteur à trois onglets

L'utilisateur navigue entre Tâches, Documents, et Notes au sein d'un projet.

#### FR-23: Filtres de tri combinables

Chaque onglet propose deux filtres à cocher indépendamment : "Chronologique" et "Prioritaire". Le filtre Chronologique est actif par défaut.

**Consequences (testable):**
- Chronologique seul : ordre par date de capture
- Prioritaire seul : ordre par niveau de priorité
- Les deux cochés ensemble : tri par priorité en premier critère, puis par ordre chronologique au sein de chaque niveau de priorité
- Aucun filtre coché : retombe automatiquement sur Chronologique par défaut (confirmé)

#### FR-24: Indicateur de provenance

Chaque élément affiche l'appareil (téléphone ou ordinateur) depuis lequel il a été capturé.

#### FR-25: Statut "nouveau"

Chaque élément non encore consulté par l'utilisateur porte un badge visuel "nouveau". Réalise UJ-2.

**Consequences (testable):**
- Le badge disparaît automatiquement dès que l'utilisateur ouvre/consulte l'élément, quel que soit l'appareil de consultation

#### FR-26: Affichage visuel de la priorité

Chaque élément affiche visuellement son niveau de priorité, indépendamment du filtre de tri actif.

### 4.7 Calendrier général

**Description:** Vue agrégée en lecture des tâches ayant une échéance, tous projets confondus, avec vue mois et vue semaine, filtrable par projet, colorée par projet.

**Functional Requirements:**

#### FR-27: Vue calendrier mois/semaine

L'utilisateur bascule entre une vue mensuelle et une vue hebdomadaire.

#### FR-28: Filtre multi-projet

L'utilisateur sélectionne un ou plusieurs projets pour filtrer les tâches affichées.

#### FR-29: Code couleur par projet

Chaque tâche affichée dans le calendrier porte la couleur de son projet.

#### FR-30: Accès rapide depuis le calendrier

L'utilisateur peut créer un nouveau projet ou en sélectionner un existant directement depuis l'écran du calendrier général.

#### FR-31: Exclusion des projets archivés par défaut

Les tâches des projets archivés n'apparaissent pas dans le calendrier général, sauf activation du filtre "afficher les projets archivés" (cf. FR-8).

#### FR-32: Affichage visuel de la priorité dans le calendrier

Chaque tâche affichée dans le calendrier général porte un indicateur visuel de sa priorité, sans que cela n'affecte son positionnement (le calendrier reste organisé par date, pas par priorité — sa nature de grille temporelle prime).

### 4.8 Mode hors ligne et synchronisation

**Description:** Toute création ou modification effectuée sans connexion réseau est stockée localement puis synchronisée automatiquement dès le retour du réseau, sans action de l'utilisateur.

**Functional Requirements:**

#### FR-33: Écriture locale hors ligne

Toute action de création/modification (capture, changement de statut, archivage...) est stockée localement et mise en file d'attente si aucune connexion réseau n'est disponible.

#### FR-34: Synchronisation automatique

Dès que la connexion réseau est détectée, la file d'attente se synchronise automatiquement avec le serveur, sans intervention de l'utilisateur.

#### FR-35: Indicateur visuel de synchronisation

Un indicateur discret et permanent affiche l'état courant : à jour / en attente de synchronisation / synchronisation en cours.

**Feature-specific NFRs:**
- La synchronisation d'un fichier volumineux (document, audio) interrompue par une coupure réseau doit reprendre automatiquement, pas repartir de zéro `[ASSUMPTION]`

### 4.9 Notifications push

**Description:** Notifications déclenchées par le rappel (`reminder_at`) d'une tâche, via Web Push (VAPID) et service worker.

**Functional Requirements:**

#### FR-36: Déclenchement sur rappel

Une notification push est envoyée à l'heure exacte définie par le rappel d'une tâche.

#### FR-37: Contenu de la notification

La notification affiche le titre de la tâche et le nom du projet associé.

#### FR-38: Ré-enregistrement silencieux du token

Le token de notification est ré-enregistré automatiquement et silencieusement lorsqu'il expire ou se réinitialise, sans action requise de l'utilisateur.

**Consequences (testable):**
- Particulièrement critique sur PWA iOS, où le token peut expirer plus fréquemment que sur Android natif (risque déjà identifié dans la spec technique initiale, §3)

**Feature-specific NFRs:**
- Sur iOS, les notifications ne fonctionnent que si l'app a été installée via "Ajouter à l'écran d'accueil" — contrainte de la plateforme, hors du contrôle de l'app. `[NOTE FOR PM: appareil principal actuel de Guillaume = Android, donc ce risque n'est pas vécu au quotidien aujourd'hui ; conservé car la spec technique initiale (§3) exige le support iOS 16.4+ en V1 et l'appareil principal pourrait changer — priorité de test/QA plus faible que le reste, à confirmer en phase UX/architecture]`

### 4.10 Authentification

**Description:** Accès mono-utilisateur protégé par email et mot de passe (Supabase Auth). Pas de lien magique : les documents stockés peuvent contenir des informations sensibles, ce qui impose une authentification standard.

**Functional Requirements:**

#### FR-39: Connexion par email et mot de passe

L'utilisateur s'authentifie avec un email et un mot de passe pour accéder à l'application.

**Consequences (testable):**
- Aucun mécanisme de lien magique n'est proposé
- Un seul compte utilisateur existe pour l'application (mono-utilisateur strict, pas de gestion de rôles ni de permissions)

## 5. Cross-Cutting NFRs

- **Fidélité à la charte graphique Strat'Edge — exigence de premier ordre, pas un item de polish.** Avant toute implémentation UI, l'application lit le fichier de branding de l'entreprise (`Strat'Edge/Branding/couleurs.md` + logos) et l'applique à l'ensemble du thème : couleurs d'interface (hors couleurs de labels de projet, qui suivent leur propre logique, cf. FR-6), typographie, logo dans le header et sur l'écran de démarrage (splash screen) de la PWA, favicon. Enjeu de crédibilité commerciale : l'app peut être montrée à des clients comme preuve de savoir-faire Strat'Edge.
- **Confidentialité des documents.** Les documents stockés peuvent contenir des informations sensibles (clients, contrats) — d'où l'authentification email/mot de passe plutôt qu'un lien magique (cf. FR-39), et un accès strictement mono-utilisateur aux données.

## 6. Non-Goals (Explicit)

- Pas de multi-utilisateurs, de partage de projets, ni d'édition collaborative
- Pas d'intégration calendrier tiers (Google, Outlook)
- Pas d'application native iOS/Android — PWA uniquement
- Pas de rapports ni de statistiques avancées, pas de suivi de performance business dans l'app — la mesure du résultat business reste manuelle, côté Guillaume
- Pas d'assistant IA de synthèse/restructuration des notes confuses en V1 (nettoyage, renommage automatique) — piste explicitement repoussée en V2, voir addendum du brief
- L'application ne sera jamais vendue à des tiers ni transformée en produit commercial — usage interne Strat'Edge exclusivement

## 7. MVP Scope

### 7.1 In Scope

- Capture universelle ("+" : Projet → Priorité → Type)
- Gestion de projets (création, archivage/désarchivage)
- Tâches (échéance, rappel, priorité, statut)
- Notes texte et vocales, avec transcription à la demande
- Documents (upload, liste, téléchargement, suppression)
- Vue projet à 3 onglets avec tri combinable et indicateurs (provenance, nouveau, priorité)
- Calendrier général filtrable par projet
- Mode hors ligne complet avec synchronisation automatique
- Notifications push sur rappel de tâche
- PWA installable, mobile et desktop
- Authentification email/mot de passe

### 7.2 Out of Scope for MVP

- Assistant IA de synthèse/restructuration des notes — **différé, piste V2** confirmée
- Multi-utilisateurs, partage, édition collaborative, intégration calendrier tiers, application native, rapports/statistiques avancées — **non prévus**, pas de piste V2 identifiée à ce stade

## 8. Success Metrics

**Primary**
- **SM-1**: Zéro idée/tâche/document perdu — absence de tout cas connu d'information capturée devenue irrécupérable, vérifiée par déclaration de Guillaume (pas d'instrumentation automatique en V1). Valide FR-1 à FR-5, FR-33 à FR-35.
- **SM-2**: Repérage immédiat des éléments capturés hors du poste habituel, via les indicateurs "nouveau"/provenance, sans avoir à chercher. Valide FR-24, FR-25.

**Secondary**
- **SM-3**: Usage régulier et durable de l'app (pas d'abandon après les premières semaines).

**Counter-metrics (do not optimize)**
- **SM-C1**: Le nombre d'étapes/champs du flux "+" ne doit pas croître au point de ralentir la capture d'une idée fugace — contrebalance toute tentation d'enrichir FR-1 à FR-3 avec plus de champs.

## 9. Open Questions

1. Taille maximale de fichier pour les documents — FR-18. Non bloquant : différé à la phase Architecture (limites Supabase Storage).
2. Intitulés exacts des 3 onglets Tâches/Documents/Notes — FR-22. Non bloquant : différé à la phase UX.
3. Reprise automatique d'un upload interrompu par une coupure réseau — FR-33 NFR. Non bloquant : confirmé en phase Architecture.

## 10. Assumptions Index

- §4.1 NFR — temps d'ouverture du flux de capture (`< 1 seconde` proposé)
- §4.5 FR-18 — taille maximale de fichier non définie (cf. Open Question 1)
- §4.8 NFR — reprise automatique d'un upload interrompu (cf. Open Question 3)
