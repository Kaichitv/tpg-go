# Itinéraire

Calcul d'itinéraires sur le réseau TPG : d'un arrêt (ou de ma position) à un autre, avec les
prochains départs, la durée, les changements et la marche. Troisième onglet de l'app
(Favoris · Recherche · **Itinéraire** · Réglages).

## Pourquoi

C'est la fonctionnalité la plus demandée. On a aussi constaté que des utilisateurs tapent leur
arrêt d'**arrivée** dans la recherche, alors que celle-ci sert à voir les départs **depuis** un
arrêt. La recherche ne change pas : on ajoute un onglet dédié et des raccourcis qui y mènent.

## Parcours utilisateur

### Onglet Itinéraire

- **Départ** : « Ma position » par défaut. **Arrivée** : vide au départ.
- Champ d'arrivée vide → section « Où vas-tu ? » avec les favoris puis les arrêts récents :
  une destination en un seul toucher.
- Toucher un champ le passe en saisie :
  - sans texte : « Ma position », favoris (★), récents (horloge) ;
  - dès 2 lettres : arrêts TPG correspondants (même index que la recherche) ;
  - clavier ↑ ↓ Entrée Échap ; « Annuler » ou Échap rend le focus au champ.
- Bouton ⇅ : inverse départ et arrivée (« Ma position » peut aussi être l'arrivée).
- Choisir dans un champ l'extrémité déjà présente dans l'autre vide cet autre champ.
- La saisie est gardée en mémoire le temps de la session : en revenant sur l'onglet, on retrouve
  le dernier itinéraire (comportement d'onglet iOS).

### Raccourci « Y aller »

Sur la page d'un arrêt (`/stop/[id]`), le bouton **Y aller** ouvre
`/itinerary?to=<id>` : de ma position jusqu'à cet arrêt, résultats lancés sans aucune saisie.
C'est le filet de sécurité pour qui a cherché son arrêt d'arrivée.

### Résultats

Une carte par itinéraire, du prochain départ au plus tardif (6 au maximum) :

```
14:57 → 15:23                         26 min
🚶~3 › [3] › 🚶4 › [IR 15] › 🚶2 › [28]
Depuis Bel-Air · 2 changements    Partir dans 1 min
```

- Heures effectives (temps réel si disponible) et durée totale, marche comprise.
- Enchaînement des étapes : badges de ligne, marche en minutes (`~` = estimée par TPG Go).
- « Depuis <arrêt de montée> » et nombre de changements (ou « direct »).
- Compte à rebours : « **Partir** dans… » si l'itinéraire commence à pied, « **Départ**
  dans… » s'il commence à bord.
- Retard de la première course en rouge (`+2 min`) ; sans temps réel : « ~ » et « théorique ».
- Option **à pied** quand l'arrivée (ou le départ) est à moins de 800 m de la position ; les
  itinéraires qui ne vont pas plus vite que la marche sont alors retirés.
- Actualisation automatique toutes les 60 s (page visible), au retour au premier plan et au
  retour du réseau ; un itinéraire dont le départ est passé de plus d'une minute est masqué.
- En cas d'échec d'actualisation, les derniers résultats restent affichés, signalés comme
  non actualisés.

### Position

La permission n'est demandée qu'au geste (« Utiliser ma position »), sauf si elle est déjà
accordée (HIG, comme « À proximité »). Refusée, indisponible ou introuvable : message
explicatif et bouton « Choisir un arrêt à la place ». Si une relocalisation échoue, on garde la
dernière position connue et on le signale.

## URL

L'état vit dans l'URL, mise à jour sans navigation (`history.replaceState`) :

| URL | Effet |
| --- | --- |
| `/itinerary` | Reprend la dernière saisie de la session, sinon « Ma position → (vide) » |
| `/itinerary?to=8587387` | Ma position → Genève, Bel-Air |
| `/itinerary?from=8587387&to=8592935` | Bel-Air → Genève-Aéroport, gare-Arena |
| `/itinerary?from=8592935&to=here` | Aéroport → ma position |

`here` = ma position. Les ids sont des ids DIDOK de l'index TPG ; un id inconnu est ignoré.
Les noms sont résolus côté serveur (`app/itinerary/page.tsx`) dans l'index local.

## API

### `GET /api/connections?from=&to=`

Chaque extrémité est un **id d'arrêt TPG** (`8587387`) ou une **position** `lat,lon`
(`46.2044,6.145`, WGS84, arrondie à 4 décimales par le client, soit ~10 m). Au plus une
position.

Réponse (`ConnectionsResult`, `lib/types.ts`) :

```ts
{
  updatedAt: string;          // ISO
  connections: Connection[];  // 0 à 6, triés par départ
}

Connection = {
  key: string;
  departure: TimePoint;       // heure de mise en route (marche initiale comprise)
  arrival: TimePoint;
  transfers: number;
  legs: (RideLeg | WalkLeg)[];
}
RideLeg = { kind: "ride", journey, line, category, operator, isTpg, destination,
            from: LegStop, to: LegStop, stops: TripStop[] }
WalkLeg = { kind: "walk", from: Stop | null, to: Stop | null,   // null = ma position
            departure, arrival, durationMin, estimated }
```

| Statut | Cas |
| --- | --- |
| 400 `bad_request` | paramètre absent ou mal formé, deux positions, départ = arrivée |
| 404 `not_found` | id hors réseau TPG, aucun arrêt TPG à moins de 2 km de la position |
| 502 `upstream` | source injoignable ou en erreur |

Cache : `Cache-Control: max-age=15`, `private` dès qu'une position est présente (la réponse
révèle une position), `public` sinon. Côté serveur, chaque appel à la source est mis en cache
30 s (cache mémoire à TTL strict de `lib/transport.ts`). Le service worker ne met jamais
`/api/*` en cache.

### Source

`getConnections(fromId, toId, { at, limit })` dans `lib/transport.ts` appelle
`transport.opendata.ch/v1/connections`. Constats qui ont guidé l'implémentation (oct. 2026) :

- **Toujours des ids, jamais des noms** : `from=Bel-Air` est résolu en « Bel-Air LEB »
  (Lausanne) et renvoie un trajet de 1 h 26 vers l'aéroport.
- **Pas de coordonnées** : `from=46.2044,6.145` renvoie une liste vide.
- **Adresses mal résolues** : « Rue du Rhône 8, Genève » part de l'arrêt Rue du Lac (~1 km)
  alors que Bel-Air est à 155 m.
- Les itinéraires incluent Léman Express et trains CFF, souvent les plus rapides.

Mapping vers le domaine :

- Lignes ferroviaires : catégorie préfixée quand le numéro est seul (`RE 33`, `IR 15`), pour ne
  pas les confondre avec une ligne TPG (le bus 33). `L4` reste `L4`.
- `isTpg` = exploitant `TPG` (ou absent). Les autres lignes ont un **badge neutre** : les couleurs
  connues sont celles des lignes TPG, on n'en invente pas pour les autres.
- Un itinéraire dont une section est illisible est écarté plutôt qu'affiché incomplet.

## Départ depuis ma position (`lib/itinerary.ts`)

La source n'acceptant ni coordonnées ni adresses fiables, le serveur procède ainsi :

1. Arrêts candidats : les 3 arrêts TPG les plus proches (index local) à moins de 800 m ;
   à défaut, le plus proche à moins de 2 km.
2. Une requête `connections` par candidat, en parallèle, à partir de « maintenant + marche »
   (inutile de proposer un départ qu'on n'atteindra pas). 4 itinéraires par candidat.
3. Ajout de l'étape à pied, **estimée** : distance à vol d'oiseau × 1,3 (détour), à 80 m/min
   (~4,8 km/h), arrondie à la minute supérieure. Si la source commence elle-même par une
   marche, les deux sont fusionnées.
4. Option « à pied » si l'autre extrémité est à moins de 800 m ; elle retire les itinéraires
   qui ne sont pas plus rapides qu'elle.
5. Tri et filtrage :
   - mêmes courses prises à deux arrêts voisins → on garde celle qui arrive le plus tôt, puis
     qui part le plus tard ;
   - on retire les itinéraires **dominés** (partir plus tôt pour arriver plus tard, avec
     autant de changements ou plus) ;
   - on retire les départs passés de plus de 30 s ; tri par départ, 6 au maximum.

Même logique, en miroir, quand l'arrivée est ma position. Si une partie des requêtes échoue,
on renvoie celles qui ont abouti ; si toutes échouent, l'erreur remonte.

| Constante | Valeur |
| --- | --- |
| `CANDIDATES` | 3 arrêts |
| `MAX_WALK_M` | 800 m |
| `DETOUR` | 1,3 |
| `WALK_M_PER_MIN` | 80 |
| `PER_PAIR` / `MAX_RESULTS` | 4 / 6 |

Coût : jusqu'à 3 appels à la source par calcul depuis une position (1 d'arrêt à arrêt).

## Honnêteté produit

- La marche calculée par TPG Go est toujours marquée `~` et la page rappelle sous les
  résultats : « Marche estimée à vol d'oiseau depuis ta position (précision ± X m), sans tenir
  compte du trajet réel ».
- Sans temps réel pour la première course : compte à rebours « ~ » atténué et mention
  « théorique ».
- Aucune position de véhicule n'est affichée ni suggérée.

## Accessibilité

- Champs de saisie en combobox ARIA (`aria-activedescendant`), annonce du nombre de résultats.
- Après un choix ou une annulation, le focus revient sur le champ modifié.
- Chaque carte a un résumé complet pour les lecteurs d'écran (« Départ 14:57, arrivée 15:23,
  26 minutes. Environ 3 minutes à pied jusqu'à Genève, Bel-Air, puis Bus 3… »).
- Cibles ≥ 44 px ; bouton « Y aller » : texte `accent-ink` sur `accent/15`, 4,8:1 en clair et
  8,3:1 en sombre (survol à `accent/20`, au-delà on passe sous AA en clair).

## Limites actuelles

- Départ immédiat uniquement : pas encore de « Partir à… » / « Arriver à… » ni de « Plus tard ».
- Pas de détail par étape (arrêt de descente, nombre d'arrêts, quai) ni de suivi d'une étape.
- Pas de carte.
- Pas de raccourci itinéraire dans la liste de résultats de la recherche (seulement « Y aller »
  sur la page d'un arrêt).
- Lignes non TPG (Léman Express, CFF) en badge neutre.
- La marche est une estimation géométrique (ni rues, ni dénivelé, ni passages).

## Suite prévue

1. Raccourci ⤳ dans les résultats de la recherche : bouton secondaire par ligne (pattern
   combobox à grille, ←→ entre l'arrêt et le bouton).
2. Détail d'un itinéraire en feuille (étapes, quais) et **Suivre** une étape avec le `TripSheet`
   existant ; choix de l'heure (`date`/`time`/`isArrivalTime` de la source) ; « Plus tard »
   (`page`) ; itinéraires récents.
3. Couleurs officielles du Léman Express, extraites du GTFS comme pour les lignes TPG.
4. Itinéraires favoris dans l'onglet Favoris (« Maison → Travail » avec le prochain départ).
5. Carte dans le détail, chargée à la demande.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `app/itinerary/page.tsx` | lit `?from=&to=`, résout les noms dans l'index |
| `app/api/connections/route.ts` | validation des paramètres, en-têtes de cache |
| `lib/itinerary.ts` | position → arrêts candidats, marche estimée, tri (serveur) |
| `lib/transport.ts` | `getConnections` : appel et mapping de la source (serveur) |
| `lib/stopIndex.ts` | `getTpgStop`, `nearestTpgStops`, `distanceM` (serveur) |
| `lib/types.ts` | `Endpoint`, `Connection`, `Leg`, `Place`, `ItineraryQuery` |
| `lib/useConnections.ts` | chargement + actualisation 60 s côté client |
| `lib/useStopSearch.ts` | autocomplétion partagée avec la recherche |
| `lib/useStopShortcuts.ts` | favoris + récents sans doublon |
| `components/ItineraryScreen.tsx` | écran, états (position, vide, erreurs), URL |
| `components/RouteFields.tsx` | champs Départ / Arrivée, saisie, inversion |
| `components/ConnectionCard.tsx` | une carte de résultat |
| `components/StopBoard.tsx` | bouton « Y aller » |
