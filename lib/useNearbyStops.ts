"use client";

// lib/useNearbyStops.ts
// Position de l'appareil + arrêts les plus proches. La liste est calculée sur
// l'appareil, dans l'index local (lib/stopIndex.ts) : la position n'est jamais
// envoyée au serveur. Pendant une relocalisation ou après un échec, on garde la
// dernière position connue et sa liste plutôt que de vider l'écran.

import { useMemo } from "react";
import { nearestTpgStops } from "./stopIndex";
import type { NearbyStop } from "./types";
import { useGeolocation, type GeoState, type Position } from "./useGeolocation";

export type NearbyStops = {
  geo: GeoState;
  /** Position utilisée pour la liste (actuelle ou dernière connue). */
  position: Position | null;
  /** Arrêts TPG à moins de 2 km, du plus proche au plus loin ; vide sans position. */
  stops: NearbyStop[];
  locate: () => void;
};

export function useNearbyStops(max: number): NearbyStops {
  const { state: geo, locate } = useGeolocation();
  const position =
    geo.status === "ready"
      ? geo.position
      : geo.status === "locating" || geo.status === "failed"
        ? geo.last
        : null;

  const lat = position?.lat;
  const lon = position?.lon;
  const stops = useMemo(
    () => (lat === undefined || lon === undefined ? [] : nearestTpgStops(lat, lon, max)),
    [lat, lon, max],
  );

  return { geo, position, stops, locate };
}
