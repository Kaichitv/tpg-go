# TPG en direct

Petite PWA Next.js pour voir les prochains passages TPG en temps réel.
Prête à héberger sur Vercel (offre gratuite) et à installer sur mobile.

## Lancer en local

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Tester la source de données sans rien lancer

```bash
npm run test:api "Bel-Air"
# ou
node scripts/test-api.mjs "Genève, Cornavin"
```

## D'où viennent les données

- Source actuelle : **transport.opendata.ch** (API communautaire, REST/JSON, sans clé).
  Les appels passent par des routes serveur Next.js (`app/api/*`) : pas de CORS,
  cache de 20 s, et l'API amont est protégée.
- Champs temps réel exposés : heure prédite (`prognosis.departure`) et retard (`delay`).
  Ils peuvent être absents quand aucune donnée temps réel n'est disponible.

### Limites à connaître

- API communautaire plafonnée (~1000 req/jour/IP historiquement) → d'où le cache serveur.
- Le temps réel n'est pas *officiellement garanti* pour l'urbain.

### Passer à la source officielle (plus tard)

Pour du temps réel officiel (Office fédéral des transports), remplacer le `fetch`
dans `app/api/departures/route.ts` par un appel **OJP 2.0 `StopEventRequest`** sur
`opentransportdata.swiss` (clé gratuite via `api-manager.opentransportdata.swiss`,
requête XML). Le front ne change pas.

## Déployer sur Vercel

1. Pousser ce dossier sur un repo GitHub.
2. Sur vercel.com : *New Project* → importer le repo → *Deploy* (aucune variable
   d'environnement nécessaire pour la version actuelle).
3. Ouvrir l'URL sur mobile → menu du navigateur → *Ajouter à l'écran d'accueil*.

## Structure

```
app/
  page.tsx              écran principal (recherche d'arrêt + tableau des passages)
  layout.tsx            + enregistrement du service worker
  manifest.ts           manifest PWA
  api/departures/route.ts   prochains passages (cœur de la récupération)
  api/locations/route.ts    recherche d'arrêts
public/
  sw.js                 service worker (coquille hors-ligne, jamais de cache API)
  icons/                icônes PWA
scripts/test-api.mjs    test rapide de la source
```
