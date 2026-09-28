#!/usr/bin/env node
// scripts/build-line-colors.mjs
//
// Génère lib/lineColors.generated.json à partir du GTFS statique OFFICIEL suisse
// (opentransportdata.swiss) : route_short_name → { bg: route_color, fg: route_text_color }
// pour les lignes de l'agence TPG.
//
// Usage :
//   npm run build:colors                      # permalink par défaut (horaire 2026)
//   GTFS_URL=<url> npm run build:colors       # autre jeu (ex. horaire 2027 dès décembre)
//   GTFS_AGENCY="Transports Publics Genevois" npm run build:colors
//   OTD_API_KEY=<clé> npm run build:colors    # seulement si le téléchargement exige un jour une clé
//
// ⚠ État constaté (sept. 2026) : le routes.txt national suisse ne contient PAS les
// colonnes route_color / route_text_color. Le script les lit dès qu'elles existent,
// et fusionne par-dessus data/line-colors.overrides.json (couleurs saisies à la main
// depuis une source officielle TPG). Sans couleur, le runtime utilise l'orange TPG.
//
// Complément officiel : la liste des lignes publiée par les TPG sur
// https://www.tpg.ch/fr/lignes embarque un objet JS `lignes={…}` (couleur de fond
// + classe « blanc » / « noir » pour le texte). Il ne comble QUE les lignes sans
// route_color dans le GTFS, qui reste prioritaire.
//
// Sorties :
//   lib/lineColors.fallback.json  — snapshot COMMITÉ lu par le runtime,
//                                   { "<ligne>": { "bg": "#RRGGBB", "text": "#RRGGBB" } }
//   lib/lineColors.generated.json — rapport complet (source, stats), gitignoré
// Si tpg.ch est injoignable, le snapshot existant n'est pas écrasé.
//
// Lecture du GTFS (HTTP Range, zip, CSV) : voir scripts/lib/gtfs.mjs.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GTFS_URL, findTpgAgencies, parseCsv, readRemoteZip } from "./lib/gtfs.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "lib/lineColors.generated.json");
const FALLBACK = resolve(ROOT, "lib/lineColors.fallback.json");
const OVERRIDES = resolve(ROOT, "data/line-colors.overrides.json");
const TPG_LINES_URL = process.env.TPG_LINES_URL || "https://www.tpg.ch/fr/lignes";
/** Classes de texte des badges sur tpg.ch (CSS : `.line-logo.blanc span { color: white }`). */
const TPG_TEXT = { blanc: "#FFFFFF", noir: "#000000" };

// --- Main ------------------------------------------------------------------------

const HEX = /^[0-9a-f]{6}$/i;

async function main() {
  console.log(`→ GTFS : ${GTFS_URL}`);
  const files = await readRemoteZip(GTFS_URL, ["agency.txt", "routes.txt"]);
  const agencies = parseCsv(files.get("agency.txt").toString("utf8"));
  const routes = parseCsv(files.get("routes.txt").toString("utf8"));

  const tpg = findTpgAgencies(agencies);
  const ids = new Set(tpg.map((a) => a.agency_id));
  console.log(`→ Agence(s) : ${tpg.map((a) => `${a.agency_name} [${a.agency_id}]`).join(", ")}`);

  const known = new Set();
  const lines = {};
  for (const r of routes) {
    if (!ids.has(r.agency_id)) continue;
    const name = r.route_short_name || r.route_long_name;
    if (!name) continue;
    known.add(name);
    const bg = HEX.test(r.route_color ?? "") ? `#${r.route_color.toUpperCase()}` : null;
    const fg = HEX.test(r.route_text_color ?? "") ? `#${r.route_text_color.toUpperCase()}` : null;
    // Une même ligne peut avoir plusieurs route_id : on garde la première couleur vue.
    if (bg) lines[name] ??= fg ? { bg, fg } : { bg };
  }
  const fromGtfs = Object.keys(lines).length;

  // Complément officiel tpg.ch pour les lignes que le GTFS ne colore pas.
  let tpgSite = null;
  try {
    tpgSite = await readTpgSiteColors();
  } catch (err) {
    console.warn(`⚠ Liste officielle tpg.ch indisponible (${err.message}) : snapshot conservé.`);
  }
  let fromTpgSite = 0;
  for (const [name, c] of Object.entries(tpgSite ?? {})) {
    if (lines[name]) continue;
    lines[name] = c.fg ? { bg: c.bg, fg: c.fg } : { bg: c.bg };
    fromTpgSite++;
  }
  if (tpgSite) {
    const siteOnly = Object.keys(tpgSite).filter((n) => !known.has(n));
    const gtfsOnly = [...known].filter((n) => !tpgSite[n]);
    console.log(`→ tpg.ch : ${Object.keys(tpgSite).length} lignes, ${fromTpgSite} ajoutées.`);
    if (siteOnly.length) console.log(`ℹ Sur tpg.ch mais pas dans le GTFS : ${siteOnly.join(", ")}`);
    if (gtfsOnly.length) console.log(`ℹ Dans le GTFS sans couleur tpg.ch : ${gtfsOnly.join(", ")}`);
  }

  // Surcharges manuelles (sources officielles TPG), prioritaires sur le GTFS.
  const overrides = await readOverrides();
  for (const [name, c] of Object.entries(overrides)) {
    const bg = normHex(c?.bg);
    if (!bg) { console.warn(`⚠ override ignoré pour « ${name} » (bg invalide)`); continue; }
    const fg = normHex(c?.fg);
    lines[name] = fg ? { bg, fg } : { bg };
  }

  const byName = ([a], [b]) => a.localeCompare(b, "fr", { numeric: true });
  const payload = {
    source: GTFS_URL,
    tpgSite: TPG_LINES_URL,
    generatedAt: new Date().toISOString(),
    agencies: tpg.map((a) => a.agency_id),
    stats: {
      tpgLines: known.size,
      colorsFromGtfs: fromGtfs,
      colorsFromTpgSite: fromTpgSite,
      colorsFromOverrides: Object.keys(overrides).length,
    },
    lines: Object.fromEntries(Object.entries(lines).sort(byName)),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");

  // Snapshot committé : uniquement si la liste officielle a pu être lue, pour ne
  // jamais remplacer un filet complet par un résultat partiel.
  if (tpgSite) {
    const snapshot = Object.fromEntries(
      Object.entries(lines)
        .sort(byName)
        .map(([name, c]) => [name, c.fg ? { bg: c.bg, text: c.fg } : { bg: c.bg }])
    );
    await writeFile(FALLBACK, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(`✓ Snapshot ${Object.keys(snapshot).length} lignes → ${FALLBACK}`);
  }
  console.log(`✓ ${known.size} lignes TPG dans le GTFS, ${fromGtfs} avec route_color.`);
  console.log(`✓ ${Object.keys(lines).length} lignes colorées au total → ${OUT}`);
  if (Object.keys(lines).length < known.size) {
    console.log(
      `ℹ Les lignes sans couleur utiliseront l'orange TPG. Pour les compléter : ${OVERRIDES}`
    );
  }
}

function normHex(v) {
  const s = String(v ?? "").replace(/^#/, "");
  return HEX.test(s) ? `#${s.toUpperCase()}` : null;
}

/**
 * Lit l'objet `lignes={…}` de la page officielle des lignes TPG.
 * Retourne { "<ligne>": { bg, fg? } }.
 */
async function readTpgSiteColors() {
  const res = await fetch(TPG_LINES_URL, { headers: { "User-Agent": "tpg-go build-line-colors" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const start = html.indexOf("lignes={");
  if (start < 0) throw new Error("objet `lignes` introuvable dans la page");
  // Parcours des accolades hors chaînes pour isoler l'objet JSON.
  let depth = 0;
  let inString = false;
  let end = -1;
  for (let i = start + "lignes=".length; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error("objet `lignes` tronqué");
  const raw = JSON.parse(html.slice(start + "lignes=".length, end));

  const out = {};
  for (const [name, l] of Object.entries(raw)) {
    const bg = normHex(l?.couleur?.color);
    if (!bg) continue;
    const cls = String(l?.couleur?.classes ?? "").split(/\s+/);
    const fg = cls.includes("blanc") ? TPG_TEXT.blanc : cls.includes("noir") ? TPG_TEXT.noir : null;
    out[name.trim()] = fg ? { bg, fg } : { bg };
  }
  if (!Object.keys(out).length) throw new Error("aucune couleur lue");
  return out;
}

async function readOverrides() {
  try {
    const json = JSON.parse(await readFile(OVERRIDES, "utf8"));
    return json.lines ?? {};
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw new Error(`Overrides illisibles (${OVERRIDES}) : ${err.message}`);
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
