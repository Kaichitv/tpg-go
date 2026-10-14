// lib/itinerary.ts
// Itinéraires entre deux extrémités, côté serveur uniquement. Une extrémité est
// un arrêt TPG ou ma position. La source n'accepte pas de coordonnées (aucun
// résultat) et résout mal les adresses (« Rue du Rhône 8 » → un arrêt à ~1 km
// alors que Bel-Air est à 155 m) : pour ma position, on interroge donc les
// arrêts TPG les plus proches et on ajoute la marche, ESTIMÉE à vol d'oiseau.
// Arrêts et marche sont calculés sur l'appareil (lib/walk.ts) : le serveur ne
// reçoit jamais de coordonnées. Indépendant de la source : ne passe que par
// lib/transport.ts.

import { getTpgStop } from "./stopIndex";
import { getConnections, NotFoundError } from "./transport";
import type { Connection, Endpoint, PlannedTime, Stop, TimePoint, WalkLeg } from "./types";

/** Itinéraires demandés par paire d'arrêts quand une extrémité est une position. */
const PER_PAIR = 4;
const MAX_RESULTS = 6;
/** Un départ passé depuis moins longtemps reste affiché (retard non encore connu). */
const DEPARTED_GRACE_MS = 30_000;

/** Arrêt de montée (ou de descente) avec la marche depuis (ou vers) la position. */
type Place = { stop: Stop; walkMin: number };

/**
 * Itinéraires de `from` à `to`, triés par départ. Au plus une extrémité peut être
 * une position (vérifié par la route). `when` : partir à (les premiers départs
 * à partir de cette heure) ou arriver à (les derniers itinéraires qui arrivent
 * à temps) ; null = partir maintenant.
 */
export async function planConnections(
  from: Endpoint,
  to: Endpoint,
  when: PlannedTime | null = null,
): Promise<Connection[]> {
  const now = Date.now();
  const arriveBy = when?.mode === "arrive";
  // Heure demandée ; un départ n'est jamais cherché dans le passé.
  const target = when ? (arriveBy ? Date.parse(when.at) : Math.max(Date.parse(when.at), now)) : now;
  const origins = places(from);
  const destinations = places(to);
  const byPosition = from.kind === "position" || to.kind === "position";

  const pairs = origins
    .flatMap((o) => destinations.map((d) => [o, d] as const))
    .filter(([o, d]) => o.stop.id !== d.stop.id);
  const settled = await Promise.allSettled(
    pairs.map(async ([o, d]) => {
      const list = await getConnections(o.stop.id, d.stop.id, {
        // Partir à : on n'atteint l'arrêt de montée qu'après la marche depuis la position.
        // Arriver à : il faut descendre assez tôt pour finir à pied jusqu'à la position.
        at: arriveBy
          ? new Date(target - d.walkMin * 60_000)
          : when || o.walkMin
            ? new Date(target + o.walkMin * 60_000)
            : undefined,
        arriveBy,
        limit: byPosition ? PER_PAIR : MAX_RESULTS,
      });
      return list.map((c) => withWalks(c, o, d));
    }),
  );

  const found = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failure && !found.length) throw failure.reason;

  const walk = walkOnly(from, to, target, arriveBy);
  // On peut partir à pied à toute heure : un itinéraire qui ne va pas plus vite ne sert à rien.
  const walkMs = walk ? time(walk.arrival) - time(walk.departure) : Infinity;
  const options = [...(walk ? [walk] : []), ...found.filter((c) => time(c.arrival) - time(c.departure) < walkMs)];
  const catchable = options.filter((c) => time(c.departure) >= now - DEPARTED_GRACE_MS);
  return prune(catchable, arriveBy);
}

function places(e: Endpoint): Place[] {
  if (e.kind === "stop") {
    const stop = getTpgStop(e.stopId);
    if (!stop) throw new NotFoundError(`Arrêt inconnu du réseau TPG : ${e.stopId}`);
    return [{ stop, walkMin: 0 }];
  }
  // Un id inconnu (index de l'appareil d'une version précédente) est ignoré.
  const near = e.near.flatMap(({ stopId, walkMin }) => {
    const stop = getTpgStop(stopId);
    return stop ? [{ stop, walkMin }] : [];
  });
  if (!near.length) {
    throw new NotFoundError(`Arrêts inconnus du réseau TPG : ${e.near.map((s) => s.stopId).join(", ")}`);
  }
  return near;
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

/**
 * Destination (ou départ) à distance de marche de la position : l'option « à pied »,
 * partant à `at` (ou y arrivant, avec `arriveBy`).
 */
function walkOnly(from: Endpoint, to: Endpoint, at: number, arriveBy: boolean): Connection | null {
  const position = from.kind === "position" ? from : to.kind === "position" ? to : null;
  const other = from.kind === "stop" ? from : to.kind === "stop" ? to : null;
  const stop = other && getTpgStop(other.stopId);
  const min = position?.directWalkMin;
  if (!min || !stop) return null;

  const startMs = arriveBy ? at - min * 60_000 : at;
  const start = new Date(startMs).toISOString();
  const end = new Date(startMs + min * 60_000).toISOString();
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
 * On garde les premiers départs, ou les derniers avec `arriveBy` (au plus près de
 * l'heure d'arrivée demandée).
 */
function prune(list: Connection[], arriveBy: boolean): Connection[] {
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
  const sorted = unique
    .filter((a) => !unique.some((b) => b !== a && dominates(b, a)))
    .sort((a, b) => time(a.departure) - time(b.departure) || time(a.arrival) - time(b.arrival));
  return arriveBy ? sorted.slice(-MAX_RESULTS) : sorted.slice(0, MAX_RESULTS);
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
