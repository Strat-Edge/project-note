---
title: Réconciliation PRD ↔ UX Spine
status: draft
created: 2026-08-04
scope: PRD FR-1 à FR-39 vs DESIGN.md + EXPERIENCE.md (ux-Project Note-2026-08-03)
---

# Réconciliation PRD ↔ UX Spine

Méthode : chaque FR du PRD (`prd.md`) a été confronté à `DESIGN.md` (composants/visuel) et `EXPERIENCE.md` (IA, flows, state patterns, component patterns) pour vérifier l'existence d'un écran, composant, état, ou beat de flow nommé qui le couvre. Le détail tech-stack (Supabase, Dexie, Whisper API, VAPID...) est hors périmètre par construction — seul le manque de **surface UX** est signalé.

## Résumé

- **7 FR sans surface UX identifiable** (gap dur — un développeur travaillant uniquement à partir de la spine ne saurait pas construire l'écran/contrôle) : **FR-9, FR-12, FR-20, FR-21, FR-32, FR-36, FR-37**.
- **8 FR à couverture partielle/faible** (l'essentiel est couvert mais un détail testable de la Consequence manque) : FR-2, FR-6, FR-8, FR-10, FR-17, FR-18, FR-19, FR-30.
- **FR-38** est délibérément sans surface UX (comportement silencieux côté device token) — normal, pas un gap.
- **Aucun conflit matériel** (cardinalité ou état par défaut contredit) n'a été trouvé entre le PRD et l'UX spine sur les FR qui ont une surface. Un point d'ambiguïté structurelle est signalé sous FR-2 (ce n'est pas une contradiction, plutôt un trou de mécanisme).

---

## 1. Gaps durs — aucune surface UX

### FR-9 — Désarchivage d'un projet
Aucune mention de "désarchiver" dans `DESIGN.md` ni `EXPERIENCE.md` (recherche du terme : zéro occurrence). `EXPERIENCE.md` décrit uniquement l'état "Projet archivé" (retiré du sélecteur + calendrier, réapparition via le filtre "afficher les projets archivés" du **calendrier**) — ce filtre est une visibilité temporaire dans le calendrier, pas l'action permanente de FR-9 qui restaure le statut actif du projet. Il n'existe même pas d'écran "détail projet" dans la table IA (`Connexion / Général / Projets / Vue projet / Détail d'élément / Capture "+"`) où loger un bouton "Désarchiver". Un développeur ne saurait pas où placer ce contrôle.

### FR-12 — Rappel déclenchant une notification (mécanisme de saisie du rappel)
Le mot "rappel" n'apparaît nulle part dans `DESIGN.md` ni `EXPERIENCE.md`. Aucun champ, contrôle, ou state pattern ne montre comment l'utilisateur définit `reminder_at` sur une tâche (le Flow 3 ne montre que titre + échéance). Puisque FR-10 dit "rappel optionnel, nécessite une échéance", il devrait exister un contrôle conditionnel dans le formulaire tâche — absent de la spine.

### FR-20 — Téléchargement d'un document
Aucune mention d'un bouton/action "télécharger" dans les deux documents. Le rôle "Détail d'élément" dans la table IA dit seulement "Consultation/édition" — ne couvre pas explicitement une action de téléchargement vers l'appareil.

### FR-21 — Suppression d'un document
Idem : aucune mention d'un contrôle de suppression (document ou autre type de contenu) dans `EXPERIENCE.md`/`DESIGN.md`. "Consultation/édition" du Détail d'élément ne mentionne pas de suppression, alors que le PRD précise "la suppression est définitive" — un point qui mériterait normalement une confirmation UX (absente).

### FR-32 — Affichage visuel de la priorité dans le calendrier général
`DESIGN.md`/`EXPERIENCE.md` couvrent le code couleur par projet dans le calendrier (FR-29, Flow 3 climax) mais aucun indicateur de priorité sur les items du calendrier n'est décrit — ni composant, ni state pattern, ni mention dans "Component Patterns"/"State Patterns". Le PRD exige pourtant un indicateur visuel de priorité distinct du positionnement par date.

### FR-36 — Déclenchement sur rappel (notification push)
Aucune section de `EXPERIENCE.md` ne traite des notifications (recherche "notification" : zéro occurrence hors du présent document). Pas d'état "notification reçue", pas de composant de notification, pas de comportement décrit (l'app est fermée/en arrière-plan à ce moment — sujet absent de la spine).

### FR-37 — Contenu de la notification
Corollaire direct de FR-36 : aucune maquette ni description du contenu (titre tâche + nom projet) de la notification push.

---

## 2. Couverture partielle — l'essentiel est là, un détail testable manque

- **FR-2** (sélection projet obligatoire pour Note/Document, optionnelle pour Tâche) : le Stepper de capture est décrit comme un ordre fixe **Projet → Priorité → Type** (`EXPERIENCE.md`, Component Patterns + les deux Key Flows). Mais l'étape Projet a lieu *avant* que le Type soit connu (étape 3) — aucun flow, state, ni composant ne montre comment/quand l'utilisateur "passe" l'étape Projet pour créer une tâche générale. Ni les deux Key Flows (qui choisissent toujours un projet), ni le tableau Component Patterns ne mentionnent un bouton "Passer" ou un mécanisme de bascule. Le résultat (liste "projets actifs en premier" dans le sélecteur de capture, cf. FR-2 Consequence) n'est également pas repris dans la spine — seule la liste de l'écran "Projets" (FR-7) le précise.
- **FR-6** (création de projet — nom, description, couleur avec rotation automatique) : la table IA ne mentionne qu'un lien "accès création" sur l'écran Projets/Général, sans écran ni champs nommés. La logique de rotation automatique de couleur (Consequence testable de FR-6) n'apparaît dans aucun des deux documents.
- **FR-8** (archivage) : l'état résultant est bien décrit (retiré du sélecteur + calendrier par défaut), mais le déclencheur lui-même — un bouton/action "Archiver" sur un écran de détail projet — n'est nommé nulle part (il n'existe pas d'écran "détail projet" dans la table IA).
- **FR-10** (création tâche) : titre et échéance sont couverts (Flow 3), mais description et rappel (les deux champs optionnels restants du FR) n'apparaissent dans aucun composant ou flow.
- **FR-17** (transcription à la demande) : le state pattern "Note vocale sans transcription" décrit le résultat ("audio seul" vs "transcrit") mais aucun contrôle ("générer la transcription") n'est nommé pour déclencher l'action.
- **FR-18** (ajout de document — sélecteur fichier desktop / caméra-galerie mobile) : couvert seulement implicitement par l'étape "Type" du stepper de capture ; le mécanisme d'upload propre à chaque plateforme n'est pas détaillé.
- **FR-19** (liste des documents — nom, type, date d'ajout) : le pattern générique "Carte de tâche/note/document" (titre, priorité, provenance, échéance) ne mentionne pas les métadonnées spécifiques aux documents (type de fichier, taille).
- **FR-30** (accès rapide depuis le calendrier) : seule la moitié "créer un nouveau projet" est reprise ("accès rapide création de projet" sur l'écran Général) ; l'autre moitié du FR — "en sélectionner un existant directement depuis le calendrier" — n'est pas décrite comme point d'entrée.

## 3. Conflits matériels

Aucun trouvé. Points vérifiés spécifiquement et jugés cohérents :
- FR-3 (échelle priorité 3 niveaux Basse/Normale/Haute) ↔ `DESIGN.md` colors.priority-* : cohérent.
- FR-23 (Chronologique par défaut, comportement des filtres combinés) ↔ `EXPERIENCE.md` Filtres de tri : cohérent, y compris le cas "aucune case cochée".
- FR-27 (bascule mois/semaine manuelle) ↔ `EXPERIENCE.md` Responsive & Platform (mois par défaut desktop / semaine par défaut mobile étroit, bascule manuelle possible sur les deux) : le PRD est silencieux sur le défaut par plateforme, l'UX l'précise sans contredire — pas un conflit.
- FR-8/FR-31 (exclusion des projets archivés du calendrier, filtre explicite pour les réafficher) ↔ `EXPERIENCE.md` State Patterns "Projet archivé" : cohérent.
- FR-39 (email/mot de passe, pas de lien magique) ↔ `EXPERIENCE.md` "Non authentifié" : cohérent.
