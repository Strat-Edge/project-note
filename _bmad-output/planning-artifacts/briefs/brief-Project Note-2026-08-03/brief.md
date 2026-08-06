---
title: "Product Brief: Application de gestion de projets personnelle"
status: draft
created: 2026-08-03
updated: 2026-08-03
---

# Product Brief: Application de gestion de projets personnelle

## Executive Summary

Guillaume pilote une dizaine de projets professionnels en parallèle chez Strat'Edge — amélioration d'entreprise, développement d'outils, formations — et les idées lui viennent en continu, y compris hors du bureau. Aujourd'hui, il compense avec sa mémoire et des notes éparpillées dans l'app native de son téléphone, sans garantie de les retrouver ni de les rattacher au bon projet.

Ce projet est une PWA mono-utilisateur, installée sur téléphone et ordinateur, construite autour d'un geste unique : un bouton "+" qui demande d'abord le projet concerné, puis permet de capturer en quelques secondes une note (texte ou vocale), une tâche, ou un document — connecté ou non. Chaque projet centralise ainsi tout ce qui lui appartient dans une liste chronologique claire (provenance, statut nouveau, priorité), et un calendrier général agrège les échéances tous projets confondus.

Au-delà de l'usage personnel, l'outil sert aussi de vitrine : construit sur mesure aux couleurs de Strat'Edge, il devient une preuve concrète de savoir-faire face aux clients à qui l'entreprise vend justement de l'organisation et de la création d'outils. V1 reste volontairement resserré — classement manuel, priorité manuelle, pas d'intelligence artificielle de synthèse — pour livrer vite une base fiable, quitte à enrichir plus tard une fois l'usage réel éprouvé.

## The Problem

Guillaume mène une dizaine de projets professionnels en parallèle — amélioration d'entreprise, développement d'outils, formations, développement de l'entreprise elle-même. Il pense en continu, y compris hors du bureau : le soir, en déplacement, à n'importe quel moment. Ces idées, tâches ou rendez-vous à noter naissent au mauvais moment pour être traités immédiatement.

Aujourd'hui, il compense avec sa mémoire et des notes éparpillées dans l'app native de son téléphone. Deux failles : (1) rien ne garantit qu'il se souvienne d'avoir pris une note pour aller la relire, et (2) même relue, une note n'est pas rattachée à un projet ni structurée dans le temps — impossible de reprendre le fil proprement en arrivant au bureau. Le coût réel n'est pas la perte d'idées ponctuelles, mais le temps et l'énergie mentale dépensés à essayer de tout retenir, et les idées de développement d'entreprise qui n'aboutissent jamais faute d'un endroit où les laisser mûrir puis les reprendre.

## The Solution

Une PWA mono-utilisateur, installée sur téléphone et ordinateur, avec un seul geste de capture au centre de l'expérience : un bouton "+" toujours accessible qui demande d'abord le projet concerné, puis laisse Guillaume déposer ce qu'il a en tête — note texte, note vocale, tâche avec échéance/rappel/priorité, ou document — en quelques secondes, connecté ou non. Chaque projet regroupe ainsi tout ce qui lui appartient (tâches, notes, documents) dans une liste chronologique unique, avec pour chaque élément un indicateur de provenance (téléphone/ordinateur) et un badge "nouveau" tant qu'il n'a pas été consulté. Une vue calendrier générale agrège en parallèle les échéances tous projets confondus, filtrable par projet et codée par couleur.

Le tout fonctionne hors ligne par défaut (queue de synchronisation locale) et se synchronise automatiquement dès que le réseau revient, pour que la capture ne soit jamais bloquée par une connexion absente. En arrivant au bureau, Guillaume retrouve ainsi, projet par projet, tout ce qui a émergé en dehors — ordonné dans le temps, repérable au premier coup d'œil, prêt à être repris.

## What Makes This Different

Ce n'est pas une différenciation technique : la combinaison "notes + tâches + projets + calendrier" existe déjà, partiellement, dans plusieurs outils du marché (Notion, Todoist, ClickUp...). Guillaume les a considérés et écartés pour deux raisons concrètes :

1. **Centralisation stricte** — refuser de jongler entre plusieurs outils et licences pour un besoin qui doit tenir en un seul geste, un seul endroit.
2. **L'outil est aussi une vitrine professionnelle** — Strat'Edge vend, entre autres, de l'organisation d'entreprise et de la création d'outils sur mesure. Un outil interne construit maison, aux couleurs de l'entreprise, devient une démonstration concrète de compétence face aux clients : "voici ce qu'on sait construire". Ce n'est pas un argument technique, mais un argument business assumé — le fait-maison a une valeur en soi, ici.

L'avantage réel n'est donc pas un moat produit, mais l'alignement total entre l'outil, le flux de travail réel de Guillaume, et l'image que Strat'Edge veut renvoyer à ses clients.

## Who This Serves

Un utilisateur unique : Guillaume, qui pilote une dizaine de projets professionnels simultanés au sein de Strat'Edge. Sa mémoire est un atout, pas une faiblesse : le problème n'est pas d'oublier une idée, mais de ne disposer d'aucun endroit unique, accessible partout, pour la déposer sur le moment et la retrouver ensuite structurée par projet. Succès pour lui : ne jamais perdre le fil, quel que soit le moment ou l'endroit où l'idée surgit.

## Success Criteria

- **Zéro idée perdue** : tout ce qui est capturé (texte, vocal, tâche, document) est retrouvable, à portée de main, quel que soit l'appareil utilisé pour le capturer ou pour le consulter.
- **Reprise sans effort** : en arrivant au bureau, Guillaume identifie en un coup d'œil ce qui a émergé en dehors — projet par projet, avec provenance et statut "nouveau" — sans avoir à chercher ni à se souvenir qu'une note existe.
- **Plus d'idées d'entreprise qui aboutissent** : le temps et l'énergie mentale auparavant consacrés à "essayer de tout retenir" sont réinvestis dans le tri et la mise en œuvre. Mesurer si ces idées aboutissent effectivement reste du ressort de Guillaume (suivi personnel) — pas une fonctionnalité de l'application.

## Scope

**Dans le périmètre V1 :**
- Capture rapide et universelle : bouton "+" → choix du projet → note (texte ou vocal), tâche (échéance/rappel/priorité), ou document
- Fonctionnement hors ligne complet, avec synchronisation automatique au retour du réseau
- Vue projet en liste chronologique, avec indicateurs de provenance (téléphone/ordinateur) et de nouveauté
- Calendrier général agrégeant les échéances, filtrable et coloré par projet
- Transcription vocale à la demande (Whisper), sans traitement automatique au-delà
- Notifications push sur les rappels de tâches
- PWA installable (mobile et desktop), mono-utilisateur, authentification simple email/mot de passe

**Explicitement hors périmètre V1 :**
- Assistant IA de synthèse/restructuration des notes confuses (voir addendum — piste V2)
- Multi-utilisateurs, partage de projets, édition collaborative
- Intégration calendrier tiers (Google, Outlook)
- Application native iOS/Android
- Rapports/statistiques avancées ou suivi de performance business (le succès se mesure par Guillaume lui-même, pas par l'app)

## Vision

Dans deux ou trois ans, cet outil est devenu invisible : Guillaume ne se demande plus où mettre une idée, il capture et elle est au bon endroit. Le nombre de projets simultanés a pu croître au-delà de la dizaine actuelle sans que la charge mentale associée n'augmente. L'app a aussi pris, sans que ce soit son objectif initial, une place dans le discours commercial de Strat'Edge : c'est l'outil qu'on montre en rendez-vous client comme preuve vivante de ce que l'entreprise sait construire.

Si le besoin s'en fait sentir à l'usage, une couche d'assistance plus active (synthèse et restructuration des notes vocales, classement suggéré — voir addendum) pourra s'ajouter par-dessus la base solide posée en V1, sans jamais devenir un produit vendu à des tiers, ce qui reste hors de propos pour ce projet.
