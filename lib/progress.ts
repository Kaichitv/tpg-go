// lib/progress.ts
// Progression d'une course DÉDUITE DES HORAIRES (temps réel si fourni, sinon
// théorique). Ce n'est PAS une position GPS : la source v1 n'en fournit pas.

import { effectiveTime, type TripStop } from "./types";

export type StopState = "passed" | "dwelling" | "next" | "upcoming";

export type Progress = {
  states: StopState[];
  /** Index du prochain arrêt (ou de l'arrêt où le véhicule stationne) ; -1 si terminé. */
  nextIndex: number;
  finished: boolean;
};

/** Heure à laquelle le véhicule quitte l'arrêt (ou y arrive, pour le terminus). */
function leaveTime(s: TripStop): number | null {
  const t = effectiveTime(s.departure) ?? effectiveTime(s.arrival);
  return t ? new Date(t).getTime() : null;
}

function arriveTime(s: TripStop): number | null {
  const t = effectiveTime(s.arrival) ?? effectiveTime(s.departure);
  return t ? new Date(t).getTime() : null;
}

export function computeProgress(stops: TripStop[], now: number): Progress {
  const nextIndex = stops.findIndex((s) => {
    const t = leaveTime(s);
    return t === null || t > now;
  });

  const states = stops.map<StopState>((s, i) => {
    if (nextIndex === -1 || i < nextIndex) return "passed";
    if (i > nextIndex) return "upcoming";
    const arr = arriveTime(s);
    return arr !== null && arr <= now ? "dwelling" : "next";
  });

  return { states, nextIndex, finished: nextIndex === -1 };
}
