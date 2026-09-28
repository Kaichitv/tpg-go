// lib/stopIndex.ts
// Index des arrêts du réseau TPG, côté serveur uniquement (82 Ko de JSON).
// Source : snapshot lib/tpgStops.json, extrait du GTFS officiel par
// scripts/build-tpg-stops.mjs (`npm run build:stops`, à relancer à chaque
// changement d'horaire annuel). Les identifiants sont ceux qu'attend la
// source live pour les passages.

import type { NearbyStop, Stop, StopKind } from "./types";
import data from "./tpgStops.json";

/** Rayon au-delà duquel un arrêt n'est plus « à proximité ». */
const NEARBY_RADIUS_M = 2000;

const KINDS: readonly StopKind[] = ["tram", "bus", "train", "boat", "other"];

type Entry = {
  stop: Stop;
  /** Nom complet normalisé : « genève, bel-air » → « geneve bel air ». */
  full: string;
  /** Mots du nom complet. */
  words: string[];
  /** Partie après la localité : « bel air ». */
  local: string;
  localWords: string[];
  /** Nom sans espaces, pour « belair » ou « pontrouge ». */
  compact: string;
};

const INDEX: Entry[] = data.stops.map((s) => {
  const stop: Stop = {
    id: s.id,
    name: s.name,
    kind: KINDS.find((k) => k === s.kind) ?? "other",
    lat: s.lat,
    lon: s.lon,
  };
  const comma = s.name.indexOf(",");
  const full = fold(s.name);
  const local = comma < 0 ? full : fold(s.name.slice(comma + 1));
  return {
    stop,
    full,
    words: full.split(" "),
    local,
    localWords: local.split(" "),
    compact: full.replaceAll(" ", ""),
  };
});

/**
 * Arrêts TPG dont le nom correspond à la saisie (insensible à la casse, aux
 * accents et à la ponctuation). Chaque mot saisi doit commencer un mot du nom.
 * Les arrêts dont le nom propre (hors localité) correspond passent devant.
 */
export function searchTpgStops(query: string, limit: number): Stop[] {
  const q = fold(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const qCompact = q.replaceAll(" ", "");

  const hits: { stop: Stop; score: number }[] = [];
  for (const e of INDEX) {
    const matches =
      tokens.every((t) => e.words.some((w) => w.startsWith(t))) || e.compact.includes(qCompact);
    if (!matches) continue;
    const score = e.local.startsWith(q)
      ? 0
      : e.localWords.some((w) => w.startsWith(tokens[0]))
        ? 1
        : e.full.startsWith(q)
          ? 2
          : 3;
    hits.push({ stop: e.stop, score });
  }

  // Tri stable : à score égal, le nom le plus court, puis l'ordre alphabétique du snapshot.
  return hits
    .sort((a, b) => a.score - b.score || a.stop.name.length - b.stop.name.length)
    .slice(0, limit)
    .map((h) => h.stop);
}

/** Arrêts TPG les plus proches d'une position (WGS84), à moins de NEARBY_RADIUS_M. */
export function nearestTpgStops(lat: number, lon: number, limit: number): NearbyStop[] {
  return INDEX.map(({ stop }) => ({
    ...stop,
    distanceM: Math.round(distanceM(lat, lon, stop.lat ?? NaN, stop.lon ?? NaN)),
  }))
    .filter((s) => s.distanceM <= NEARBY_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** Minuscules, sans accents, ponctuation → espace. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Distance à vol d'oiseau (haversine), en mètres. */
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}
