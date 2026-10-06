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
  Connection,
  Departure,
  Leg,
  LegStop,
  NearbyStop,
  RideLeg,
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

type RawSection = {
  journey?: RawJourney | null;
  walk?: { duration?: number | null } | null;
  departure?: RawCheckpoint | null;
  arrival?: RawCheckpoint | null;
};

type RawConnection = {
  from?: RawCheckpoint | null;
  to?: RawCheckpoint | null;
  sections?: RawSection[] | null;
};

type RawConnections = { connections?: RawConnection[] | null };

// --- API publique ------------------------------------------------------------------

/** Arrêts du réseau TPG dont le nom correspond à la saisie. */
export async function searchStops(query: string): Promise<Stop[]> {
  return searchTpgStops(query, 20);
}

/** Arrêts TPG les plus proches d'une position (WGS84), du plus proche au plus loin. */
export async function nearbyStops(lat: number, lon: number): Promise<NearbyStop[]> {
  return nearestTpgStops(lat, lon, 10);
}

export type DeparturesOptions = {
  /** Départs à partir de cette heure (théorique) plutôt que maintenant. */
  from?: Date;
  /** Inclure la séquence d'arrêts de chaque course (défaut : oui). */
  withStops?: boolean;
};

/**
 * Prochains départs d'un arrêt.
 * @param stop identifiant numérique (recommandé) ou nom exact de l'arrêt
 */
export async function getDepartures(
  stop: string,
  limit = 12,
  { from, withStops = true }: DeparturesOptions = {},
): Promise<Board> {
  const byId = /^\d+$/.test(stop);
  const params: Record<string, string> = { [byId ? "id" : "station"]: stop, limit: String(limit) };
  if (from) params.datetime = zurichDateTime(from);
  const data = await get<RawStationboard>(
    `/stationboard?${qs(params)}`,
    20, // cache court : les mobiles peuvent poller sans marteler l'API amont
  );
  if (!data.station?.name) throw new NotFoundError(`Arrêt introuvable : ${stop}`);

  const station = toStop(data.station);
  const departures = (data.stationboard ?? [])
    .map((j) => toDeparture(j, station))
    .filter((d): d is Departure => d !== null)
    .map((d) => (withStops ? d : { ...d, stops: [] }));

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

export type ConnectionsOptions = {
  /** Départs à partir de cette heure plutôt que maintenant. */
  at?: Date;
  /** Nombre d'itinéraires demandés (la source peut en renvoyer un peu plus). */
  limit?: number;
};

/**
 * Itinéraires d'un arrêt à un autre, par identifiants uniquement : un nom comme
 * « Bel-Air » est résolu par la source à l'échelle de la Suisse (Bel-Air LEB,
 * à Lausanne). La source n'accepte pas non plus de coordonnées : le départ depuis
 * une position est géré par lib/itinerary.ts.
 */
export async function getConnections(
  fromId: string,
  toId: string,
  { at, limit = 5 }: ConnectionsOptions = {},
): Promise<Connection[]> {
  const params: Record<string, string> = { from: fromId, to: toId, limit: String(limit) };
  if (at) {
    const [date, time] = zurichDateTime(at).split(" ");
    params.date = date;
    params.time = time;
  }
  const data = await get<RawConnections>(`/connections?${qs(params)}`, 30);
  return (data.connections ?? []).map(toConnection).filter((c): c is Connection => c !== null);
}

// --- Mapping -----------------------------------------------------------------------

/** Catégories ferroviaires : leur numéro seul se confondrait avec une ligne TPG (RE 33 ≠ bus 33). */
const TRAIN_CATEGORIES = new Set([
  "S", "SN", "R", "RE", "IR", "IC", "ICE", "EC", "EN", "TGV", "IRE", "PE", "EXT", "RJX", "NJ",
]);

function toConnection(c: RawConnection): Connection | null {
  const legs: Leg[] = [];
  for (const s of c.sections ?? []) {
    const leg = toLeg(s);
    if (!leg) return null; // section illisible : itinéraire incomplet, on l'écarte
    legs.push(leg);
  }
  const departure = c.from ? timePoint(c.from.departure, c.from.prognosis?.departure, delayOf(c.from)) : null;
  const arrival = c.to ? timePoint(c.to.arrival, c.to.prognosis?.arrival, delayOf(c.to)) : null;
  if (!legs.length || !departure || !arrival) return null;

  const rides = legs.filter((l): l is RideLeg => l.kind === "ride");
  return {
    key: `${rides.map((r) => r.journey).join("+") || "walk"}@${departure.scheduled}`,
    departure,
    arrival,
    transfers: Math.max(0, rides.length - 1),
    legs,
  };
}

function toLeg(s: RawSection): Leg | null {
  const dep = s.departure;
  const arr = s.arrival;
  if (!dep?.station || !arr?.station) return null;

  const j = s.journey;
  if (j) {
    const from = legStop(dep, "departure");
    const to = legStop(arr, "arrival");
    if (!from || !to) return null;
    const operator = j.operator ?? null;
    const category = j.category ?? "";
    const number = j.number ?? j.name ?? "?";
    const isTrain = TRAIN_CATEGORIES.has(category.toUpperCase()) && /^\d+$/.test(number);
    return {
      kind: "ride",
      journey: j.name ?? "",
      line: isTrain ? `${category} ${number}` : number,
      category,
      operator,
      isTpg: operator === null || operator.toUpperCase() === "TPG",
      destination: placeName(j.to),
      from,
      to,
      stops: (j.passList ?? []).map((c) => toTripStop(c, null)),
    };
  }

  const departure = iso(dep.departure);
  const arrival = iso(arr.arrival);
  if (!departure || !arrival) return null;
  const seconds = s.walk?.duration ?? (new Date(arrival).getTime() - new Date(departure).getTime()) / 1000;
  return {
    kind: "walk",
    from: toStop(dep.station),
    to: toStop(arr.station),
    departure,
    arrival,
    durationMin: Math.max(1, Math.ceil(seconds / 60)),
    estimated: false,
  };
}

function legStop(c: RawCheckpoint, at: "arrival" | "departure"): LegStop | null {
  const time = timePoint(c[at], c.prognosis?.[at], delayOf(c));
  if (!time || !c.station) return null;
  return { stop: toStop(c.station), time, platform: c.prognosis?.platform ?? c.platform ?? null };
}

function delayOf(c: RawCheckpoint): number | null {
  return typeof c.delay === "number" ? c.delay : null;
}

/**
 * Noms de la source ambigus pour un usager genevois. La gare CFF s'appelle
 * « Genève » tout court (id 8501008) : on la nomme comme ses voisines
 * (Genève-Aéroport, Genève-Champel…), distincte de l'arrêt TPG « Genève, gare Cornavin ».
 */
const RENAMED: Readonly<Record<string, string>> = { "Genève": "Genève-Cornavin" };

function placeName(name: string | null | undefined): string {
  return name ? (RENAMED[name] ?? name) : "";
}

function toStop(s: RawStation): Stop {
  return {
    id: s.id ?? "",
    name: placeName(s.name),
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
    destination: placeName(j.to),
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
    name: self?.name ?? placeName(c.station?.name),
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
