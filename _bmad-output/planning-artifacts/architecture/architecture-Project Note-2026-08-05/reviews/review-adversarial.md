---
name: 'Revue adversariale — Architecture Spine Project Note'
type: review
target: ARCHITECTURE-SPINE.md
reviewer: adversarial-attack
date: 2026-08-05
verdict: 'FAIL — trous d''implémentabilité concrets, non de style'
---

# Revue adversariale — Architecture Spine "Project Note"

## Méthode

Je n'ai rien corrigé. Pour chaque AD ou convention, j'ai cherché une paire d'implémenteurs hypothétiques (deux stories, deux devs, deux epics) qui respectent *chacun le texte de la Rule à la lettre*, mais produisent des systèmes incompatibles au moment de l'intégration. Le critère de gravité : la divergence casse l'interopérabilité (formats sur le fil, propriété d'une entité, chemin de mutation), pas juste le style de code.

Verdict global : **la spine échoue sur son propre test de suffisance** ("assez pour empêcher l'incohérence, pas plus") à trois endroits précis : AD-3 (base de comparaison de conflit non définie), l'enveloppe de file de synchro (id/idempotence, delta vs snapshot, contenu de `fields` pour `delete` non définis), et une contradiction textuelle directe entre AD-3 et la Capability Map sur `Document.priority`. Le paradigme, AD-1/AD-2/AD-4/AD-6/AD-7/AD-8/AD-9 sont globalement solides ; AD-2 a un angle mort net sur les Server Components / Server Actions.

---

## 1. AD-3 — Résolution de conflit au niveau du champ : base de comparaison non définie

**Le trou.** La Rule dit : *"Un même champ modifié différemment sur deux appareils avant synchronisation bascule l'élément dans un état... conflit."* Elle ne dit jamais **par rapport à quoi** on juge que deux appareils ont "modifié différemment avant synchronisation". Un vrai détecteur de conflit a besoin d'une base commune (three-way merge : valeur de base + valeur locale + valeur distante, ou un vecteur de version) pour distinguer :
- un vrai conflit (deux appareils divergent depuis la même base, hors ligne, en parallèle) ;
- une simple séquence légitime (l'appareil B a déjà synchronisé sa modification, puis l'appareil A — qui travaillait sur une copie déjà obsolète — pousse la sienne plus tard).

L'enveloppe de synchro ne porte **aucun champ de base/version** (`base_updated_at`, `base_value`, ou compteur de version) — seulement `value` et `updated_at` par champ. Donc "différent" ne peut être défini que par une heuristique que chaque implémenteur invente lui-même.

**Paire concrète.**
- **Implémenteur A** (côté route handler serveur, avec transaction) : stocke un curseur `last_pulled_at` par appareil/entité, comparé côté serveur à l'`updated_at` stocké en base pour décider si la valeur serveur a changé *depuis que ce device l'a vue* → three-way réel. Ceci exige un champ supplémentaire non prévu par l'enveloppe documentée : la compatibilité de payload avec un client qui suit la Convention *au pied de la lettre* est rompue (le client B n'envoie pas ce curseur).
- **Implémenteur B** : compare naïvement `envelope.fields[x].updated_at` reçu à `field_updated_at` actuellement en base ; si les deux diffèrent et que les valeurs diffèrent → conflit, sinon la plus récente écrase silencieusement. C'est un two-way LWW déguisé en résolution "au niveau du champ" — il ne détecte **aucun** vrai conflit dans le cas très courant où deux devices ont modifié le même champ mais avec des horodatages non-identiques (il traite ça comme une séquence normale), alors que le texte d'AD-3 dit explicitement "aucun écrasement automatique".

Les deux lisent la Rule et l'implémentent correctement selon leur lecture. Résultat : A exige un champ hors-schéma que B ne fournira jamais ; B viole silencieusement "aucun écrasement automatique" dans le cas exact que AD-3 est censée couvrir. Aggravant : rien dans la spine ne mentionne la dérive d'horloge entre appareils (pas de NTP, pas d'horodatage serveur faisant autorité) — toute comparaison de `updated_at` clients est donc vulnérable à un décalage d'horloge non traité, sur les deux implémentations.

**Qui possède l'écriture de la valeur arbitrée ?** Angle mort connexe : après arbitrage manuel utilisateur ("une seule valeur persiste ensuite"), qui écrit cette valeur dans Dexie ? Consistency Conventions dit *"Toute mutation transite par domain/ — jamais un composant qui... appelle sync/ en le contournant"*. Mais AD-3 assigne toute la mécanique de conflit à `sync/`, qui a déjà un accès direct à `data/local/`. Deux implémenteurs légitimes :
- **A** : l'UI d'arbitrage (un composant) appelle `domain/resolveConflict(...)`, qui écrit dans Dexie — conforme à la convention "toute mutation via domain/".
- **B** : l'UI d'arbitrage appelle directement une fonction exportée de `sync/` pour finaliser l'écriture (puisque c'est `sync/` qui détient déjà les deux valeurs concurrentes et le mécanisme de conflit) — ce qui est *exactement* le contournement que la Convention interdit ("un composant qui... appelle sync/ en le contournant").
Aucune AD ni la Capability Map n'assigne explicitement la propriété de cette écriture finale. La feature "résolution de conflit" elle-même n'apparaît dans **aucune ligne** de la Capability → Architecture Map.

---

## 2. AD-2 — Direction de dépendance : angle mort Server Components / Server Actions

**Le trou.** La Rule énumère les points d'entrée serveur autorisés à importer `data/remote/` : *"route handlers `app/`, Render Cron... jamais depuis un bundle client"*. Or `app/` App Router contient aussi des **React Server Components** (`page.tsx`, `layout.tsx` sans `"use client"`) et des **Server Actions** (`"use server"`), qui s'exécutent côté serveur mais ne sont ni des route handlers ni du Cron. Le texte ne les nomme pas. Le test négatif donné ("jamais depuis un bundle client") est vrai pour un Server Component — il n'est jamais bundlé client — donc un lecteur littéral peut légitimement conclure qu'il est autorisé, alors qu'un lecteur qui s'ancre sur l'énumération positive ("route handlers, Cron") conclura le contraire.

**Paire concrète.**
- **Implémenteur A** lit l'énumération positive comme exhaustive : seuls les fichiers `route.ts` (et le Cron) touchent `data/remote/`. Les Server Components de `app/` (ex. `app/projects/[id]/page.tsx`) ne lisent que via `domain/` → `data/local/` (Dexie), cohérent avec le paradigme local-first (lecture immédiate, offline-safe).
- **Implémenteur B** lit le test négatif comme la vraie règle : "jamais depuis un bundle client" = tout code qui ne finit pas dans le bundle client est permis. Il fait un Server Component qui importe `data/remote/` directement pour un rendu serveur "frais" (évite le flash d'hydratation Dexie, meilleur SEO/perf perçue).

Conséquence réelle et pas cosmétique : sur la même page, A affiche systématiquement l'état Dexie (source de vérité locale, cohérent avec AD-1 et le paradigme), B affiche un état Supabase potentiellement **différent** de ce que Dexie contient localement (écritures locales non encore synchronisées invisibles au SSR de B) — deux pages du même produit, construites par deux équipes conformes chacune à AD-2, montrent des données divergentes pour la même entité selon qu'elle a été éditée hors-ligne récemment.

**Second angle mort, symétrique.** `components/` est dit ne dépendre "que de `domain/`" sans distinction serveur/client — mais Next.js encourage la colocation de Server Actions dans les mêmes fichiers/dossiers que les composants qui les utilisent. Une Server Action définie dans `components/project-form/actions.ts` (physiquement sous `components/`) et qui importe `data/remote/` viole AD-2 à la lettre, alors que la même logique posée dans `app/actions/projects.ts` (physiquement sous `app/`) est conforme — pour un code strictement identique à l'exécution. Deux équipes qui organisent leurs Server Actions différemment produisent une base soit conforme soit non conforme à AD-2 sans aucune différence de comportement runtime, ce qui signale que la règle est ancrée sur un critère de chemin de fichier plutôt que sur un critère d'exécution — fragile dès qu'un refactor de dossier a lieu.

---

## 3. Enveloppe de file de synchronisation — non byte-compatible entre deux implémentations

**Forme documentée** (Consistency Conventions) :
```
{ id: uuid, entity, entity_id: uuid, operation: 'create'|'update'|'delete',
  fields: { [nomChamp]: { value, updated_at: ISO8601 } },
  device_id: string, created_at: ISO8601, status: ... }
```

Quatre trous précis, chacun suffisant à casser l'interopérabilité entre deux implémentations conformes :

1. **`id` est-il une clé d'idempotence stable, ou un identifiant d'enveloppe re-généré à chaque tentative ?** Rien ne le dit. Si un push réseau time-out après traitement serveur mais avant réponse au client, le client retente. Implémenteur A régénère `id` à chaque tentative (lecture littérale : "id: uuid" comme "un uuid pour cette requête") → le serveur ne peut pas dédupliquer, l'opération peut s'appliquer deux fois. Implémenteur B garde le même `id` tant que `status != 'synced'` et le serveur déduplique dessus → idempotent. Les deux respectent le schéma déclaré ; un seul est correct en présence de coupures réseau — que la spine cite explicitement comme scénario à couvrir (AD-5, AD-7 zones offline). Rien dans la spine ne tranche.

2. **Contenu de `fields` pour `operation: 'update'` — delta ou snapshot complet ?** Non spécifié. A envoie uniquement les champs modifiés (payload minimal, correspond à l'esprit du "par champ"). B envoie systématiquement un snapshot de tous les champs éditables avec leurs `updated_at` respectifs (y compris ceux non touchés). Les deux respectent la forme `{ [nomChamp]: {value, updated_at} }`. Mais un serveur écrit pour consommer le style "delta" de A traitera à tort un `fields` complet de B comme si chaque champ présent avait été activement modifié sur ce device — risque de déclencher des faux conflits sur des champs que l'utilisateur n'a jamais touchés, si le serveur ne sait pas distinguer "champ présent car modifié" de "champ présent car snapshot complet".

3. **Contenu de `fields` pour `operation: 'delete'`.** Objet vide `{}` ? `null` ? Clé absente ? Un objet avec un pseudo-champ `deleted_at` ? Aucune des quatre options n'est exclue par le texte. Deux backends écrits contre deux suppositions différentes ne pourront pas interopérer si jamais l'app doit un jour parler à plus d'un client (ou si le schéma serveur est validé strictement, ex. JSON Schema avec `fields` requis non-vide).

4. **`entity_id` vs `id` pour une création.** Les ids sont uuid v4 générés côté client (implicite, jamais dit explicitement) pour permettre la création vraiment offline-first. Mais rien n'interdit à un implémenteur de confondre les deux : traiter l'`id` de l'enveloppe de création comme identique à `entity_id` (raisonnement : "c'est la même opération, un seul uuid suffit"), pendant qu'un autre les garde strictement distincts (id = identité de l'opération de queue, entity_id = identité permanente de l'entité). La confusion casse la dédup d'idempotence du point 1 dès qu'une même entité fait l'objet de plusieurs opérations (create puis update rapide avant confirmation serveur).

**Conclusion du stress-test envelope** : la forme donnée est précise sur les *noms de clés et leurs types primitifs*, mais totalement silencieuse sur la *sémantique* (delta vs snapshot, idempotence, contenu delete). Deux implémentations de `sync/` écrites indépendamment à partir de ce seul document ne produiraient **pas** des enveloppes byte-compatibles, et pire, un serveur écrit contre une supposition rejettera ou mal-interprétera silencieusement les enveloppes de l'autre.

**Bonus — reprise d'upload (AD-5).** *"Un upload interrompu... reprend depuis le dernier point réussi"* n'a nulle part où stocker un état de progression dans l'enveloppe déclarée (pas de `bytes_uploaded`, pas d'`upload_session_id`). Un implémenteur utilisant l'upload reprenable natif de Supabase Storage (protocole TUS, session côté objet Storage) et un autre bricolant un découpage manuel en chunks avec accusés de réception stockés dans Dexie produisent deux protocoles de reprise incompatibles, ni l'un ni l'autre représentable dans la forme d'enveloppe documentée.

---

## 4. Contradiction textuelle directe : AD-3 vs Capability Map sur `Document.priority`

C'est la trouvaille la plus grave car ce n'est pas une ambiguïté d'interprétation — **c'est une contradiction du texte avec lui-même.**

- **AD-3, ligne Binds** : *"FR-13, FR-14, FR-17, sync/, tout champ éditable après création (Task.status, **priority partagée Task/Note/Document**, Note.transcription, descriptions)"* — la résolution de conflit par champ s'applique explicitement à `priority` sur les trois entités, Document inclus.
- **Capability → Architecture Map, ligne "4.5 Documents — FR-18 à FR-21"** : *"Governed by: AD-5, AD-6"* — **AD-3 n'est pas listée.** Comparer à la ligne "4.3 Tâches" qui liste explicitement AD-3.

**Paire concrète.** Une équipe/story qui implémente la capability 4.3 (Tâches) lit la Capability Map, voit AD-3 listée, et construit `priority_updated_at` avec la mécanique complète de conflit pour `Task.priority`. Une équipe/story qui implémente la capability 4.5 (Documents) lit la même Capability Map, ne voit **pas** AD-3 listée pour sa ligne, et — raisonnablement, puisque son mandat documenté ne cite qu'AD-5 (blob offline) et AD-6 (appel serveur seul) — implémente `Document.priority` en simple écrasement à la synchronisation, sans métadonnée `priority_updated_at`, sans bannière de conflit. Les deux équipes sont chacune conformes au document qu'elles ont lu (la Map, pour l'une ; AD-3 elle-même, pour l'autre, si elle l'avait lue) — mais le même champ `priority`, censé être "partagé" selon l'ERD et AD-3, a maintenant deux implémentations de conflit incompatibles selon le type d'entité, et la moitié des Documents perdront silencieusement des modifications concurrentes de priorité — exactement le scénario qu'AD-3 dit vouloir empêcher ("Prevents: un écrasement silencieux").

---

## 5. "Deferred" qui cache un invariant réel : le schéma exact de la file de synchro

**Le texte Deferred dit** : *"Schéma exact Dexie/IndexedDB (tables, index) — job du code..., non figé par la spine."*

Ceci semble anodin (noms de tables, index de perf) mais cache en réalité un choix architectural qui détermine si l'enveloppe de synchro documentée (section 3 ci-dessus) est même *implémentable* de façon cohérente :

- **Implémenteur A** : la file de synchro est une table Dexie séparée, journal append-only d'enveloppes discrètes (`SyncQueue`), chaque ligne = une opération avec son `id` stable. Ceci rend possible l'idempotence de retry (`id` = clé de dédup, cf. point 3.1 plus haut).
- **Implémenteur B** : pas de table séparée — chaque entité (Task, Note...) porte directement des drapeaux "sale" par champ (`pendingFields: {status: {...}}`) ; `sync/` scanne les tables au moment du push et **synthétise** une enveloppe à la volée. Il n'existe alors aucune identité d'opération stable entre deux tentatives de push — l'`id` de l'enveloppe est nécessairement regénéré à chaque appel, ce qui interdit par construction la déduplication d'idempotence supposée nécessaire au point 3.1.

Ce sont deux architectures de synchro fondamentalement différentes, toutes deux compatibles avec la formulation Deferred ("schéma exact... job du code"), mais l'une rend AD-3 + l'enveloppe implémentables tel que documentés, l'autre non. La spine classe ce choix comme un détail d'implémentation sans conséquence, alors qu'il conditionne la faisabilité même du mécanisme d'idempotence implicite dans l'enveloppe qu'elle définit par ailleurs. C'est un invariant réel déguisé en détail.

---

## Récapitulatif des paires de divergence

| # | AD / Convention | Paire A vs B | Nature de la casse |
| --- | --- | --- | --- |
| 1 | AD-3 | Conflit three-way (curseur `last_pulled_at`, hors-schéma) vs conflit two-way LWW (respecte le schéma, viole "aucun écrasement automatique") | Détection de conflit incompatible + violation silencieuse de la Rule par une lecture littérale |
| 1b | AD-3 / Conventions | Écriture de la valeur arbitrée via `domain/` vs via `sync/` directement depuis un composant | Propriété d'écriture ambiguë, viole potentiellement "jamais un composant qui... contourne domain/" |
| 2 | AD-2 | Server Components lisent via `domain/`+Dexie seulement vs Server Components important `data/remote/` directement | Deux pages du même produit affichent des états différents pour la même entité ; direction de dépendance non tranchée pour RSC/Server Actions |
| 3 | Enveloppe sync | `id` régénéré par tentative vs `id` stable pour dédup | Duplication d'opérations possible côté serveur après retry réseau |
| 3b | Enveloppe sync | `fields` = delta vs `fields` = snapshot complet sur `update` | Faux conflits ou sur-écritures selon l'interprétation côté serveur |
| 3c | Enveloppe sync | Reprise d'upload via TUS natif Supabase vs chunks maison trackés en Dexie | Protocoles de reprise incompatibles, aucun champ d'enveloppe pour l'un ou l'autre |
| 4 | AD-3 vs Capability Map | `Task.priority` avec conflit par champ (AD-3 listée) vs `Document.priority` en écrasement simple (AD-3 absente de la ligne 4.5) | Contradiction textuelle directe ; même champ partagé, deux sémantiques de conflit |
| 5 | Deferred (schéma Dexie) | File de synchro = table d'enveloppes discrètes vs drapeaux "sale" par entité sans table séparée | Détermine si l'idempotence de retry supposée par l'enveloppe est même implémentable |

## Recommandation (constat, pas correctif)

Chacune des huit lignes ci-dessus est une AD manquante ou à resserrer : (1) définir la base de comparaison de conflit (three-way explicite, ou accepter le LWW et retirer "aucun écrasement automatique") et qui écrit la valeur arbitrée ; (2) nommer explicitement Server Components et Server Actions dans AD-2, avec un critère d'exécution plutôt que de chemin de fichier ; (3) transformer l'enveloppe en schéma JSON/TypeScript exécutable avec sémantique delta/snapshot, contrat d'idempotence sur `id`, et contenu défini pour `delete` ; (4) corriger la Capability Map pour lister AD-3 sur la ligne 4.5 Documents (ou justifier explicitement l'exclusion) ; (5) reclasser le modèle de stockage de la file de synchro (table dédiée vs drapeaux inline) comme décision d'architecture, pas comme détail de schéma.
