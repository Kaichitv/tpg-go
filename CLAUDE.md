# TPG Go

PWA des passages TPG en temps réel. Next.js 15 (App Router) + TypeScript, PWA installable, hébergée sur Vercel (offre gratuite).

## Commandes
- `npm run dev` — dev local (http://localhost:3000)
- `npm run build` — **doit toujours passer avant de conclure une tâche**
- `npm run test:api "Bel-Air"` — vérifie rapidement la source de données
- `npm run build:colors` — extrait les couleurs de lignes depuis le GTFS officiel (si le script existe)
- `npm run build:stops` — extrait la liste des arrêts TPG depuis le GTFS officiel (~1 min)

## Architecture & invariants (ne pas casser)
- App Router, TypeScript **strict**.
- **Tous** les appels aux données transport passent par des routes serveur `app/api/*` — jamais d'appel direct du navigateur vers l'API tierce. Ça évite le CORS, permet le cache et masque la source.
- Source live actuelle : `transport.opendata.ch` (sans clé), **isolée derrière `lib/transport.ts`**. L'UI ne connaît QUE cette couche typée, jamais l'URL tierce → on pourra migrer vers l'OJP officiel (opentransportdata.swiss) sans toucher l'UI.
- PWA : `app/manifest.ts`, `public/sw.js`. Le service worker ne met **jamais** en cache `/api/*` (horaires toujours frais) ; il sert la coquille hors-ligne.
- Cache : route `departures` en revalidate court (~20 s), `connections` ~30 s. Les routes `locations` et `nearby` ne touchent pas la source : elles lisent l'index local des arrêts TPG (`lib/stopIndex.ts`).

## Design system
- Glassmorphisme minimaliste, en suivant les **Apple HIG**.
- Thème **auto** clair/sombre (`prefers-color-scheme`) : les deux thèmes entièrement soignés.
- Accent : orange TPG `#F59700`.
- Cibles tactiles ≥ 44 px, police système, contraste **WCAG AA**, respect de `prefers-reduced-motion`.
- **Tailwind** (config App Router) + **Phosphor icons** (`@phosphor-icons/react`).
- Badges de ligne aux vraies couleurs (voir Données), avec couleur de texte calculée pour le contraste.

## Données
- **Couleurs de lignes** : source de vérité = GTFS officiel opentransportdata.swiss (`route_color` / `route_text_color`), extrait par `scripts/build-line-colors.mjs` → `lib/lineColors.*.json`. Le runtime lit le JSON, ne parse pas le zip. Fallback documenté + défaut orange. **Ne jamais inventer de hex.**
- **Arrêts** : recherche et proximité limitées au réseau TPG. Source de vérité = même GTFS (arrêts desservis par une course de l'agence TPG), extrait par `scripts/build-tpg-stops.mjs` → `lib/tpgStops.json` (snapshot commité, id = DIDOK). Lecture GTFS partagée dans `scripts/lib/gtfs.mjs`.
- **Itinéraires** : `/v1/connections` de opendata.ch, **toujours avec des ids DIDOK** (un nom comme « Bel-Air » est résolu ailleurs en Suisse). La source n'accepte pas de coordonnées : le départ depuis une position passe par les arrêts TPG proches et une marche **estimée** (`lib/itinerary.ts`), toujours signalée comme estimation dans l'UI. Doc : `docs/itinerary.md`.
- **Suivi de trajet** : séquence via le champ `passList` de opendata.ch. La progression est **déduite des horaires**, ce n'est pas une position GPS (le préciser dans l'UI). La vraie position viendra du GTFS-RT officiel en v2.
- Aucun secret commité ; clés en variables d'env + `.env.example`.

## Conventions de code
- Petits commits logiques.
- Composants dans `components/`, logique dans `lib/`.
- Strict : pas de `any` implicite ; fonctions data typées.
- Accessibilité obligatoire sur tout nouveau composant (aria-labels sur boutons-icônes, focus visibles).

## Roadmap
- **v1** : recherche d'arrêt, favoris, tableau des passages, suivi de trajet (temporel), itinéraire (départ immédiat).
- **v2** : OJP / GTFS-RT officiel (position réelle, fiabilité accrue), arrêts à proximité (géoloc), notifications.

## Honnêteté produit
Ne jamais présenter comme réelle une donnée que la source ne fournit pas (ex. position GPS live). Dégrader proprement quand le temps réel manque : afficher l'horaire théorique et signaler l'absence de temps réel.