# TPG Go

PWA Next.js 15 des prochains passages TPG en temps réel, avec favoris et suivi de trajet.
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

- **Recherche d'arrêt** : autocomplétion (debounce 250 ms, clavier ↑ ↓ Entrée Échap, tactile),
  arrêts du canton de Genève remontés en tête.
- **Favoris** (localStorage) : affichés en premier sur l'accueil avec leurs 3 prochains passages ;
  ajout/retrait via l'étoile ; « Modifier » pour réordonner ou supprimer.
- **Tableau d'un arrêt** (`/stop/[id]`) : badge de ligne, destination, compte à rebours, retard
  temps réel mis en évidence, mention « théorique » quand la source n'a pas de temps réel.
- **Suivi du trajet** : au tap sur un passage, séquence complète des arrêts à venir (champ
  `passList`), heure prévue + temps réel, prochain arrêt mis en avant. La progression est
  **déduite des horaires** : la source ne fournit pas la position GPS du véhicule, et l'UI le dit.
  Le suivi continue après le départ de l'arrêt consulté (`/api/trip` réinterroge le prochain arrêt).

## Architecture

```
app/
  page.tsx                  accueil (recherche + favoris)
  stop/[id]/page.tsx        tableau des passages d'un arrêt
  api/departures/route.ts   prochains passages (?stop=<id|nom>&limit=)
  api/locations/route.ts    recherche d'arrêts (?q=)
  api/trip/route.ts         suite d'une course (?journey=&line=&stop=<id>&at=<ISO>)
  manifest.ts, layout.tsx, globals.css (design system)
components/                 Card, StickyBar, LineBadge, DepartureRow, Departures, StopSearch,
                            FavStar, TripSheet, FavoriteCard, StatusLine…
lib/
  types.ts                  modèle de domaine partagé (indépendant de la source)
  transport.ts              SEUL module qui connaît transport.opendata.ch (serveur)
  api.ts                    fetchers client vers /api/*
  favorites.ts              favoris (localStorage + useSyncExternalStore)
  useBoard.ts               polling 30 s (visible uniquement), reprise au premier plan
  progress.ts               progression temporelle d'une course
  lineColors.ts             couleurs de badge + contraste WCAG
  lineColors.generated.json généré par scripts/build-line-colors.mjs
public/sw.js                service worker (jamais de cache /api/*)
scripts/                    build-line-colors.mjs, build-icons.mjs, test-api.mjs
assets/tpg-go-icon.png      image maître des icônes (non servie)
data/line-colors.overrides.json   couleurs saisies à la main (voir plus bas)
```

- Tous les appels passent par les routes serveur : pas de CORS, cache amont à TTL strict (20 s
  pour les passages, 1 h pour les arrêts), API tierce protégée.
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
  téléchargement complet), filtre l'agence TPG (`agency_id` 881) et écrit
  `lib/lineColors.generated.json` (`route_short_name` → `route_color` / `route_text_color`).
- Le runtime lit ce JSON (rapide, compatible serverless). Le zip n'est jamais parsé en production.

> **Limite constatée (sept. 2026)** : le `routes.txt` suisse **ne contient pas** de colonnes
> `route_color` / `route_text_color` (86 lignes TPG, 0 couleur). Le script les prendra
> automatiquement dès qu'elles apparaîtront. En attendant :
>
> - toutes les lignes utilisent l'**orange TPG `#F59700`**, avec un texte de badge choisi pour
>   le contraste (WCAG AA) ;
> - on peut saisir les couleurs officielles TPG (plan du réseau, charte) dans
>   `data/line-colors.overrides.json`, puis relancer `npm run build:colors`. Format :
>   `"12": { "bg": "#RRGGBB", "fg": "#RRGGBB" }` (`fg` optionnel, calculé sinon).
>   N'y mettre que des valeurs issues d'une source officielle.

À relancer au changement d'horaire annuel (mi-décembre) avec
`GTFS_URL=…/timetable-2027-gtfs2020/permalink`.

## Design system

Sombre et sobre, inspiré des Apple HIG, thème clair/sombre automatique (`prefers-color-scheme`),
accent orange TPG `#F59700`. Fond plat (ni orbe ni dégradé) et **élévation en 4 niveaux**
(`elev-1` cartes, `elev-2` champ de recherche, `elev-3` suggestions, `elev-4` feuille de trajet) :
surface un peu plus claire en sombre, reflet sur l'arête haute, ombre plus profonde. Les barres
collantes deviennent opaques et ombrées quand le contenu défile dessous. Tokens dans
`app/globals.css`, exposés à Tailwind v4. Contrastes AA vérifiés sur chaque niveau. Cibles
tactiles ≥ 44 px, focus visibles, `prefers-reduced-motion` coupe les animations.

## Tester la source de données sans rien lancer

```bash
npm run test:api "Bel-Air"
```

## Limites connues

- API communautaire transport.opendata.ch plafonnée (~1000 req/jour/IP), d'où le cache serveur.
- Temps réel non garanti pour l'urbain ; affiché « théorique » quand absent.
- Pas de position GPS des véhicules en v1 (GTFS-RT officiel prévu en v2).

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub.
2. Sur vercel.com : *New Project* → importer le repo → *Deploy* (aucune variable requise).
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
