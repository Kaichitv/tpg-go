# Itinéraire

Calcul d'itinéraires sur le réseau TPG : d'un arrêt (ou de ma position) à un autre, avec les
prochains départs (ou à une date et une heure choisies), la durée, les changements et la marche. Troisième onglet de l'app
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
- La saisie (heure comprise) est gardée en mémoire le temps de la session : en revenant sur
  l'onglet, on retrouve le dernier itinéraire (comportement d'onglet iOS).

### Heure du trajet

Suggestion d'utilisateur : « si je souhaite me rendre à un endroit demain à 8h, je ne peux pas
sélectionner une date et une heure de départ ou d'arrivée ».

Troisième ligne de la carte Départ / Arrivée, masquée pendant la saisie d'un arrêt :

```
○  Départ   Ma position                  ⇅
📍 Arrivée  Genève-Aéroport, gare-Arena
🕐 Arriver demain à 08:00                ⊗
```

- Par défaut « Partir maintenant ». La toucher ouvre une feuille (même schéma `<dialog>` que le
  détail) : contrôle segmenté **Partir à / Arriver à**, puis une **roue** jour · heure · minutes,
  comme Plans d'Apple, et « Valider » ; « Partir maintenant » revient au départ immédiat.

  ```
  ┌ Partir à ─┬─ Arriver à ┐
     Aujourd'hui   16   45
  ┃  Demain        18 : 55  ┃
     Ven. 16 oct.  19
  ```

  - Jour sur 30 jours, heures 00–23, minutes de 5 en 5. À l'ouverture : l'heure choisie, sinon
    maintenant arrondi aux 5 min suivantes.
  - Roue personnalisée plutôt que les contrôles natifs : même rendu sur tous les appareils (le
    champ `time` est une roue en bulle sur iOS, une horloge sur Android, un champ texte sur
    ordinateur), toujours en 24 h, et « Demain » sans ouvrir de liste.
  - Défilement natif aimanté (`scroll-snap`), donc l'inertie du système ; toucher ou cliquer une
    ligne l'amène au centre ; molette à la souris.
  - Chaque colonne est une `listbox` (`aria-activedescendant`) : ↑ ↓, Page ↑ / Page ↓, Début /
    Fin ; lecture complète des options (« demain, jeudi 15 octobre », « 8 heures »). Lignes de
    44 px ; fondu haut / bas : la ligne choisie et ses voisines restent au-dessus de 4,5:1, les
    lignes du bord s'estompent (indice de défilement, comme sur iOS).
- Une heure passée est refusée (« Cette heure est déjà passée. ») ; l'heure sautée au passage à
  l'heure d'été aussi (« Cette heure n'existe pas ce jour-là »).
- Heure choisie : la ligne la reprend en gras (« Partir à 17:30 », « Arriver demain à 08:00 »,
  « Partir le sam. 17 oct. à 07:30 ») avec une croix pour revenir à « maintenant ».
- Toujours en **heure suisse**, quel que soit le fuseau de l'appareil (comme toutes les heures
  de l'app).
- Une heure dépassée de plus d'une minute (onglet rouvert plus tard, lien ancien) repasse
  d'elle-même à « Partir maintenant ».
- **Partir à** : les premiers itinéraires à partir de cette heure. **Arriver à** : les derniers
  qui arrivent à temps, toujours triés par départ (le plus utile, le départ le plus tardif, est
  en bas de liste).
- Sur les cartes et dans le détail, un départ un autre jour s'affiche « Départ demain » ou
  « Départ le jeu. 15 oct. » au lieu du compte à rebours.
- Plus d'une heure avant l'heure choisie, le temps réel n'est pas encore connu : actualisation
  toutes les 10 min au lieu de 60 s, et pas de bouton « Suivre ».

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
- Aucun résultat : « Aucun itinéraire trouvé pour le moment. », ou pour une heure choisie
  « … à partir de l'heure choisie. » / « Aucun itinéraire ne permet d'arriver à l'heure
  choisie. ».
- Toucher une carte ouvre son **détail** (ci-dessous).

### Détail d'un itinéraire

Feuille modale par le bas (même schéma que le suivi de trajet : `<dialog>` natif, poignée,
fond flouté, Échap ou toucher le fond pour fermer).

```
10:45 → 11:05                                   ✕
20 min · 1 changement · Partir dans 7 min
───────────────────────────────────────────────
10:45  ○  Ma position
estimé ┊  🚶 ~3 min à pied (estimation)
10:48  ●  Genève, Bel-Air                 Quai C
       ┃  [20] Direction Bellevue GE, Valavran
       ┃  2 arrêts · 5 min ⌄            [Suivre]
10:53  ●  Genève, gare Cornavin           Quai J
       ┊  🚶 4 min à pied · 1 min d'attente
10:58  ●  Genève-Cornavin                 Voie 3
       ┃  [IR 90] Direction Genève-Aéroport
11:05  ●  Genève-Aéroport                 Voie 3
```

- **Frise** : heure à gauche, rail au centre (trait à la couleur de la ligne, gris pour les
  lignes non TPG, pointillés pour la marche et les correspondances), arrêt à droite.
- **Heures** : effective (temps réel si disponible) ; en dessous, l'heure prévue barrée en cas
  d'écart, « prévu » sans temps réel, « estimé » pour une heure calculée par TPG Go (marche
  depuis / vers ma position).
- **Quais** : lettre → « Quai F » (TPG), chiffre → « Voie 3 » (trains).
- **Étape à bord** : badge, direction, « N arrêts · M min » ; ce libellé déplie / replie les
  arrêts intermédiaires (heure + nom, petits points sur le rail).
- **Entre deux étapes** : marche (« ~ » si estimée) avec l'attente éventuelle avant le départ
  suivant, ou « Correspondance · 2 min » quand on change au même arrêt.
- Le détail suit les actualisations de la liste (retards). Si l'itinéraire disparaît des
  résultats (départ passé), la feuille garde sa dernière version.

### Suivre une étape

Le bouton **Suivre** d'une étape TPG ouvre la feuille de suivi existante (`TripSheet`) sur
cette course :

- liste limitée de l'arrêt de montée à l'arrêt de **descente**, signalé « Descendre ici » ;
  une fois passé, l'en-tête indique « Arrivée à … » au lieu de « Course terminée » ;
- chevron **retour** (et Échap) : on revient au détail, le focus reprend sur le bouton
  « Suivre » touché ; ✕ ou toucher le fond ferme tout ;
- progression **déduite des horaires**, comme partout dans l'app ; les correspondances d'un
  arrêt restent accessibles.

« Suivre » n'est proposé que pour les lignes TPG, tant que l'étape n'est pas terminée et à
moins d'une heure de son départ (un trajet planifié pour demain ne se suit pas encore) : le
suivi retrouve la course dans le tableau des passages de l'arrêt (même identifiant de course
et même numéro de ligne, vérifié). Pour les trains, le libellé affiché (« IR 90 ») ne
correspond pas au numéro du tableau, et la correspondance n'est pas garantie.

### Position

La permission n'est demandée qu'au geste (« Utiliser ma position »), sauf si elle est déjà
accordée (HIG, comme « À proximité ») : on localise alors dès que le trajet part de ma position
ou y mène, jamais pour un trajet d'arrêt à arrêt. « Déjà accordée » est retenu sur l'appareil
(drapeau `tpg-go:geo-allowed:v1`, effacé au premier refus) : Safari répond « prompt » à
`permissions.query` à chaque chargement tant que la page n'a pas appelé l'API Geolocation
([WebKit 293089](https://bugs.webkit.org/show_bug.cgi?id=293089)). Refusée, indisponible ou introuvable : message
explicatif et bouton « Choisir un arrêt à la place ». Si une relocalisation échoue, on garde la
dernière position connue et on le signale. Aucun arrêt TPG à moins de 2 km : message
« Aucun arrêt à proximité », avec « Réessayer » et « Choisir un arrêt à la place ».

La position **ne quitte jamais l'appareil** : elle y est réduite aux arrêts proches et aux
minutes de marche (`lib/walk.ts`), seules données envoyées au serveur (voir API).

## URL

L'état vit dans l'URL, mise à jour sans navigation (`history.replaceState`) :

| URL | Effet |
| --- | --- |
| `/itinerary` | Reprend la dernière saisie de la session, sinon « Ma position → (vide) » |
| `/itinerary?to=8587387` | Ma position → Genève, Bel-Air |
| `/itinerary?from=8587387&to=8592935` | Bel-Air → Genève-Aéroport, gare-Arena |
| `/itinerary?from=8592935&to=here` | Aéroport → ma position |
| `/itinerary?from=8587387&to=8592935&arrive=2026-10-15T08:00` | Bel-Air → Aéroport, arriver le 15 oct. à 08:00 |
| `/itinerary?to=8592935&depart=2026-10-15T07:30` | Ma position → Aéroport, partir le 15 oct. à 07:30 |

`here` = ma position. Les ids sont des ids DIDOK de l'index TPG ; un id inconnu est ignoré.
`depart` / `arrive` : heure murale suisse `AAAA-MM-JJTHH:mm`, lisible et partageable ; une
heure invalide, passée ou à plus de 30 jours est ignorée (départ immédiat). Les noms et l'heure
sont résolus côté serveur (`app/itinerary/page.tsx`).

## API

### `GET /api/connections?from=&to=[&near=&walk=][&at=[&arriveBy=1]]`

Chaque extrémité est un **id d'arrêt TPG** (`8587387`) ou **`here`** (ma position, au plus une
extrémité). La position elle-même n'est **jamais envoyée** : l'appareil la réduit
(`lib/walk.ts`) à :

- `near=<id>:<min>,…` : les arrêts candidats (3 au plus) et la marche estimée jusqu'à chacun ;
- `walk=<min>` (facultatif) : la marche directe jusqu'à l'autre extrémité, quand elle est à
  moins de 800 m (option « à pied »).

Exemple : `?from=here&to=8592935&near=8592862:3,8587387:4,8592794:4`. Les minutes sont bornées
(1 à 33 pour `near`, 1 à 13 pour `walk`), tout autre format est refusé (400).

Heure planifiée (facultative, sinon départ immédiat) :

- `at=<ISO 8601>` : partir à cette heure ; un départ n'est jamais cherché dans le passé ;
- `arriveBy=1` (avec `at`) : arriver au plus tard à cette heure.

`at` est un instant (le client convertit l'heure suisse choisie), accepté d'une heure dans le
passé (horloges décalées) à 31 jours à l'avance ; au-delà, ou mal formé : 400.

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
| 400 `bad_request` | paramètre absent ou mal formé (dont l'ancien `lat,lon`), deux positions, départ = arrivée, `at` hors bornes |
| 404 `not_found` | id hors réseau TPG, ou aucun des arrêts `near` connu (index d'une version précédente) |
| 502 `upstream` | source injoignable ou en erreur |

Cache : `Cache-Control: max-age=15`, `private` dès que ma position est une extrémité (les
arrêts proches la révèlent à peu près), `public` sinon. Côté serveur, chaque appel à la source est mis en cache
30 s (cache mémoire à TTL strict de `lib/transport.ts`). Le service worker ne met jamais
`/api/*` en cache.

### Source

`getConnections(fromId, toId, { at, arriveBy, limit })` dans `lib/transport.ts` appelle
`transport.opendata.ch/v1/connections` (`date`, `time` en heure suisse, `isArrivalTime=1`).
Constats qui ont guidé l'implémentation (oct. 2026) :

- **Toujours des ids, jamais des noms** : `from=Bel-Air` est résolu en « Bel-Air LEB »
  (Lausanne) et renvoie un trajet de 1 h 26 vers l'aéroport.
- **Pas de coordonnées** : `from=46.2044,6.145` renvoie une liste vide.
- **Adresses mal résolues** : « Rue du Rhône 8, Genève » part de l'arrêt Rue du Lac (~1 km)
  alors que Bel-Air est à 155 m.
- Les itinéraires incluent Léman Express et trains CFF, souvent les plus rapides.
- `isArrivalTime=1` renvoie les derniers itinéraires qui arrivent avant l'heure, triés par
  départ.
- Horizon : les horaires sont publiés environ trois mois à l'avance (le 12 janvier 2027 ne
  renvoie rien le 14 octobre 2026) ; le choix du jour est donc limité à 30 jours.

Mapping vers le domaine :

- Lignes ferroviaires : catégorie préfixée quand le numéro est seul (`RE 33`, `IR 15`), pour ne
  pas les confondre avec une ligne TPG (le bus 33). `L4` reste `L4`.
- `isTpg` = exploitant `TPG` (ou absent). Les autres lignes ont un **badge neutre** : les couleurs
  connues sont celles des lignes TPG, on n'en invente pas pour les autres.
- Un itinéraire dont une section est illisible est écarté plutôt qu'affiché incomplet.
- La gare CFF s'appelle « Genève » tout court dans la source (id 8501008) : elle est affichée
  **« Genève-Cornavin »**, comme ses voisines (Genève-Aéroport, Genève-Champel…) et distincte de
  l'arrêt TPG « Genève, gare Cornavin ». Le renommage est fait dans `lib/transport.ts`
  (`RENAMED`) et vaut aussi pour les directions et les tableaux de passages.

## Départ depuis ma position (`lib/walk.ts`, `lib/itinerary.ts`)

La source n'acceptant ni coordonnées ni adresses fiables, on procède ainsi. Les étapes 1, 3
(minutes de marche) et 4 (distance de l'option « à pied ») sont calculées **sur l'appareil**,
dans l'index local, à pleine précision (`lib/walk.ts`) ; le serveur (`lib/itinerary.ts`) ne
reçoit que les arrêts et les minutes. Aucun arrêt à moins de 2 km : l'appareil le signale sans
interroger le serveur.

1. Arrêts candidats : les 3 arrêts TPG les plus proches (index local) à moins de 800 m ;
   à défaut, le plus proche à moins de 2 km.
2. Une requête `connections` par candidat, en parallèle, à partir de « maintenant (ou heure
   choisie) + marche » (inutile de proposer un départ qu'on n'atteindra pas). 4 itinéraires
   par candidat. **Arriver à** : arrivée à l'heure choisie, moins la marche finale quand
   l'arrivée est ma position.
3. Ajout de l'étape à pied, **estimée** : distance à vol d'oiseau × 1,3 (détour), à 80 m/min
   (~4,8 km/h), arrondie à la minute supérieure. Si la source commence elle-même par une
   marche, les deux sont fusionnées.
4. Option « à pied » si l'autre extrémité est à moins de 800 m, partant à l'heure demandée (ou
   y arrivant) ; elle retire les itinéraires qui ne sont pas plus rapides qu'elle.
5. Tri et filtrage :
   - mêmes courses prises à deux arrêts voisins → on garde celle qui arrive le plus tôt, puis
     qui part le plus tard ;
   - on retire les itinéraires **dominés** (partir plus tôt pour arriver plus tard, avec
     autant de changements ou plus) ;
   - on retire les départs passés de plus de 30 s ; tri par départ, 6 au maximum : les
     premiers, ou les derniers pour **Arriver à** (au plus près de l'heure d'arrivée).

Même logique, en miroir, quand l'arrivée est ma position. Si une partie des requêtes échoue,
on renvoie celles qui ont abouti ; si toutes échouent, l'erreur remonte.

| Constante | Valeur | Fichier |
| --- | --- | --- |
| `CANDIDATES` | 3 arrêts | `lib/walk.ts` |
| `MAX_WALK_M` | 800 m | `lib/walk.ts` |
| `DETOUR` | 1,3 | `lib/walk.ts` |
| `WALK_M_PER_MIN` | 80 | `lib/walk.ts` |
| `PER_PAIR` / `MAX_RESULTS` | 4 / 6 | `lib/itinerary.ts` |

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
- Chaque carte est un bouton (`aria-haspopup="dialog"`) avec un résumé complet pour les lecteurs
  d'écran (« Départ 14:57, arrivée 15:23, 26 minutes. Environ 3 minutes à pied jusqu'à Genève,
  Bel-Air, puis Bus 3… Voir le détail »).
- Détail : feuille modale native (focus piégé, fond inerte), titre annoncé, frise en liste
  ordonnée, dépliage des arrêts en `aria-expanded`, « Suivre » complété pour les lecteurs
  d'écran (« Suivre le trajet de la ligne 20 »). Bouton « Suivre » : 5,2:1 en clair, 6,3:1 en
  sombre.
- Nombres et unités liés par des espaces insécables (« 1 changement », « 20 min »).
- Cibles ≥ 44 px ; bouton « Y aller » : texte `accent-ink` sur `accent/15`, 4,8:1 en clair et
  8,3:1 en sombre (survol à `accent/20`, au-delà on passe sous AA en clair).

## Limites actuelles

- Pas de « Plus tôt » / « Plus tard » : 6 itinéraires autour de l'heure demandée.
- Heure planifiée limitée à 30 jours (horizon des horaires publiés par la source).
- Itinéraire planifié depuis « Ma position » : c'est la position actuelle qui sert de départ.
- « Suivre » limité aux lignes TPG.
- Retour du suivi au détail : la feuille de détail est rouverte (les arrêts dépliés sont
  repliés).
- Pas de carte.
- Pas de raccourci itinéraire dans la liste de résultats de la recherche (seulement « Y aller »
  sur la page d'un arrêt).
- Lignes non TPG (Léman Express, CFF) en badge neutre.
- La marche est une estimation géométrique (ni rues, ni dénivelé, ni passages).

## Suite prévue

1. Raccourci ⤳ dans les résultats de la recherche : bouton secondaire par ligne (pattern
   combobox à grille, ←→ entre l'arrêt et le bouton).
2. « Plus tôt » / « Plus tard » (`page` de la source) ; itinéraires récents.
3. Couleurs officielles du Léman Express, extraites du GTFS comme pour les lignes TPG.
4. Itinéraires favoris dans l'onglet Favoris (« Maison → Travail » avec le prochain départ).
5. Carte dans le détail, chargée à la demande.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `app/itinerary/page.tsx` | lit `?from=&to=` et `depart=` ou `arrive=`, résout les noms dans l'index |
| `app/api/connections/route.ts` | validation des paramètres (`here`, `near`, `walk`, `at`, `arriveBy`), en-têtes de cache |
| `lib/walk.ts` | ma position → arrêts candidats et marche estimée, sur l'appareil (bornes partagées) |
| `lib/itinerary.ts` | appariement des arrêts, étapes à pied, tri (serveur) |
| `lib/transport.ts` | `getConnections` : appel et mapping de la source (serveur) |
| `lib/stopIndex.ts` | `getTpgStop`, `nearestTpgStops`, `distanceM` (partagé client/serveur) |
| `lib/types.ts` | `Endpoint`, `Connection`, `Leg`, `Place`, `PlannedTime`, `ItineraryQuery` |
| `lib/plannedTime.ts` | heure planifiée : bornes (30 jours), pas de 5 min, libellés, jours proposés, format d'URL |
| `lib/zurichTime.ts` | heure murale suisse ↔ instant (changements d'heure compris) |
| `lib/useConnections.ts` | chargement + actualisation 60 s (10 min si planifié à plus d'1 h) côté client |
| `lib/useStopSearch.ts` | autocomplétion partagée avec la recherche |
| `lib/useStopShortcuts.ts` | favoris + récents sans doublon |
| `components/ItineraryScreen.tsx` | écran, états (position, vide, erreurs), URL |
| `components/RouteFields.tsx` | champs Départ / Arrivée, saisie, inversion |
| `components/PlannedTimeField.tsx` | ligne « Partir maintenant » et feuille Partir à / Arriver à |
| `components/Wheel.tsx` | colonne de roue (défilement aimanté, `listbox` accessible) |
| `components/ConnectionCard.tsx` | une carte de résultat (bouton → détail) |
| `components/ConnectionSheet.tsx` | feuille de détail : frise, arrêts intermédiaires, « Suivre » |
| `components/TripSheet.tsx` | suivi d'une étape (`onBack`, `alightId`) |
| `lib/connectionLabels.ts` | durée, changements, « Partir dans… », « Départ demain » |
| `components/StopBoard.tsx` | bouton « Y aller » |
