// lib/walk.ts
// Marche estimée entre ma position et les arrêts TPG, calculée SUR L'APPAREIL :
// la position y est réduite aux arrêts proches et aux minutes de marche, seules
// données envoyées au serveur. Les coordonnées ne quittent jamais l'appareil.
// Partagé client/serveur : le serveur y lit les bornes de ce qu'il reçoit.

import { distanceM, getTpgStop, NEARBY_RADIUS_M, nearestTpgStops } from "./stopIndex";
import type { PositionEndpoint } from "./types";

/** Arrêts candidats autour d'une position. */
export const CANDIDATES = 3;
/** Au-delà, un arrêt n'est retenu que s'il n'y en a pas de plus proche. */
const MAX_WALK_M = 800;
/** Marche à ~4,8 km/h, avec un détour moyen de 30 % par rapport au vol d'oiseau. */
const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;

function walkMinutes(m: number): number {
  return Math.max(1, Math.ceil((m * DETOUR) / WALK_M_PER_MIN));
}

/** Marche la plus longue jusqu'à un arrêt candidat (le plus proche, à 2 km au plus). */
export const MAX_NEAR_WALK_MIN = walkMinutes(NEARBY_RADIUS_M);
/** Marche la plus longue pour l'option « à pied ». */
export const MAX_DIRECT_WALK_MIN = walkMinutes(MAX_WALK_M);

/**
 * Ma position comme extrémité d'itinéraire : les arrêts TPG à distance de marche
 * (à défaut, le plus proche), et la marche directe jusqu'à l'arrêt `otherStopId`
 * s'il est à distance de marche. Null si aucun arrêt TPG à moins de 2 km.
 */
export function positionEndpoint(lat: number, lon: number, otherStopId: string | null): PositionEndpoint | null {
  const near = nearestTpgStops(lat, lon, CANDIDATES);
  if (!near.length) return null;
  const close = near.filter((s) => s.distanceM !== null && s.distanceM <= MAX_WALK_M);
  const stops = (close.length ? close : near.slice(0, 1)).map((s) => ({
    stopId: s.id,
    walkMin: walkMinutes(s.distanceM ?? 0),
  }));

  const other = otherStopId ? getTpgStop(otherStopId) : null;
  const direct =
    other && other.lat !== null && other.lon !== null ? distanceM(lat, lon, other.lat, other.lon) : Infinity;
  return { kind: "position", near: stops, directWalkMin: direct <= MAX_WALK_M ? walkMinutes(direct) : null };
}
