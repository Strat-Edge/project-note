---
title: "Réconciliation Addendum ↔ PRD"
status: draft
created: 2026-08-03
---

# Réconciliation Addendum (brief) ↔ PRD

Analyse point par point de `addendum.md` contre `prd.md`, pour identifier tout élément substantiel de l'addendum qui n'est représenté nulle part dans le PRD (ni FR, ni Non-Goal, ni Open Question, ni Assumption).

## 1. Mécaniques de capture — détails modèle de données

### 1.1 Provenance de l'élément
**Statut : couvert.**
- Glossaire §3 : "Provenance — Appareil (téléphone ou ordinateur) depuis lequel un élément a été capturé."
- FR-24 "Indicateur de provenance" (§4.6).
- Illustré dans UJ-2.

### 1.2 Statut "nouveau"
**Statut : couvert.**
- Glossaire §3 : "Statut 'nouveau'".
- FR-25 "Statut 'nouveau'" (§4.6), avec condition de disparition du badge.
- Illustré dans UJ-2.

Nuance mineure (non bloquante) : l'addendum définit le déclencheur comme "pas encore vu/traité", alors que FR-25 ne couvre que "dès que l'utilisateur ouvre/consulte l'élément". La notion de "traité" (au-delà de simplement "vu") n'est pas explicitement reprise. Écart mineur, probablement sans conséquence produit, mais à noter si "traité" devait un jour désigner un état distinct de "consulté" (ex. un item classé/complété sans avoir été ouvert).

### 1.3 Priorité (V1) — champ manuel
**Statut : partiellement couvert — GAP identifié.**

Couvert :
- Glossaire §3 : "Priorité — ... assignée manuellement ... Jamais détecté automatiquement."
- FR-3 (§4.1) : sélection de priorité au moment de la capture, champ manuel, modifiable après coup, s'applique aux 3 types (note/tâche/document) — reprend explicitement l'extension du modèle de données par rapport à la spec technique initiale.
- FR-23, FR-26 (§4.6) : tri "Prioritaire" combinable dans la vue projet, affichage visuel de la priorité.
- Open Question #1 : niveaux exacts de priorité.

**Gap :** l'addendum précise explicitement que la priorité "Influence l'affichage/tri dans la vue projet **et potentiellement le calendrier général** — à spécifier précisément en PRD". Le PRD traite bien l'influence sur la vue projet (FR-23, FR-26), mais la section Calendrier général (§4.7, FR-27 à FR-31) ne mentionne la priorité nulle part — ni comme critère d'affichage, ni comme critère de tri/filtre, ni même comme question ouverte à trancher. Ce point demandait explicitement une décision en PRD ("à spécifier précisément") et n'apparaît dans aucune des quatre catégories (FR / Non-Goal / Open Question / Assumption).

→ Recommandation : ajouter soit un FR au §4.7 précisant si/comment la priorité influence l'affichage du calendrier général, soit — a minima — une Open Question explicite en §8 si la décision est repoussée.

## 2. Enjeu de branding — crédibilité commerciale

**Statut : partiellement couvert — GAP identifié.**

Couvert (niveau narratif) :
- Vision (§1) : "elle démontre concrètement, face aux clients, le savoir-faire que l'entreprise vend en organisation et en création d'outils."
- JTBD sociaux/contextuels (§2.1) : "Pouvoir sortir, en rendez-vous client, un outil interne construit sur mesure — preuve concrète du savoir-faire Strat'Edge."
- FR-6 (§4.2) : couleur de projet assignée par rotation "dans la palette de marque Strat'Edge" — mais ceci concerne la couleur des *projets*, pas la fidélité globale de l'interface à la charte graphique.

**Gap :** l'addendum est explicite sur deux points qui ne sont pas repris :
1. La fidélité stricte à la charte graphique Strat'Edge (`Strat'Edge/Branding/couleurs.md` + logos) est nommément identifiée comme référence ("déjà demandée en §1/§7 de la spec technique").
2. L'addendum demande que ce point soit "traité comme une exigence de premier ordre, pas comme un item de polish de fin de projet" — c'est-à-dire élevé au rang d'exigence testable (FR ou NFR), pas seulement de motivation narrative en Vision/JTBD.

Le PRD ne contient aucun FR ni NFR imposant la conformité de l'UI (couleurs, logos, typographie) à la charte graphique Strat'Edge en tant qu'exigence produit vérifiable. La seule occurrence chiffrée (FR-6) est un cas d'usage étroit (couleur auto-assignée aux projets), pas une exigence de conformité globale de l'interface à la charte. Le risque, tel que l'addendum le formule, est que ce point retombe au rang de "polish de fin de projet" faute d'être ancré comme exigence explicite.

→ Recommandation : ajouter un FR/NFR (probablement en §4 sous une feature "Branding / Identité visuelle", ou en NFR transverse) exigeant explicitement la conformité de l'interface à `couleurs.md` et aux logos Strat'Edge, avec un statut de priorité élevé (pas repoussable en fin de projet).

## 3. Assistant IA de synthèse/restructuration (V2)

**Statut : couvert.**
- Non-Goals §5, dernier item : "Pas d'assistant IA de synthèse/restructuration des notes confuses en V1 (nettoyage, renommage automatique) — piste explicitement repoussée en V2, voir addendum du brief."
- Repris en §6.2 Out of Scope for MVP : "Assistant IA de synthèse/restructuration des notes — différé, piste V2 confirmée."

C'est exactement le traitement demandé par l'addendum ("à ne pas oublier, pas à construire maintenant", "explicitement repoussé au-delà de V1"). Aucun gap.

## Résumé des gaps

| # | Point de l'addendum | Représenté en PRD ? | Catégorie manquante |
|---|---|---|---|
| 1 | Priorité — influence potentielle sur le calendrier général | Non | FR ou Open Question (§4.7 / §8) |
| 2 | Fidélité à la charte graphique Strat'Edge comme exigence de premier ordre (pas juste narratif) | Non (seulement en Vision/JTBD, pas en FR/NFR testable) | FR/NFR dédié |

Les deux autres points de l'addendum (provenance, statut "nouveau", assistant IA V2) sont correctement représentés dans le PRD.
