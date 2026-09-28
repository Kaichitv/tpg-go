#!/usr/bin/env node
// scripts/build-tpg-stops.mjs
//
// Génère lib/tpgStops.json : la liste des arrêts desservis par au moins une
// course TPG, d'après le GTFS statique OFFICIEL suisse (opentransportdata.swiss).
// Le runtime cherche les arrêts (par nom, à proximité) dans ce snapshot plutôt
// que dans la recherche nationale de la source live, qui mélange toute la Suisse
// et ne renvoie que 10 résultats.
//
// Usage :
//   npm run build:stops                       # permalink par défaut (horaire 2026)
//   GTFS_URL=<url> npm run build:stops        # autre jeu (ex. horaire 2027 dès décembre)
//   (mêmes variables que build:colors, voir .env.example)
//
// Chaîne : agency.txt (TPG) → routes.txt (lignes TPG + type) → trips.txt (courses
// TPG, lu en flux) → stop_times.txt (arrêts de ces courses, ~3,6 Go lus en flux)
// → stops.txt (nom, position, identifiant DIDOK). Compter quelques minutes.
//
// Identifiant : la colonne `didok` de stops.txt (ex. 8587387), c'est-à-dire
// l'identifiant numérique qu'attend la source live pour les passages. Tous les
// quais d'un arrêt partagent le même DIDOK et sont regroupés en un seul arrêt.
//
// Sortie : lib/tpgStops.json — snapshot COMMITÉ lu par le runtime. Il n'est pas
// écrasé si le résultat paraît incomplet (moins de MIN_STOPS arrêts).
//
// Lecture du GTFS (HTTP Range, zip, CSV) : voir scripts/lib/gtfs.mjs.

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GTFS_URL,
  columnIndex,
  findTpgAgencies,
  parseCsv,
  readRemoteZip,
  remoteZipLines,
  splitCsvLine,
} from "./lib/gtfs.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "lib/tpgStops.json");
/** Garde-fou : le réseau TPG compte plusieurs centaines d'arrêts. */
const MIN_STOPS = 200;

/** Priorité d'affichage quand un arrêt est desservi par plusieurs modes. */
const KIND_ORDER = ["tram", "train", "boat", "bus", "other"];

/** route_type GTFS (de base ou étendu) → StopKind de lib/types.ts. */
function kindOf(routeType) {
  const t = Number(routeType);
  if (t === 0 || (t >= 900 && t < 1000)) return "tram";
  if (t === 3 || (t >= 700 && t < 800)) return "bus";
  if (t === 2 || (t >= 100 && t < 200)) return "train";
  if (t === 4 || (t >= 1000 && t < 1100) || t === 1200) return "boat";
  return "other";
}

async function main() {
  console.log(`→ GTFS : ${GTFS_URL}`);
  const files = await readRemoteZip(GTFS_URL, ["agency.txt", "routes.txt", "stops.txt"]);
  const tpg = findTpgAgencies(parseCsv(files.get("agency.txt").toString("utf8")));
  const agencyIds = new Set(tpg.map((a) => a.agency_id));
  console.log(`→ Agence(s) : ${tpg.map((a) => `${a.agency_name} [${a.agency_id}]`).join(", ")}`);

  // route_id → mode
  const routeKind = new Map();
  for (const r of parseCsv(files.get("routes.txt").toString("utf8"))) {
    if (agencyIds.has(r.agency_id)) routeKind.set(r.route_id, kindOf(r.route_type));
  }
  console.log(`→ ${routeKind.size} lignes TPG`);

  // trip_id → mode
  const tripKind = new Map();
  let col;
  for await (const line of remoteZipLines(GTFS_URL, "trips.txt")) {
    if (!col) { col = columnIndex(line, "trips.txt", ["route_id", "trip_id"]); continue; }
    const f = splitCsvLine(line);
    const kind = routeKind.get(f[col.route_id]);
    if (kind) tripKind.set(f[col.trip_id], kind);
  }
  console.log(`→ ${tripKind.size} courses TPG`);
  if (!tripKind.size) throw new Error("Aucune course TPG dans trips.txt");

  // stop_id (quai) → modes qui le desservent
  const stopKinds = new Map();
  col = undefined;
  let rows = 0;
  for await (const line of remoteZipLines(GTFS_URL, "stop_times.txt")) {
    if (!col) { col = columnIndex(line, "stop_times.txt", ["trip_id", "stop_id"]); continue; }
    if (++rows % 5_000_000 === 0) process.stdout.write(`  … ${rows / 1e6} M passages lus\r`);
    const f = splitCsvLine(line);
    const kind = tripKind.get(f[col.trip_id]);
    if (!kind) continue;
    const id = f[col.stop_id];
    let kinds = stopKinds.get(id);
    if (!kinds) stopKinds.set(id, (kinds = new Set()));
    kinds.add(kind);
  }
  console.log(`→ ${rows.toLocaleString("fr-CH")} passages lus, ${stopKinds.size} quais TPG`);

  // Regroupement des quais par DIDOK ; nom et position de l'arrêt parent.
  const stops = parseCsv(files.get("stops.txt").toString("utf8"));
  const byId = new Map(stops.map((s) => [s.stop_id, s]));
  const out = new Map();
  let noDidok = 0;
  for (const [stopId, kinds] of stopKinds) {
    const quay = byId.get(stopId);
    if (!quay?.didok) { noDidok++; continue; }
    const parent = byId.get(quay.parent_station) ?? quay;
    const entry = out.get(quay.didok) ?? {
      id: quay.didok,
      name: parent.stop_name,
      lat: round(parent.stop_lat),
      lon: round(parent.stop_lon),
      kinds: new Set(),
    };
    for (const k of kinds) entry.kinds.add(k);
    out.set(quay.didok, entry);
  }
  if (noDidok) console.warn(`⚠ ${noDidok} quai(s) sans identifiant DIDOK ignoré(s)`);

  const list = [...out.values()]
    .map(({ kinds, ...s }) => ({ ...s, kind: KIND_ORDER.find((k) => kinds.has(k)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));

  if (list.length < MIN_STOPS) {
    throw new Error(`Seulement ${list.length} arrêts : résultat suspect, snapshot conservé`);
  }

  // Un arrêt par ligne : diff lisible au changement d'horaire.
  const body = list.map((s) => `    ${JSON.stringify(s)}`).join(",\n");
  const meta = { source: GTFS_URL, generatedAt: new Date().toISOString() };
  const json = JSON.stringify(meta, null, 2).replace(/\n}$/, `,\n  "stops": [\n${body}\n  ]\n}\n`);
  await writeFile(OUT, json);
  console.log(`✓ ${list.length} arrêts TPG → ${OUT}`);
}

/** Coordonnée arrondie à 5 décimales (~1 m). */
function round(v) {
  return Math.round(Number(v) * 1e5) / 1e5;
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
