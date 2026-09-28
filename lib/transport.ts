// lib/transport.ts
// Couche d'accès aux données live, côté serveur uniquement.
// Source v1 : API communautaire transport.opendata.ch (sans clé).
// C'est le SEUL fichier qui connaît la source : pour passer à l'OJP officiel
// (opentransportdata.swiss), on réécrit ce module sans toucher aux types ni à l'UI.
// Les arrêts (recherche, proximité) viennent de l'index TPG local (lib/stopIndex.ts) :
// la recherche de la source couvre toute la Suisse et plafonne à 10 résultats.

import { nearestTpgStops, searchTpgStops } from "./stopIndex";
import type {
  Board,
  Departure,
  NearbyStop,
  Stop,
  StopKind,
  TimePoint,
  Trip,
  TripQuery,
  TripStop,
} from "./types";

const BASE = "https://transport.opendata.ch/v1";
const TZ = "Europe/Zurich";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// --- Formes brutes de la source (uniquement les champs utilisés) -----------------

type RawStation = {
  id?: string | null;
  name?: string | null;
  icon?: string | null;
  coordinate?: { x?: number | null; y?: number | null } | null;
};

type RawCheckpoint = {
  station?: RawStation | null;
  arrival?: string | null;
  departure?: string | null;
  delay?: number | null;
  platform?: string | null;
  prognosis?: {
    arrival?: string | null;
    departure?: string | null;
    platform?: string | null;
  } | null;
};

type RawJourney = {
  name?: string | null;
  number?: string | null;
  category?: string | null;
  operator?: string | null;
  to?: string | null;
  stop?: RawCheckpoint | null;
  passList?: RawCheckpoint[] | null;
};

type RawStationboard = { station?: RawStation | null; stationboard?: RawJourney[] | null };

// --- API publique ------------------------------------------------------------------

/** Arrêts du réseau TPG dont le nom correspond à la saisie. */
export async function searchStops(query: string): Promise<Stop[]> {
  return searchTpgStops(query, 20);
}

/** Arrêts TPG les plus proches d'une position (WGS84), du plus proche au plus loin. */
export async function nearbyStops(lat: number, lon: number): Promise<NearbyStop[]> {
  return nearestTpgStops(lat, lon, 10);
}

/**
 * Prochains départs d'un arrêt.
 * @param stop identifiant numérique (recommandé) ou nom exact de l'arrêt
 */
export async function getDepartures(stop: string, limit = 12): Promise<Board> {
  const byId = /^\d+$/.test(stop);
  const data = await get<RawStationboard>(
    `/stationboard?${qs({ [byId ? "id" : "station"]: stop, limit: String(limit) })}`,
    20, // cache court : les mobiles peuvent poller sans marteler l'API amont
  );
  if (!data.station?.name) throw new NotFoundError(`Arrêt introuvable : ${stop}`);

  const station = toStop(data.station);
  const departures = (data.stationboard ?? [])
    .map((j) => toDeparture(j, station))
    .filter((d): d is Departure => d !== null);

  return { stop: station, updatedAt: new Date().toISOString(), departures };
}

/**
 * Retrouve une course à un arrêt donné pour rafraîchir la suite de son trajet.
 * On interroge le tableau des départs de l'arrêt d'ancrage autour de l'heure
 * théorique, et on repère la course par son identifiant + numéro de ligne.
 */
export async function getTrip(q: TripQuery): Promise<Trip> {
  const at = new Date(q.at);
  if (Number.isNaN(at.getTime())) throw new NotFoundError("Heure invalide");
  at.setMinutes(at.getMinutes() - 2);

  const data = await get<RawStationboard>(
    `/stationboard?${qs({ id: q.stopId, datetime: zurichDateTime(at), limit: "40" })}`,
    20,
  );
  const journey = (data.stationboard ?? []).find(
    (j) => j.name === q.journey && (j.number ?? j.name) === q.line,
  );
  if (!journey || !data.station) throw new NotFoundError("Course introuvable à cet arrêt");

  const station = toStop(data.station);
  const dep = toDeparture(journey, station);
  if (!dep) throw new NotFoundError("Course incomplète");

  return {
    journey: dep.journey,
    line: dep.line,
    category: dep.category,
    destination: dep.destination,
    updatedAt: new Date().toISOString(),
    stops: dep.stops,
  };
}

// --- Mapping -----------------------------------------------------------------------

function toStop(s: RawStation): Stop {
  return {
    id: s.id ?? "",
    name: s.name ?? "",
    kind: toKind(s.icon),
    lat: s.coordinate?.x ?? null,
    lon: s.coordinate?.y ?? null,
  };
}

function toKind(icon: string | null | undefined): StopKind {
  switch (icon) {
    case "tram":
    case "bus":
    case "train":
    case "boat":
      return icon;
    default:
      return "other";
  }
}

function toDeparture(j: RawJourney, station: Stop): Departure | null {
  const s = j.stop;
  const scheduled = iso(s?.departure);
  if (!s || !scheduled) return null;

  const delayMin = typeof s.delay === "number" ? s.delay : null;
  const realtime = iso(s.prognosis?.departure) ?? shift(scheduled, delayMin);
  const journey = j.name ?? "";
  const line = j.number ?? j.name ?? "?";

  const stops = (j.passList ?? []).map((c, i) =>
    // Le 1er élément du passList est l'arrêt interrogé, mais sans nom et avec
    // l'identifiant d'un quai : on le remplace par l'arrêt lui-même.
    toTripStop(c, i === 0 ? station : null),
  );

  return {
    key: `${journey}@${scheduled}`,
    journey,
    line,
    category: j.category ?? "",
    operator: j.operator ?? null,
    destination: j.to ?? "",
    scheduled,
    realtime,
    delayMin,
    platform: s.prognosis?.platform ?? s.platform ?? null,
    stops,
  };
}

function toTripStop(c: RawCheckpoint, self: Stop | null): TripStop {
  const delayMin = typeof c.delay === "number" ? c.delay : null;
  return {
    id: self?.id ?? c.station?.id ?? "",
    name: self?.name ?? c.station?.name ?? "",
    arrival: timePoint(c.arrival, c.prognosis?.arrival, delayMin),
    departure: timePoint(c.departure, c.prognosis?.departure, delayMin),
    delayMin,
  };
}

function timePoint(
  scheduledRaw: string | null | undefined,
  predictedRaw: string | null | undefined,
  delayMin: number | null,
): TimePoint | null {
  const scheduled = iso(scheduledRaw);
  if (!scheduled) return null;
  return { scheduled, realtime: iso(predictedRaw) ?? shift(scheduled, delayMin) };
}

// --- Utilitaires ---------------------------------------------------------------------

// Cache mémoire à TTL strict. On n'utilise PAS `next: { revalidate }` : c'est du
// stale-while-revalidate, qui sert une réponse périmée (parfois de plusieurs
// minutes, et persistée sur disque) à la première requête après une période
// calme — inacceptable pour des horaires. Les requêtes simultanées sur la même
// URL partagent aussi le même appel amont. Les échecs ne sont pas mis en cache.
const memo = new Map<string, { expires: number; data: Promise<unknown> }>();
const MAX_ENTRIES = 500;

function get<T>(path: string, ttlSeconds: number): Promise<T> {
  const url = `${BASE}${path}`;
  const now = Date.now();
  const hit = memo.get(url);
  if (hit && hit.expires > now) return hit.data as Promise<T>;

  const data = fetchJson<T>(url);
  memo.set(url, { expires: now + ttlSeconds * 1000, data });
  data.catch(() => {
    if (memo.get(url)?.data === data) memo.delete(url);
  });
  if (memo.size > MAX_ENTRIES) prune(now);
  return data;
}

function prune(now: number) {
  for (const [k, v] of memo) if (v.expires <= now) memo.delete(k);
  // Encore trop d'entrées : on retire les plus anciennes (ordre d'insertion).
  for (const k of memo.keys()) {
    if (memo.size <= MAX_ENTRIES) break;
    memo.delete(k);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  } catch (err) {
    throw new UpstreamError(`Source injoignable : ${String(err)}`);
  }
  if (!res.ok) throw new UpstreamError(`Source en erreur (HTTP ${res.status})`, res.status);
  return (await res.json()) as T;
}

function qs(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** "2026-09-27T11:27:00+0200" → "2026-09-27T11:27:00+02:00" (Safari n'accepte pas +0200). */
function iso(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

/** Heure théorique + retard, quand la source donne un retard sans heure prédite. */
function shift(scheduled: string, delayMin: number | null): string | null {
  if (delayMin === null) return null;
  const d = new Date(new Date(scheduled).getTime() + delayMin * 60_000);
  return d.toISOString();
}

/** Date au format attendu par la source ("YYYY-MM-DD HH:mm", heure suisse). */
function zurichDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")}`;
}
