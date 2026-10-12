# v2 : source officielle OJP 2.0

**Statut : à tester** (décidé le 2026-10-12). Rien n'est migré : la v1 lit toujours
transport.opendata.ch. Pour la v2, on testera l'API **OJP 2.0** de opentransportdata.swiss comme
source live, derrière `lib/transport.ts`, sans toucher aux types ni à l'UI.

## Pourquoi changer de source

Le temps réel TPG existe déjà dans la source v1. Il vient du même hub national que les flux
officiels : au 2026-10-12, à Cornavin, 16 passages TPG sur 17 avaient une prévision, avec la
séquence d'arrêts complète. Un flux officiel n'apportera donc pas *plus* de temps réel, mais il
peut corriger les limites de la v1 :

- prévisions **arrondies à la minute** (toujours `:00` seconde), d'où des comptes à rebours
  approximatifs ;
- **aucune information sur les courses supprimées** ni sur les arrêts non desservis ;
- API communautaire sans quota annoncé ni engagement de service.

## Pourquoi pas GTFS-RT

L'ancienne roadmap prévoyait le GTFS-RT officiel « pour la position réelle ». C'était une erreur :

- **Pas de positions de véhicules** : la plateforme ne publie que les Trip Updates et les Service
  Alerts, pas de `VehiclePosition`. Aucune source publique trouvée ne donne la position GPS des
  véhicules TPG.
- **Un seul fichier pour toute la Suisse**, rafraîchi toutes les 30 s et limité à 2 requêtes/min
  par clé selon le cookbook, ou 5 selon la page des limites (contradictoire). Le cache mémoire de
  `lib/transport.ts` vit dans chaque instance serverless, donc plusieurs instances dépasseraient
  la limite. Il faudrait un cache partagé et un worker toutes les 30 s.
- **Les `trip_id` dépendent de la version du GTFS statique**, publiée le lundi et le jeudi. Il
  faudrait extraire les courses TPG deux fois par semaine et construire notre propre moteur
  d'horaires.
- Pas de calcul d'itinéraires : il faudrait de toute façon une autre source pour les connexions.

## Ce que remplacerait OJP 2.0

| `lib/transport.ts` | Route | Requête OJP 2.0 |
| --- | --- | --- |
| `getDepartures` | `/api/departures` | `StopEventRequest` |
| `getTrip` | `/api/trip` | `TripInfoRequest` |
| `getConnections` | `/api/connections` | `TripRequest` |
| `searchStops` | `/api/locations` | aucune : reste sur l'index TPG local |

## Ce que le test doit vérifier

Avant toute migration, un script `npm run test:ojp "Bel-Air"` (à écrire, sur le modèle de
`test:api`) comparera les deux sources sur les mêmes arrêts :

1. **Précision** : les heures estimées sont-elles plus fines que la minute ?
2. **Suppressions** : les courses supprimées et les arrêts non desservis sont-ils signalés pour
   TPG ?
3. **Perturbations** : les réponses contiennent-elles les situations (SIRI-SX) liées à l'arrêt ou
   à la ligne ?
4. **Couverture** : même proportion de passages TPG avec temps réel que la v1, y compris les
   arrêts en France (`14xxxxx`).
5. **Identifiants** : les ids DIDOK de `lib/tpgStops.json` sont-ils acceptés tels quels ?
6. **Coût** : latence, taille des réponses XML, consommation journalière estimée avec le cache
   actuel (20 s pour les passages, 30 s pour les itinéraires).

La clé se met dans `OTD_API_KEY` (déjà prévue dans `.env.example`), côté serveur uniquement.

## Contraintes

- **Quotas gratuits** : 50 requêtes/min et 20 000/jour par clé (au-delà, à partir de
  500 CHF/mois). Comme le cache est propre à chaque instance, la consommation réelle dépassera
  le simple calcul « une requête par arrêt toutes les 20 s ».
- **Format XML** : il faudra un parseur côté serveur.
- **Invariants inchangés** : ids DIDOK uniquement. OJP accepte des coordonnées, mais on ne lui en
  enverra jamais : le départ depuis ma position reste calculé sur l'appareil (`lib/walk.ts`).
- Si on migre : rendre `OTD_API_KEY` obligatoire au runtime (`.env.example`, Vercel), mettre à
  jour la page de confidentialité (nouveau sous-traitant) et le README.

## Ce que la v2 ne promettra pas

La position GPS des véhicules. Le suivi de trajet restera **déduit des horaires**. Au mieux, on
pourra placer le véhicule entre deux arrêts d'après les heures estimées, toujours affiché comme
« estimé ».

## Sources (consultées le 2026-10-12)

- [GTFS-RT, cookbook](https://opentransportdata.swiss/en/cookbook/realtime-prediction-cookbook/gtfs-rt/)
- [Limits and costs](https://opentransportdata.swiss/en/limits-and-costs/)
- [GTFS-RT Service Alerts](https://opentransportdata.swiss/en/cookbook/event-cookbook/gtfs-sa/)
- [Open Journey Planner 2.0](https://opendata.swiss/en/perma/ojp2-0@oevch)
