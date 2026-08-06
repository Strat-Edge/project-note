# Réconciliation spec technique ↔ PRD

Comparaison exhaustive de `spec-app-gestion-projets.md` (spec technique initiale) et `prd.md` (PRD, même dossier). Objectif : identifier toute exigence, contrainte ou détail de modèle de données présent dans la spec et absent du PRD (ni FR, ni Non-Goal, ni Open Question, ni Assumption). Les choix de stack technique (Next.js, Supabase, Dexie, Vercel, Whisper, VAPID) sont volontairement exclus — hors périmètre du PRD par conception.

## Gap 1 — Section "Tâches" (4.3) absente du PRD (le plus significatif)

Le PRD référence explicitement "détaillé dans les features 4.3-4.5" (§4.1, ligne 98), et la numérotation des FR saute de **FR-9** (fin de §4.2 Gestion des projets) à **FR-15** (début de §4.4 Notes). Les FR-10 à FR-14, ainsi que toute une section 4.3 "Tâches", n'existent nulle part dans le document. Seule trace : une ligne dans le §6.1 MVP Scope ("Tâches (échéance, rappel, priorité, statut)") et une définition au Glossaire.

Contenu de la spec (§5.3 "Tâches") qui n'a donc aucun FR, Consequence ou NFR correspondant :
- Création rapide d'une tâche : titre + échéance optionnelle + rappel optionnel (aucune FR équivalente à FR-1/FR-2/FR-3 pour les autres types de contenu)
- Comportement explicite : "Une tâche avec échéance apparaît automatiquement dans le calendrier général" — seulement déductible indirectement de la définition du Glossaire "Calendrier général", jamais énoncé comme exigence testable côté Tâche
- "Un rappel programmé déclenche une notification push à l'heure définie" — partiellement couvert côté notification (FR-35) mais pas côté création/édition de la tâche elle-même
- Comment le statut (à faire / en cours / terminé) est modifié par l'utilisateur — aucune FR ne décrit le changement de statut d'une tâche
- Édition d'une tâche après création (titre, échéance, rappel, statut) — absente

C'est la lacune la plus importante : une des trois fonctionnalités centrales de l'app (Tâches, aux côtés de Notes et Documents) n'a pas été traduite en exigences fonctionnelles, alors que Notes (§4.4) et Documents (§4.5) l'ont été en détail.

## Gap 2 — Branding / charte graphique : quasi absent du PRD

La spec est explicite et redondante sur ce point (§1 Vision ET §7, dédiée entièrement à cette instruction) :
> "Claude Code doit lire ce fichier [branding .md] avant toute implémentation UI et l'appliquer à l'ensemble de l'application (thème, palette de couleurs des labels de projet, logo dans le header/splash screen PWA)."
> §7 ajoute : favicon également concerné.

Dans le PRD, seules deux traces légères existent :
- Vision (§1) : "construite sur mesure aux couleurs de Strat'Edge" — une phrase de contexte/motivation, pas une exigence
- FR-6 (Consequences) : "La couleur est assignée automatiquement par rotation dans la palette de marque Strat'Edge" — ne couvre que la couleur des projets, pas le thème global

Ce qui manque totalement (ni FR, ni Non-Goal, ni Assumption, ni Open Question) :
- Obligation de lire le fichier de branding avant toute implémentation UI
- Application du logo dans le header et le splash screen PWA
- Favicon aux couleurs/logo de la marque
- Thème global de l'application (pas seulement la palette de couleurs des labels de projet)

De plus, le §6 de la spec liste explicitement "Palette exacte des couleurs de projet → lire le fichier de branding déjà présent" comme point à affiner — ce point n'a **pas** été repris dans les Open Questions du PRD (§8), alors que les deux autres points du même §6 de la spec (taille max fichier, intitulés des onglets) y figurent bien (Open Questions #2 et #3).

Recommandation : ajouter au minimum une FR ou une NFR "Application de la charte graphique" (lecture du fichier de branding, application au thème/logo/splash/favicon), et indexer la question de la palette exacte en Open Question, comme pour les deux autres points du §6.

## Gap 3 — Champ `description` de Task non représenté

Le modèle de données de la spec (§4) donne à `Task` un champ `description` distinct de `title`. Le Glossaire du PRD (§3) définit la Tâche par "échéance optionnelle, rappel optionnel, priorité, et statut" — sans mentionner de description. Comme la section FR "Tâches" est entièrement absente (Gap 1), rien ne confirme si une tâche doit supporter un texte libre de description au-delà du titre. À vérifier/trancher lors de la complétion du Gap 1.

## Gap 4 — Flux d'authentification non traduit en FR

La spec (§3) justifie explicitement le choix email/mot de passe par un motif fonctionnel : "Documents sensibles → pas de magic link, sécurité standard." Le PRD mentionne l'authentification email/mot de passe uniquement comme une ligne du MVP Scope (§6.1 : "Authentification email/mot de passe"), sans FR dédiée, sans Consequences, sans critère testable (écran de connexion, déconnexion, persistance de session, exigences de mot de passe). Contrairement aux autres capacités du MVP Scope, celle-ci n'a aucune traduction fonctionnelle en amont dans la section 4 "Features".

## Points vérifiés sans écart notable

Pour référence, les éléments suivants de la spec sont correctement représentés dans le PRD et ne sont pas des gaps :
- Portée V1 / Hors scope V1 (§2 spec) ↔ Non-Goals (§5 PRD) : correspondance complète
- Modèle de données Project, Note, Document, Calendrier général (§4 spec) ↔ Glossaire + FR correspondantes : correspondance complète
- Onglet général / calendrier, sélection-création de projet, archivage (§5.1, 5.2 spec) ↔ FR-6 à FR-9, FR-27 à FR-31 : correspondance complète, PRD ajoute même des précisions (ex. FR-8/FR-31 tranchent un point que la spec §6 laissait ouvert : visibilité des projets archivés dans le calendrier)
- Notes texte/vocale + transcription à la demande (§5.3 spec) ↔ FR-15 à FR-17 : correspondance complète
- Documents (§5.3 spec) ↔ FR-18 à FR-21 : correspondance complète
- Mode hors-ligne (§5.4 spec) ↔ FR-32 à FR-34 : correspondance complète (PRD est même plus détaillé : 3 états de sync au lieu de 2)
- Notifications (§5.5 spec, y compris le risque iOS §3) ↔ FR-35 à FR-37 : correspondance complète
- Intitulés des onglets et taille max de fichier (§6 spec, 2 des 3 points) ↔ Open Questions #3 et #2 du PRD : correspondance complète

## Résumé

| # | Gap | Sévérité |
|---|---|---|
| 1 | Section Tâches (4.3, FR-10–FR-14) entièrement absente du PRD | Élevée |
| 2 | Branding/charte graphique (§1, §7 spec) quasi absent — pas de FR sur lecture du fichier, logo, splash screen, favicon, thème global ; palette non indexée en Open Question | Élevée |
| 3 | Champ `description` de Task non confirmé (conséquence du Gap 1) | Moyenne |
| 4 | Authentification email/mot de passe non traduite en FR (seulement listée en MVP Scope) | Moyenne |
