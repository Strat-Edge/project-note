# Spécification — Application de gestion de projets personnelle

## 1. Vision

Application web progressive (PWA) mono-utilisateur, synchronisée entre ordinateur et téléphone, permettant de centraliser en un seul endroit tous les projets en cours : notes (texte et vocal), documents, tâches, et un calendrier global consultable et filtrable par projet.

Objectif : pouvoir capturer une idée ou une information liée à un projet **depuis n'importe où, y compris hors connexion**, et la retrouver synchronisée sur tous les appareils.

**Branding :** un fichier `.md` séparé, déjà présent dans le dossier de travail du repo, contient la charte graphique complète de l'entreprise (couleurs, logo, typographie). Claude Code doit lire ce fichier avant toute implémentation UI et l'appliquer à l'ensemble de l'application (thème, palette de couleurs des labels de projet, logo dans le header/splash screen PWA).

## 2. Portée (scope V1)

- **Mono-utilisateur strict.** Pas de gestion de rôles, pas de partage, pas de multi-comptes. Auth simple à prévoir mais pas d'architecture de permissions.
- **Pas d'intégration Google Calendar.** Calendrier autonome, propre à l'application.
- **Mode hors-ligne obligatoire.** Création de notes/tâches sans connexion, synchronisation automatique dès que le réseau revient.
- **PWA, pas d'app native.** Installable sur mobile (Android/iOS 16.4+) et desktop.

### Hors scope V1 (à ne pas développer maintenant)
- Multi-utilisateurs / partage de projets
- Intégration calendrier tiers (Google, Outlook)
- App native iOS/Android
- Édition collaborative de documents
- Rapports/statistiques avancées

## 3. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Frontend | Next.js (App Router) | Stack déjà maîtrisée par l'utilisateur |
| PWA | Serwist (ou next-pwa) | Service worker, installabilité, cache offline |
| Stockage local / offline | IndexedDB via Dexie.js | Queue d'écriture offline + sync au retour réseau |
| Backend | Supabase — **nouveau projet dédié**, séparé de toute autre infra existante | Postgres + Auth + Storage + Realtime en un seul service |
| Hébergement frontend | Render (Web Service) | Déploiement simple, compatible PWA, plateforme déjà utilisée pour une autre app de l'utilisateur — *révisé en phase Architecture, remplace Vercel* |
| Authentification | Email + mot de passe (Supabase Auth) | Documents sensibles → pas de magic link, sécurité standard |
| Notifications | Web Push API (VAPID) via service worker, déclenchée par un Render Cron Job | Rappels de tâches, fonctionne PWA installée iOS/Android |
| Transcription vocale | API OpenAI `gpt-transcribe` appelée à la demande | Au choix par note (voir §5), pas systématique — *révisé en phase Architecture : `whisper-1` est legacy, remplacé par `gpt-transcribe`* |
| Stockage documents/audio | Supabase Storage | Buckets séparés : documents, audio |

### Risque technique à noter pour Claude Code
Les notifications push sur PWA iOS nécessitent que l'utilisateur ait installé l'app via "Ajouter à l'écran d'accueil". Le token de notification peut expirer/se réinitialiser plus souvent que sur Android natif — prévoir une gestion de ré-enregistrement du token silencieuse.

## 4. Modèle de données (esquisse)

```
Project
- id
- name
- description
- color (référence à la palette de la charte graphique)
- status (actif / archivé)
- created_at

Task
- id
- project_id (FK, nullable si tâche générale)
- title
- description
- due_date
- reminder_at (déclenche notification push)
- status (à faire / en cours / terminé)
- created_at

Note
- id
- project_id (FK)
- type (texte | audio)
- content (texte, ou null si audio)
- audio_url (Supabase Storage, ou null si texte)
- transcription (texte, optionnel, généré à la demande via Whisper)
- created_at

Document
- id
- project_id (FK)
- file_url (Supabase Storage)
- file_name
- file_type
- file_size
- uploaded_at
```

La vue **Calendrier général** est une agrégation en lecture des `Task` ayant une `due_date`, filtrable par `project_id` et affichée avec la couleur du projet correspondant.

## 5. Fonctionnalités détaillées

### 5.1 Onglet général
- Calendrier (vue mois/semaine) affichant toutes les tâches/échéances tous projets confondus
- Filtre par projet (multi-sélection), avec code couleur systématique par projet
- Accès rapide : créer un nouveau projet, ou sélectionner un projet existant

### 5.2 Sélection/création de projet
- Liste des projets existants (actifs en premier, archivés séparés)
- Bouton "Nouveau projet" → nom, description, couleur assignée automatiquement (ou choisie dans la palette de marque)

### 5.3 Vue projet — sélecteur (radio button / segmented control)
Trois onglets à l'intérieur d'un projet :
- **Tâches**
- **Documents**
- **Notes**

(Les intitulés exacts de ces onglets sont à valider/affiner en cours de design — non bloquant pour le développement initial.)

#### Tâches
- Création rapide : titre + échéance optionnelle + rappel optionnel
- Une tâche avec échéance apparaît automatiquement dans le calendrier général
- Un rappel programmé déclenche une notification push à l'heure définie

#### Documents
- Ajout par upload direct (sélecteur fichier desktop, ou caméra/galerie sur mobile)
- Liste des documents du projet avec nom, type, date d'ajout
- Téléchargement / suppression

#### Notes
- Deux types : **texte** ou **vocal**
- Note vocale : enregistrement direct dans l'app (accès micro), stockage de l'audio
- Pour chaque note vocale, choix à la création (ou après coup) : générer une transcription texte via Whisper, ou garder l'audio seul
- Notes affichées en liste chronologique dans le projet

### 5.4 Mode hors-ligne
- Toute création (note, tâche, upload différé) fonctionne sans connexion
- Les écritures sont stockées localement (IndexedDB) et mises en file d'attente
- Synchronisation automatique dès que la connexion réseau est détectée
- Indicateur visuel discret de l'état de synchronisation (à jour / en attente de sync)

### 5.5 Notifications
- Déclenchées par le champ `reminder_at` des tâches
- Web Push via service worker
- Contenu de la notification : titre de la tâche + nom du projet

## 6. Points restant à affiner en cours de développement (non bloquants)
- Intitulés exacts des trois onglets (Tâches/Documents/Notes)
- Palette exacte des couleurs de projet → **lire le fichier de branding déjà présent dans le dossier de travail**
- Limite de taille des fichiers uploadés
- Gestion des projets archivés (visibilité dans le calendrier général ou non)

## 7. Instruction pour Claude Code
Avant toute implémentation, lire le fichier markdown de branding déjà présent dans ce dossier de travail (logo, couleurs, typographie de l'entreprise) et l'appliquer à l'ensemble du thème de l'application (UI, splash screen PWA, favicon, palette de labels de projet).
