// lib/itinerary.ts
// Itinéraires entre deux extrémités, côté serveur uniquement. Une extrémité est
// un arrêt TPG ou une position. La source n'accepte pas de coordonnées (aucun
// résultat) et résout mal les adresses (« Rue du Rhône 8 » → un arrêt à ~1 km
// alors que Bel-Air est à 155 m) : pour une position, on interroge donc les
// arrêts TPG les plus proches (index local) et on ajoute la marche, ESTIMÉE à
// vol d'oiseau. Indépendant de la source : ne passe que par lib/transport.ts.

import { distanceM, getTpgStop, nearestTpgStops } from "./stopIndex";
import { getConnections, NotFoundError } from "./transport";
import type { Connection, Endpoint, Stop, TimePoint, WalkLeg } from "./types";

/** Arrêts candidats autour d'une position. */
const CANDIDATES = 3;
/** Au-delà, un arrêt n'est retenu que s'il n'y en a pas de plus proche. */
const MAX_WALK_M = 800;
/** Marche à ~4,8 km/h, avec un détour moyen de 30 % par rapport au vol d'oiseau. */
const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;
/** Itinéraires demandés par paire d'arrêts quand une extrémité est une position. */
const PER_PAIR = 4;
const MAX_RESULTS = 6;
/** Un départ passé depuis moins longtemps reste affiché (retard non encore connu). */
const DEPARTED_GRACE_MS = 30_000;

/** Arrêt de montée (ou de descente) avec la marche depuis (ou vers) la position. */
type Place = { stop: Stop; walkMin: number; distanceM: number | null };

/**
 * Itinéraires de `from` à `to`, du prochain départ au plus tardif. Au plus une
 * extrémité peut être une position (vérifié par la route).
 */
export async function planConnections(from: Endpoint, to: Endpoint): Promise<Connection[]> {
  const now = Date.now();
  const origins = places(from);
  const destinations = places(to);
  const byPosition = from.kind === "position" || to.kind === "position";

  const pairs = origins
    .flatMap((o) => destinations.map((d) => [o, d] as const))
    .filter(([o, d]) => o.stop.id !== d.stop.id);
  const settled = await Promise.allSettled(
    pairs.map(async ([o, d]) => {
      const list = await getConnections(o.stop.id, d.stop.id, {
        // Depuis une position, inutile de proposer un départ qu'on n'atteindra pas à pied.
        at: o.walkMin ? new Date(now + o.walkMin * 60_000) : undefined,
        limit: byPosition ? PER_PAIR : MAX_RESULTS,
      });
      return list.map((c) => withWalks(c, o, d));
    }),
  );

  const found = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure && !found.length) throw failure.reason;

  const catchable = found.filter((c) => time(c.departure) >= now - DEPARTED_GRACE_MS);
  const walk = walkOnly(from, to, now);
  if (!walk) return prune(catchable);
  // On peut partir à pied à toute heure : un itinéraire qui ne va pas plus vite ne sert à rien.
  const walkMs = time(walk.arrival) - time(walk.departure);
  return prune([walk, ...catchable.filter((c) => time(c.arrival) - time(c.departure) < walkMs)]);
}

function places(e: Endpoint): Place[] {
  if (e.kind === "stop") {
    const stop = getTpgStop(e.stopId);
    if (!stop) throw new NotFoundError(`Arrêt inconnu du réseau TPG : ${e.stopId}`);
    return [{ stop, walkMin: 0, distanceM: null }];
  }
  const near = nearestTpgStops(e.lat, e.lon, CANDIDATES);
  if (!near.length) throw new NotFoundError("Aucun arrêt TPG à moins de 2 km de ta position");
  const close = near.filter((s) => s.distanceM !== null && s.distanceM <= MAX_WALK_M);
  return (close.length ? close : near.slice(0, 1)).map(({ distanceM, ...stop }) => ({
    stop,
    walkMin: walkMinutes(distanceM ?? 0),
    distanceM,
  }));
}

function walkMinutes(m: number): number {
  return Math.max(1, Math.ceil((m * DETOUR) / WALK_M_PER_MIN));
}

/** Ajoute la marche estimée entre la position et l'arrêt de montée / de descente. */
function withWalks(c: Connection, o: Place, d: Place): Connection {
  let { legs, departure, arrival } = c;

  if (o.walkMin) {
    departure = shift(c.departure, -o.walkMin);
    const [first, ...rest] = legs;
    // La source commence parfois par une marche vers un arrêt voisin : on la prolonge.
    legs =
      first.kind === "walk"
        ? [walkLeg(null, first.to, at(departure), first.arrival, o.walkMin + first.durationMin), ...rest]
        : [walkLeg(null, o.stop, at(departure), at(c.departure), o.walkMin), ...legs];
  }

  if (d.walkMin) {
    arrival = shift(c.arrival, d.walkMin);
    const last = legs[legs.length - 1];
    legs =
      last.kind === "walk"
        ? [...legs.slice(0, -1), walkLeg(last.from, null, last.departure, at(arrival), last.durationMin + d.walkMin)]
        : [...legs, walkLeg(d.stop, null, at(c.arrival), at(arrival), d.walkMin)];
  }

  return { ...c, departure, arrival, legs };
}

/** Destination (ou départ) à distance de marche de la position : l'option « à pied ». */
function walkOnly(from: Endpoint, to: Endpoint, now: number): Connection | null {
  const position = from.kind === "position" ? from : to.kind === "position" ? to : null;
  const other = from.kind === "stop" ? from : to.kind === "stop" ? to : null;
  const stop = other && getTpgStop(other.stopId);
  if (!position || !stop || stop.lat === null || stop.lon === null) return null;

  const m = distanceM(position.lat, position.lon, stop.lat, stop.lon);
  if (m > MAX_WALK_M) return null;
  const min = walkMinutes(m);
  const start = new Date(now).toISOString();
  const end = new Date(now + min * 60_000).toISOString();
  const leg =
    from.kind === "position" ? walkLeg(null, stop, start, end, min) : walkLeg(stop, null, start, end, min);
  return {
    key: `walk:${stop.id}`,
    departure: { scheduled: start, realtime: null },
    arrival: { scheduled: end, realtime: null },
    transfers: 0,
    legs: [leg],
  };
}

function walkLeg(from: Stop | null, to: Stop | null, departure: string, arrival: string, durationMin: number): WalkLeg {
  return { kind: "walk", from, to, departure, arrival, durationMin, estimated: true };
}

/**
 * Mêmes courses prises à deux arrêts voisins : on garde l'option qui arrive le plus
 * tôt, puis qui part le plus tard. On écarte ensuite les itinéraires dominés
 * (partir plus tôt pour arriver plus tard, avec autant de changements ou plus).
 */
function prune(list: Connection[]): Connection[] {
  const best = new Map<string, Connection>();
  for (const c of list) {
    const rides = c.legs.flatMap((l) => (l.kind === "ride" ? [`${l.journey}/${l.line}`] : []));
    const sig = rides.length ? rides.join("+") : c.key;
    const prev = best.get(sig);
    const better =
      !prev ||
      time(c.arrival) < time(prev.arrival) ||
      (time(c.arrival) === time(prev.arrival) && time(c.departure) > time(prev.departure));
    if (better) best.set(sig, c);
  }
  const unique = [...best.values()];
  return unique
    .filter((a) => !unique.some((b) => b !== a && dominates(b, a)))
    .sort((a, b) => time(a.departure) - time(b.departure) || time(a.arrival) - time(b.arrival))
    .slice(0, MAX_RESULTS);
}

function dominates(b: Connection, a: Connection): boolean {
  const [bd, ba, ad, aa] = [time(b.departure), time(b.arrival), time(a.departure), time(a.arrival)];
  return bd >= ad && ba <= aa && b.transfers <= a.transfers && (bd > ad || ba < aa || b.transfers < a.transfers);
}

function shift(t: TimePoint, minutes: number): TimePoint {
  const add = (iso: string) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
  return { scheduled: add(t.scheduled), realtime: t.realtime ? add(t.realtime) : null };
}

/** Heure effective (temps réel si dispo, sinon théorique). */
function at(t: TimePoint): string {
  return t.realtime ?? t.scheduled;
}

function time(t: TimePoint): number {
  return new Date(at(t)).getTime();
}
