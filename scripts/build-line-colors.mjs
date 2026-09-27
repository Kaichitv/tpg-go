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
// Le fichier zip national fait ~290 Mo : plutôt que de tout télécharger, on lit
// le répertoire central du zip via des requêtes HTTP Range, puis on ne récupère
// que agency.txt et routes.txt (quelques centaines de Ko). Si le serveur ne gère
// pas Range, on se rabat sur un téléchargement complet en mémoire.
//
// Aucune dépendance : fetch + zlib natifs de Node ≥ 18.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

// Variables optionnelles lues depuis .env s'il existe (voir .env.example).
try {
  process.loadEnvFile?.(".env");
} catch {
  /* pas de .env : valeurs par défaut */
}

// Permalink CKAN du jeu « Timetable 2026 (GTFS2020) ». Il redirige vers la
// dernière version publiée (URL R2 présignée, valable ~60 s). Accès libre
// sans clé au moment de l'écriture.
const DEFAULT_GTFS_URL =
  "https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020/permalink";

const GTFS_URL = process.env.GTFS_URL || DEFAULT_GTFS_URL;
// Filtre agence : on compare à agency_name, agency_id et agency_url (insensible à la casse).
const AGENCY_MATCH = (process.env.GTFS_AGENCY || "Transports Publics Genevois|TPG|tpg.ch")
  .split("|")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const API_KEY = process.env.OTD_API_KEY;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "lib/lineColors.generated.json");
const FALLBACK = resolve(ROOT, "lib/lineColors.fallback.json");
const OVERRIDES = resolve(ROOT, "data/line-colors.overrides.json");
const TPG_LINES_URL = process.env.TPG_LINES_URL || "https://www.tpg.ch/fr/lignes";
/** Classes de texte des badges sur tpg.ch (CSS : `.line-logo.blanc span { color: white }`). */
const TPG_TEXT = { blanc: "#FFFFFF", noir: "#000000" };

const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};

// --- HTTP ------------------------------------------------------------------

/** Résout les redirections une fois pour obtenir l'URL finale (présignée). */
async function resolveUrl(url) {
  const res = await fetch(url, { headers: { ...headers, Range: "bytes=0-0" } });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return { url: res.url, total: res.status === 206 && total > 0 ? total : null };
}

async function range(url, start, end) {
  const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`Range non supporté (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// --- ZIP (lecture minimale : répertoire central + stored/deflate, zip64 inclus) ---

function findEocd(buf) {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Fin de répertoire central introuvable");
}

/** Renvoie { cdOffset, cdSize } à partir de la fin du fichier. */
function readEocd(tail, tailStart) {
  const i = findEocd(tail);
  let cdSize = tail.readUInt32LE(i + 12);
  let cdOffset = tail.readUInt32LE(i + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    // Zip64 : le localisateur précède l'EOCD.
    const loc = i - 20;
    if (tail.readUInt32LE(loc) !== 0x07064b50) throw new Error("Zip64 mal formé");
    const eocd64 = Number(tail.readBigUInt64LE(loc + 8)) - tailStart;
    cdSize = Number(tail.readBigUInt64LE(eocd64 + 40));
    cdOffset = Number(tail.readBigUInt64LE(eocd64 + 48));
  }
  return { cdOffset, cdSize };
}

function parseCentralDirectory(cd) {
  const entries = new Map();
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const method = cd.readUInt16LE(p + 10);
    let compSize = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nameLen);
    // Champs zip64 éventuels dans l'extra (id 0x0001), dans l'ordre size / compSize / offset.
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = cd.readUInt16LE(e);
      const len = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (compSize === 0xffffffff) { compSize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (offset === 0xffffffff) { offset = Number(cd.readBigUInt64LE(q)); }
      }
      e += 4 + len;
    }
    entries.set(name.split("/").pop(), { method, compSize, size, offset });
    p = eEnd + commentLen;
  }
  return entries;
}

function inflateEntry(entry, localAndData) {
  if (localAndData.readUInt32LE(0) !== 0x04034b50) throw new Error("En-tête local invalide");
  const nameLen = localAndData.readUInt16LE(26);
  const extraLen = localAndData.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  const data = localAndData.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Méthode de compression ${entry.method} non gérée`);
}

/** Lit certains fichiers du zip distant. Retourne Map<nom, Buffer>. */
async function readRemoteZip(url, wanted) {
  const { url: finalUrl, total } = await resolveUrl(url);
  const out = new Map();

  if (total) {
    const tailLen = Math.min(total, 128 * 1024);
    const tailStart = total - tailLen;
    const tail = await range(finalUrl, tailStart, total - 1);
    const { cdOffset, cdSize } = readEocd(tail, tailStart);
    const cd =
      cdOffset >= tailStart
        ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
        : await range(finalUrl, cdOffset, cdOffset + cdSize - 1);
    const entries = parseCentralDirectory(cd);
    for (const name of wanted) {
      const entry = entries.get(name);
      if (!entry) throw new Error(`${name} absent du GTFS`);
      // En-tête local : 30 o + nom + extra (marge de 1 Ko largement suffisante).
      const chunk = await range(finalUrl, entry.offset, entry.offset + 30 + 1024 + entry.compSize);
      out.set(name, inflateEntry(entry, chunk));
    }
    return out;
  }

  console.warn("⚠ Range non disponible : téléchargement complet du zip…");
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { cdOffset, cdSize } = readEocd(buf, 0);
  const entries = parseCentralDirectory(buf.subarray(cdOffset, cdOffset + cdSize));
  for (const name of wanted) {
    const entry = entries.get(name);
    if (!entry) throw new Error(`${name} absent du GTFS`);
    out.set(name, inflateEntry(entry, buf.subarray(entry.offset)));
  }
  return out;
}

// --- CSV (RFC 4180, suffisant pour le GTFS) ------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head = [], ...body] = rows;
  const cols = head.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? "").trim()])));
}

// --- Main ------------------------------------------------------------------------

const HEX = /^[0-9a-f]{6}$/i;

async function main() {
  console.log(`→ GTFS : ${GTFS_URL}`);
  const files = await readRemoteZip(GTFS_URL, ["agency.txt", "routes.txt"]);
  const agencies = parseCsv(files.get("agency.txt").toString("utf8"));
  const routes = parseCsv(files.get("routes.txt").toString("utf8"));

  const tpg = agencies.filter((a) =>
    [a.agency_name, a.agency_id, a.agency_url]
      .map((v) => (v ?? "").toLowerCase())
      .some((v) => AGENCY_MATCH.some((m) => v === m || v.includes(m)))
  );
  if (!tpg.length) throw new Error(`Aucune agence ne correspond à ${AGENCY_MATCH.join(" | ")}`);
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
