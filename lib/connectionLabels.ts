// lib/connectionLabels.ts
// Libellés partagés par la carte et le détail d'un itinéraire.

import { dayPhrase } from "./plannedTime";
import { countdown } from "./time";
import type { Connection } from "./types";

// Espaces insécables entre nombre et unité : « 1 changement » ne se coupe pas en fin de ligne.
const NBSP = "\u00a0";

/** 42 → « 42 min » ; 75 → « 1 h 15 ». */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}${NBSP}min`;
  const m = min % 60;
  return `${Math.floor(min / 60)}${NBSP}h${m ? `${NBSP}${String(m).padStart(2, "0")}` : ""}`;
}

export function transfersLabel(n: number): string {
  return n === 0 ? "direct" : `${n}${NBSP}changement${n > 1 ? "s" : ""}`;
}

/**
 * « Partir dans 4 min » si l'itinéraire commence à pied, « Départ dans 4 min » s'il
 * commence à bord. `approx` : pas de temps réel, compte à rebours préfixé de « ~ ».
 * Un autre jour (itinéraire planifié) : « Départ demain », « Départ le jeu. 15 oct. ».
 */
export function leaveLabel(c: Connection, now: number, approx = false): string {
  const verb = c.legs[0]?.kind === "walk" ? "Partir" : "Départ";
  const iso = c.departure.realtime ?? c.departure.scheduled;
  const cd = countdown(iso, now);
  switch (cd.kind) {
    case "now":
      return `${verb} maintenant`;
    case "minutes":
      return `${verb} dans ${approx ? "~" : ""}${cd.minutes} min`;
    case "clock": {
      // L'heure figure déjà sur la carte : seul le jour est utile.
      const day = dayPhrase(iso, now);
      return day ? `${verb} ${day}` : `${verb} à ${cd.clock}`;
    }
  }
}
