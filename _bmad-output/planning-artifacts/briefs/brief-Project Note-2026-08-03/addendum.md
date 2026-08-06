---
title: "Addendum — Application de gestion de projets personnelle"
status: draft
created: 2026-08-03
updated: 2026-08-03
---

# Addendum

Contenu utile pour la PRD / l'architecture, trop détaillé pour rester dans le brief.

## Mécaniques de capture — détails pour la vue projet

Ces éléments affinent le modèle de données esquissé dans `spec-app-gestion-projets.md` (§4) :

- **Provenance de l'élément** : chaque note/tâche/document capturé devrait porter une indication de l'appareil source (téléphone vs. ordinateur), affichée dans la liste chronologique du projet.
- **Statut "nouveau"** : un élément capturé hors bureau (ou plus généralement, pas encore vu/traité) doit porter un badge visuel distinct (ex. point rouge) jusqu'à ce que l'utilisateur l'ait vu/traité. Sert de repère au moment de la "reprise" en arrivant au bureau.
- **Priorité/urgence (V1)** : champ manuel, jamais détecté automatiquement. Saisissable soit au moment de la capture (flux "+"), soit après coup en modification. Influence l'affichage/tri dans la vue projet et potentiellement le calendrier général — à spécifier précisément en PRD (niveaux exacts, comportement de tri).

## Enjeu de branding — au-delà de la préférence esthétique

L'application sert aussi de vitrine professionnelle : Guillaume vend à ses clients (en plus des formations) des services d'organisation d'entreprise et de création d'outils sur mesure, et compte montrer cette app, construite maison, comme preuve concrète de compétence.

- **Conséquence** : la fidélité stricte à la charte graphique Strat'Edge (`Strat'Edge/Branding/couleurs.md` + logos) — déjà demandée en §1/§7 de la spec technique — n'est pas une simple préférence esthétique mais un enjeu de crédibilité commerciale.
- **Pour la PRD/architecture** : à traiter comme une exigence de premier ordre, pas comme un item de polish de fin de projet.

## Fonctionnalités repoussées post-V1 — à ne pas oublier, pas à construire maintenant

- **Assistant IA de synthèse/restructuration** : à la capture d'idées "en vrac" (notamment vocales), une IA qui nettoierait, renommerait et proposerait une structuration des notes confuses, quitte à poser des questions de clarification à l'utilisateur. Explicitement repoussé au-delà de V1 — voir `.memlog.md` pour le raisonnement complet. À reconsidérer une fois la brique capture + classement manuel + calendrier éprouvée à l'usage.
