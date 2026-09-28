// scripts/lib/gtfs.mjs
//
// Lecture du GTFS statique OFFICIEL suisse (opentransportdata.swiss), partagée
// par les scripts build-time (couleurs de lignes, arrêts TPG).
//
// Le fichier zip national fait ~290 Mo : plutôt que de tout télécharger, on lit
// le répertoire central du zip via des requêtes HTTP Range, puis on ne récupère
// que les fichiers voulus. Les petits fichiers sont lus en mémoire ; les gros
// (trips.txt, stop_times.txt : plusieurs Go décompressés) sont lus en flux,
// ligne par ligne.
//
// Aucune dépendance : fetch + zlib natifs de Node ≥ 18.

import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createInflateRaw, inflateRawSync } from "node:zlib";

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

export const GTFS_URL = process.env.GTFS_URL || DEFAULT_GTFS_URL;
// Filtre agence : on compare à agency_name, agency_id et agency_url (insensible à la casse).
const AGENCY_MATCH = (process.env.GTFS_AGENCY || "Transports Publics Genevois|TPG|tpg.ch")
  .split("|")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const API_KEY = process.env.OTD_API_KEY;

const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};

/** Agences TPG de agency.txt (au moins une, sinon erreur). */
export function findTpgAgencies(agencies) {
  const tpg = agencies.filter((a) =>
    [a.agency_name, a.agency_id, a.agency_url]
      .map((v) => (v ?? "").toLowerCase())
      .some((v) => AGENCY_MATCH.some((m) => v === m || v.includes(m)))
  );
  if (!tpg.length) throw new Error(`Aucune agence ne correspond à ${AGENCY_MATCH.join(" | ")}`);
  return tpg;
}

// --- HTTP ------------------------------------------------------------------

/** Résout les redirections une fois pour obtenir l'URL finale (présignée). */
async function resolveUrl(url) {
  const res = await fetch(url, { headers: { ...headers, Range: "bytes=0-0" } });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return { url: res.url, total: res.status === 206 && total > 0 ? total : null };
}

async function rangeResponse(url, start, end) {
  const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new Error(`Range non supporté (HTTP ${res.status})`);
  }
  return res;
}

async function range(url, start, end) {
  return Buffer.from(await (await rangeResponse(url, start, end)).arrayBuffer());
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

/** Taille de l'en-tête local (30 o + nom + extra) qui précède les données d'une entrée. */
function localHeaderSize(local) {
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error("En-tête local invalide");
  return 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
}

function inflateEntry(entry, localAndData) {
  const start = localHeaderSize(localAndData);
  const data = localAndData.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Méthode de compression ${entry.method} non gérée`);
}

/** URL finale + répertoire central du zip distant (null si Range indisponible). */
async function openRemoteZip(url) {
  const { url: finalUrl, total } = await resolveUrl(url);
  if (!total) return null;
  const tailLen = Math.min(total, 128 * 1024);
  const tailStart = total - tailLen;
  const tail = await range(finalUrl, tailStart, total - 1);
  const { cdOffset, cdSize } = readEocd(tail, tailStart);
  const cd =
    cdOffset >= tailStart
      ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
      : await range(finalUrl, cdOffset, cdOffset + cdSize - 1);
  return { url: finalUrl, entries: parseCentralDirectory(cd) };
}

function entryOf(entries, name) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`${name} absent du GTFS`);
  return entry;
}

/** Lit certains fichiers du zip distant. Retourne Map<nom, Buffer>. */
export async function readRemoteZip(url, wanted) {
  const zip = await openRemoteZip(url);
  const out = new Map();

  if (zip) {
    for (const name of wanted) {
      const entry = entryOf(zip.entries, name);
      // En-tête local : 30 o + nom + extra (marge de 1 Ko largement suffisante).
      const chunk = await range(zip.url, entry.offset, entry.offset + 30 + 1024 + entry.compSize);
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
    out.set(name, inflateEntry(entryOf(entries, name), buf.subarray(entries.get(name).offset)));
  }
  return out;
}

/**
 * Lit un fichier du zip distant en flux, ligne par ligne, sans le charger en
 * mémoire. L'URL présignée n'étant valable que ~60 s, on la résout à chaque
 * appel. Exige le support de Range (pas de repli sur un téléchargement complet).
 */
export async function* remoteZipLines(url, name) {
  const zip = await openRemoteZip(url);
  if (!zip) throw new Error("Range non disponible : lecture en flux impossible");
  const entry = entryOf(zip.entries, name);
  if (entry.method !== 0 && entry.method !== 8) {
    throw new Error(`Méthode de compression ${entry.method} non gérée`);
  }
  const local = await range(zip.url, entry.offset, entry.offset + 30 + 1024);
  const start = entry.offset + localHeaderSize(local);
  const res = await rangeResponse(zip.url, start, start + entry.compSize - 1);

  let stream = Readable.fromWeb(res.body);
  if (entry.method === 8) stream = stream.pipe(createInflateRaw());
  yield* createInterface({ input: stream, crlfDelay: Infinity });
}

// --- CSV (RFC 4180, suffisant pour le GTFS) ------------------------------------

export function parseCsv(text) {
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
  const cols = head.map(cleanHeader);
  return body.map((r) => Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? "").trim()])));
}

/**
 * Découpe une ligne CSV isolée (fichiers lus en flux). Les champs GTFS ne
 * contiennent pas de retour à la ligne, une ligne = un enregistrement.
 * Découpe par indexOf/slice plutôt que caractère par caractère : le GTFS
 * suisse met tous les champs entre guillemets et stop_times.txt fait ~3,6 Go.
 */
export function splitCsvLine(line) {
  const out = [];
  const n = line.length;
  let i = 0;
  for (;;) {
    if (line.charCodeAt(i) === 34 /* " */) {
      let field = "";
      let j = i + 1;
      for (;;) {
        const q = line.indexOf('"', j);
        if (q < 0) { field += line.slice(j); i = n; break; }
        field += line.slice(j, q);
        if (line.charCodeAt(q + 1) === 34) { field += '"'; j = q + 2; continue; }
        i = q + 1;
        break;
      }
      out.push(field);
    } else {
      const c = line.indexOf(",", i);
      const end = c < 0 ? n : c;
      out.push(line.slice(i, end));
      i = end;
    }
    if (i >= n) return out;
    i++; // virgule
  }
}

/** Index des colonnes voulues dans une ligne d'en-tête ; erreur si l'une manque. */
export function columnIndex(headerLine, file, wanted) {
  const cols = splitCsvLine(headerLine).map(cleanHeader);
  return Object.fromEntries(
    wanted.map((c) => {
      const i = cols.indexOf(c);
      if (i < 0) throw new Error(`Colonne ${c} absente de ${file}`);
      return [c, i];
    })
  );
}

function cleanHeader(h) {
  return h.replace(/^﻿/, "").trim();
}
