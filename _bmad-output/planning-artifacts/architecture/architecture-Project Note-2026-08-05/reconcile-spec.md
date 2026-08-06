# Réconciliation Spec ↔ Architecture Spine — Stack & AD-8

**Sources comparées :**
- `spec-app-gestion-projets.md` (§3 Stack technique, §4 modèle de données, note de risque iOS)
- `ARCHITECTURE-SPINE.md` (section Stack, AD-1 à AD-9, Structural Seed, Deferred)

## Méthode

Vérification point par point des 8 engagements de la spec §3 (Next.js, Serwist, Dexie, Supabase projet dédié, Render, auth email/mdp sans magic link, VAPID, gpt-transcribe, Storage buckets séparés) contre la section **Stack** et **AD-8 [ADOPTED]** de la spine, puis vérification séparée du risque iOS push-token (§3) et de la séparation des buckets (§3).

## Résultat point par point

| Engagement spec §3 | Section Stack (spine) | AD-8 (spine) | Statut |
|---|---|---|---|
| Next.js App Router | ✅ ligne dédiée, version épinglée | ✅ cité explicitement | OK |
| Serwist | ✅ `@serwist/next` versionné | ✅ cité explicitement | OK |
| Dexie.js | ✅ versionné | ✅ cité explicitement | OK |
| Supabase — projet dédié séparé | ✅ (implicite via `@supabase/supabase-js` + tableau Déploiement) | ✅ "projet dédié, séparé de toute autre infra" | OK |
| Render hosting | ✅ ligne dédiée | ❌ absent d'AD-8 | Couvert ailleurs — **AD-7** est la clause ADOPTED-équivalente dédiée à Render/Vercel. Pas un vrai trou, mais AD-8 n'est donc pas la liste exhaustive que son "Prevents" laisse penser. |
| Auth email/mdp, pas de magic link | — (pas dans le tableau Stack, normal) | ❌ absent d'AD-8 | Couvert ailleurs — **AD-9** est la clause ADOPTED dédiée. Pas un vrai trou. |
| VAPID push | ✅ `web-push` versionné | ✅ "notifications via Web Push API (VAPID)" | OK |
| **gpt-transcribe** | ✅ ligne dédiée, avec justification whisper-1→gpt-transcribe | ❌ **absent d'AD-8**, et absent de toute autre clause AD dédiée (AD-6 ne mentionne que génériquement "l'API OpenAI (transcription)") | **GAP** — voir ci-dessous |
| **Buckets séparés (documents, audio)** | ❌ absent — le tableau Stack ne mentionne que "Supabase Storage" générique | ❌ absent d'AD-8 | **GAP** — voir ci-dessous, et absent de toute la spine (AD-4, AD-5, Déploiement, ERD, Deferred inclus) |

## Gaps confirmés

### Gap 1 — `gpt-transcribe` n'est pas verrouillé comme décision de base dans AD-8

La section **Stack** de la spine capture correctement le choix (`gpt-transcribe`, avec la note de remplacement de `whisper-1`). Mais **AD-8**, dont le rôle explicite est d'être la liste des "Choix technique de base [ADOPTED]" qui "ne sont pas rouverts par cette architecture", omet totalement le choix du fournisseur/modèle de transcription. Son clause "Prevents" dit vouloir empêcher "l'introduction d'une stack alternative non alignée avec la spec technique initiale" — mais telle qu'écrite, AD-8 ne verrouille que Next.js/Dexie/Supabase/Serwist/VAPID. Rien n'empêche architecturalement (au niveau des invariants nommés) de substituer un autre fournisseur de transcription sans violer explicitement une règle ADOPTED, contrairement à Render (AD-7) et à l'auth (AD-9) qui ont chacun leur propre clause ADOPTED dédiée.

**Recommandation :** soit ajouter "transcription via OpenAI `gpt-transcribe`" à la liste AD-8, soit créer une clause ADOPTED dédiée équivalente à AD-7/AD-9 (ex. "AD-10 — Transcription vocale via OpenAI gpt-transcribe [ADOPTED]").

### Gap 2 — Séparation des buckets Supabase Storage (documents / audio) absente de toute la spine

La spec §3 est explicite : *"Buckets séparés : documents, audio"*. Cette exigence n'apparaît **nulle part** dans la spine :
- Pas dans le tableau **Stack** (qui ne mentionne que `@supabase/supabase-js` générique, aucune ligne Storage).
- Pas dans **AD-8** (qui ne cite que "Supabase (Postgres + Auth + Storage)" sans détail de bucket).
- Pas dans **AD-4** (RLS) — alors que la séparation des buckets a une incidence directe sur les policies RLS/Storage (une policy par bucket, potentiellement des règles de taille ou de type MIME différentes par bucket).
- Pas dans **AD-5** (stockage offline des fichiers) — qui parle de blobs génériques "audio de note vocale, fichiers document" mais ne dit pas s'ils atterrissent dans des buckets distincts côté remote.
- Pas dans le diagramme de conteneurs (un seul nœud `Storage` non détaillé).
- Pas dans **Deferred** — qui defer le *palier tarifaire* du plan Storage, mais pas la structure des buckets elle-même.

**Recommandation :** ajouter explicitement la séparation `documents` / `audio` en buckets distincts, a minima dans AD-4 (policy RLS par bucket) et/ou AD-5, et refléter le detail dans le tableau Stack ou dans Déploiement & environnements.

### Gap 3 — Risque iOS push-token (§3) : aucune réponse architecturale, même pas en Deferred

La spec contient une note de risque explicite adressée à Claude Code : *"Le token de notification peut expirer/se réinitialiser plus souvent que sur Android natif — prévoir une gestion de ré-enregistrement du token silencieuse."*

Recherche exhaustive dans la spine (mots-clés : iOS, token, ré-enregistrement, silencieuse, expir) :
- **AD-5** mentionne "iOS" mais uniquement dans le contexte de l'éviction du stockage navigateur pour les blobs (audio/document) — un risque différent, sans lien avec le renouvellement de token push.
- **AD-6** et **AD-7** couvrent l'envoi de notifications push (VAPID, Cron) mais ne traitent à aucun moment du cycle de vie du token côté client (souscription, expiration, ré-enregistrement).
- La capability map (4.9 Notifications push — FR-36 à FR-38) renvoie à AD-6/AD-7, qui ne couvrent pas ce risque.
- La section **Deferred** liste 4 éléments explicitement différés (schéma Dexie, colonnes Supabase, copie UI conflit, palier Storage) — la gestion de ré-enregistrement du token push iOS n'y figure pas, alors que c'est exactement le type de détail qu'on attendrait en Deferred si l'architecture ne voulait pas le figer maintenant.

**Conclusion :** ce risque n'a ni réponse architecturale (aucune règle AD ne l'adresse) ni reconnaissance explicite en Deferred. C'est un oubli, pas un report assumé.

**Recommandation :** au minimum, ajouter une entrée en Deferred reconnaissant le risque et renvoyant sa résolution au code (ex. "Stratégie de ré-enregistrement silencieux du token push iOS — le service worker doit détecter une `pushsubscriptionchange` / échec d'envoi et re-souscrire sans intervention utilisateur ; mécanisme exact laissé au code"). Idéalement, l'ancrer dans AD-6 ou AD-7 (qui gouvernent déjà 4.9 Notifications push) puisque c'est un risque connu et nommé par la spec, pas un détail d'implémentation neutre.

## Synthèse

| # | Item | Statut |
|---|---|---|
| 1 | gpt-transcribe absent d'AD-8 (présent en Stack, non verrouillé comme décision de base) | GAP — mineur/moyen |
| 2 | Séparation buckets documents/audio absente de toute la spine | GAP — moyen (impact RLS/AD-4) |
| 3 | Risque iOS push-token : aucune réponse architecturale ni mention en Deferred | GAP — moyen (risque explicitement signalé par la spec à l'attention de Claude Code, silencieusement perdu) |

Aucune contradiction directe (rien dans la spine ne va à l'encontre de la spec) — les trois points ci-dessus sont des **omissions silencieuses**, pas des divergences actives. Next.js, Serwist, Dexie, Supabase (projet dédié), Render, auth email/mdp sans magic link, et VAPID sont tous correctement et explicitement reflétés (via Stack + AD-7/AD-8/AD-9 combinés).
