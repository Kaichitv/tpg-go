# TPG Go

PWA Next.js 15 des prochains passages TPG en temps réel, avec favoris, itinéraires et suivi de trajet.
Installable sur mobile, coquille disponible hors-ligne, hébergeable sur Vercel (offre gratuite).

## Lancer en local

```bash
npm install
npm run dev        # → http://localhost:3000
npm run build      # build de production (TS strict + ESLint)
npm run lint       # ESLint seul
npm run typecheck  # TypeScript seul
```

Le service worker n'est enregistré qu'en production (`npm run build && npm start`).

## Fonctionnalités (v1)

- **Navigation** : tabbar en bas (Favoris, Recherche, Itinéraire, Réglages), toujours visible ;
  la page d'un arrêt garde son onglet d'origine sélectionné et y revient.
- **Recherche** : champ vide → arrêts récents (hors favoris) puis arrêts à proximité (distance
  à vol d'oiseau, prochains passages) ; la position n'est demandée qu'au geste, sauf si déjà
  autorisée.
- **Itinéraire** : d'un arrêt ou de ma position à un arrêt TPG, prochains itinéraires (lignes,
  marche, changements, compte à rebours, temps réel). Favoris et récents comme destinations en un
  toucher ; bouton **Y aller** sur la page d'un arrêt. Marche depuis la position **estimée** et
  signalée comme telle. Détails : [docs/itinerary.md](docs/itinerary.md).
- **Réglages** : thème auto / clair / sombre (persisté localement), formulaire de suggestions
  (nom + texte, transmis sur un salon Discord via `DISCORD_WEBHOOK_URL`), version et sources.

- **Recherche d'arrêt** : autocomplétion (debounce 250 ms, clavier ↑ ↓ Entrée Échap, tactile),
  limitée au **réseau TPG** (y compris les arrêts en France), insensible aux accents et à la
  ponctuation (« bel air », « belair » → Genève, Bel-Air). « À proximité » ne liste aussi que des
  arrêts TPG, à moins de 2 km.
- **Favoris** (localStorage) : affichés en premier sur l'accueil avec leurs 3 prochains passages ;
  ajout/retrait via l'étoile ; « Modifier » pour réordonner ou supprimer.
- **Tableau d'un arrêt** (`/stop/[id]`) : badge de ligne, destination, compte à rebours, retard
  temps réel mis en évidence, mention « théorique » et compte à rebours atténué (« ~2 min »)
  quand la source n'a pas de temps réel.
- **Suivi du trajet** : au tap sur un passage, séquence complète des arrêts à venir (champ
  `passList`), heure prévue + temps réel, prochain arrêt mis en avant. La progression est
  **déduite des horaires** : la source ne fournit pas la position GPS du véhicule, et l'UI le dit.
  Le suivi continue après le départ de l'arrêt consulté (`/api/trip` réinterroge le prochain arrêt).

## Architecture

```
app/
  page.tsx                  onglet Favoris (accueil)
  search/page.tsx           onglet Recherche (recherche, récents, à proximité)
  itinerary/page.tsx        onglet Itinéraire (?from=&to=, id d'arrêt ou « here »)
  settings/page.tsx         onglet Réglages (thème, suggestions, à propos)
  stop/[id]/page.tsx        tableau des passages d'un arrêt (poussé dans l'onglet d'origine)
  api/departures/route.ts   prochains passages (?stop=<id|nom>&limit=)
  api/locations/route.ts    recherche d'arrêts (?q=)
  api/nearby/route.ts       arrêts proches (?lat=&lon=)
  api/trip/route.ts         suite d'une course (?journey=&line=&stop=<id>&at=<ISO>)
  api/connections/route.ts  itinéraires (?from=&to=, id d'arrêt ou « lat,lon »)
  api/suggestions/route.ts  POST d'une suggestion { name, message } → webhook Discord
  manifest.ts, layout.tsx, globals.css (design system)
components/                 Card, StickyBar, LineBadge, DepartureRow, Departures, StopSearch,
                            FavStar, TripSheet, FavoriteCard, StatusLine, ItineraryScreen,
                            RouteFields, ConnectionCard…
lib/
  types.ts                  modèle de domaine partagé (indépendant de la source)
  transport.ts              SEUL module qui connaît transport.opendata.ch (serveur)
  stopIndex.ts              recherche / proximité dans les arrêts TPG (serveur)
  itinerary.ts              itinéraires depuis / vers une position : arrêts proches + marche estimée (serveur)
  tpgStops.json             snapshot committé, généré par scripts/build-tpg-stops.mjs
  api.ts                    fetchers client vers /api/*
  suggestion.ts             validation d'une suggestion (partagée client/serveur)
  discord.ts                envoi des suggestions au webhook Discord (serveur)
  favorites.ts              favoris (localStorage + useSyncExternalStore)
  useBoard.ts               polling 30 s, 15 s si passage < 3 min (visible uniquement), reprise au premier plan
  useConnections.ts         itinéraires, actualisés toutes les 60 s (visible uniquement)
  useStopSearch.ts          autocomplétion d'arrêts (recherche et champs d'itinéraire)
  progress.ts               progression temporelle d'une course
  lineColors.ts             couleurs de badge + contraste WCAG (overrides → snapshot → orange)
  lineColors.overrides.ts   lignes phares vérifiées à la main, source citée
  lineColors.fallback.json  snapshot committé, généré par scripts/build-line-colors.mjs
public/sw.js                service worker (jamais de cache /api/*)
docs/itinerary.md           documentation de la fonctionnalité Itinéraire
scripts/                    build-line-colors.mjs, build-tpg-stops.mjs, build-icons.mjs, test-api.mjs
                            lib/gtfs.mjs (lecture partagée du GTFS : Range, zip, CSV, flux)
assets/tpg-go-icon.png      image maître des icônes (non servie)
data/line-colors.overrides.json   couleurs saisies à la main (voir plus bas)
```

- Tous les appels passent par les routes serveur : pas de CORS, cache amont à TTL strict (20 s
  pour les passages), API tierce protégée. La recherche d'arrêts et la proximité n'appellent
  pas la source : elles lisent l'index TPG local.
- **Migration OJP** : réécrire `lib/transport.ts` (mêmes fonctions, mêmes types). L'UI ne change pas.

## Couleurs des lignes (GTFS officiel)

```bash
npm run build:colors
```

Le script lit le GTFS statique national sur opentransportdata.swiss :

- **Permalink** : `https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020/permalink`
  (redirige vers la dernière version publiée, ~290 Mo).
- **Authentification** : aucune à ce jour. Si le portail en exige une un jour, définir
  `OTD_API_KEY` (voir `.env.example`), envoyée en `Authorization: Bearer`.
- Il n'extrait que `agency.txt` et `routes.txt` via des requêtes HTTP Range (~2 s, pas de
  téléchargement complet) et filtre l'agence TPG (`agency_id` 881).
- Les lignes sans `route_color` sont complétées par la **liste officielle des lignes TPG**
  (`https://www.tpg.ch/fr/lignes`, objet `lignes` de la page : fond + classe de texte
  « blanc » / « noir »). Le GTFS reste prioritaire.
- Sorties :
  - `lib/lineColors.fallback.json` — **snapshot committé**, seul fichier lu par le runtime :
    `{ "<route_short_name>": { "bg": "#RRGGBB", "text": "#RRGGBB" } }`. Il n'est pas réécrit
    si tpg.ch est injoignable ;
  - `lib/lineColors.generated.json` — rapport complet (sources, stats), gitignoré.
- Le zip n'est jamais parsé en production.

Résolution au runtime (`getLineColor`) : `lib/lineColors.overrides.ts` (lignes phares, chaque
hex confirmé par une source officielle citée en commentaire) → snapshot → orange TPG `#F59700`.
Le texte officiel est gardé s'il atteint WCAG AA sur le fond ; sinon, ou s'il manque, on
calcule le meilleur contraste (quasi-noir / blanc).

> **Limite constatée (sept. 2026)** : le `routes.txt` suisse **ne contient pas** de colonnes
> `route_color` / `route_text_color` (86 lignes TPG, 0 couleur). Le script les prendra
> automatiquement dès qu'elles apparaîtront. En attendant, les couleurs viennent de tpg.ch ;
> les lignes que tpg.ch ne publie pas (A1–A6, CO, NM, NP, R au 2026-09-27) restent en
> **orange TPG**. On peut aussi saisir des couleurs officielles TPG (plan du réseau, charte) dans
>   `data/line-colors.overrides.json`, puis relancer `npm run build:colors`. Format :
>   `"12": { "bg": "#RRGGBB", "fg": "#RRGGBB" }` (`fg` optionnel, calculé sinon).
>   N'y mettre que des valeurs issues d'une source officielle.

À relancer au changement d'horaire annuel (mi-décembre) avec
`GTFS_URL=…/timetable-2027-gtfs2020/permalink`.

## Arrêts TPG (GTFS officiel)

```bash
npm run build:stops
```

La recherche nationale de la source live mélange toute la Suisse et plafonne à 10 résultats :
filtrer après coup perdrait des arrêts genevois. Le script construit donc la liste des arrêts
desservis par au moins une course TPG, à partir du même GTFS :

- `agency.txt` → `routes.txt` (lignes TPG, mode tram/bus) → `trips.txt` → `stop_times.txt`
  (~3,6 Go décompressés, **lus en flux** via HTTP Range, ~1 min) → `stops.txt` (nom, position).
- Identifiant = colonne `didok` de `stops.txt` (ex. `8587387`), celui qu'attend la source live
  pour les passages ; les quais d'un même arrêt sont regroupés. Les arrêts en France ont des
  identifiants `14xxxxx`, acceptés eux aussi par la source.
- Sortie : `lib/tpgStops.json`, **snapshot committé** (~880 arrêts, ~80 Ko), non réécrit si le
  résultat paraît incomplet (< 200 arrêts).

À relancer au changement d'horaire annuel, comme `build:colors`.

## Design system

Sombre et sobre, inspiré des Apple HIG, thème clair/sombre automatique (`prefers-color-scheme`)
ou forcé dans les Réglages, accent orange TPG `#F59700`. Fond plat (ni orbe ni dégradé) et **élévation en 4 niveaux**
(`elev-1` cartes, `elev-2` champ de recherche, `elev-3` popovers, `elev-4` feuille de trajet) :
surface un peu plus claire en sombre, reflet sur l'arête haute, ombre plus profonde. Les barres
collantes deviennent opaques et ombrées quand le contenu défile dessous. Tokens dans
`app/globals.css`, exposés à Tailwind v4. Contrastes AA vérifiés sur chaque niveau. Cibles
tactiles ≥ 44 px, focus visibles, `prefers-reduced-motion` coupe les animations.

## Tester la source de données sans rien lancer

```bash
npm run test:api "Bel-Air"
```

## Limites connues

- API communautaire transport.opendata.ch partagée : pas de quota fixe annoncé, mais les requêtes
  répétées sont ralenties (doc consultée en oct. 2026), d'où le cache serveur. Un itinéraire depuis
  une position coûte jusqu'à 3 appels.
- Temps réel non garanti pour l'urbain ; affiché « théorique » quand absent.
- Pas de position GPS des véhicules en v1 (GTFS-RT officiel prévu en v2).
- Itinéraires : départ immédiat uniquement, marche estimée à vol d'oiseau, lignes non TPG (Léman
  Express, CFF) en badge neutre faute de couleurs officielles (voir [docs/itinerary.md](docs/itinerary.md)).
- Anti-abus des suggestions « best effort » (pot de miel, même origine, 5 envois / 10 min par IP
  en mémoire de l'instance serverless, remis à zéro au démarrage à froid).

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub.
2. Sur vercel.com : *New Project* → importer le repo → *Deploy* (aucune variable requise).
   Pour recevoir les suggestions : *Settings → Environment Variables* → `DISCORD_WEBHOOK_URL`
   (voir `.env.example`), puis redéployer.
3. Sur mobile : ouvrir l'URL → *Ajouter à l'écran d'accueil*.

## Icônes

Toutes les icônes sont générées depuis une seule image maître, `assets/tpg-go-icon.png`
(squircle orange sur fond blanc, pas besoin de la détourer) :

```bash
npm run build:icons
```

Le script détecte le squircle, modélise le dégradé de fond pour le prolonger au-delà du bord,
puis rend chaque taille :

| Fichier | Usage |
| --- | --- |
| `public/icons/icon-{192,512}.png` | manifest `any`, squircle détouré (transparent) |
| `public/icons/icon-maskable-{192,512}.png` | manifest `maskable`, pleine surface, pictogramme dans la zone sûre (cercle 80 %) |
| `app/apple-icon.png` (180) | écran d'accueil iOS, opaque (iOS applique son propre masque) |
| `app/icon.png` (192), `app/favicon.ico` (16/32/48) | favicons |

Après un changement d'icônes, incrémenter `VERSION` dans `public/sw.js` : les icônes y sont
servies en cache d'abord.
