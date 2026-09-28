"use client";

// lib/useNearbyStops.ts
// Position de l'appareil + arrêts les plus proches, rechargés à chaque nouvelle
// position. Pendant une relocalisation ou après un échec, on garde la dernière
// position connue et sa liste plutôt que de vider l'écran.

import { useEffect, useState } from "react";
import { fetchNearby, isAbort } from "./api";
import type { NearbyStop } from "./types";
import { useGeolocation, type GeoState, type Position } from "./useGeolocation";

export type NearbyResults = { status: "loading" | "done" | "error"; stops: NearbyStop[] };

export type NearbyStops = {
  geo: GeoState;
  /** Position utilisée pour la liste (actuelle ou dernière connue). */
  position: Position | null;
  results: NearbyResults;
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

  const [results, setResults] = useState<NearbyResults>({ status: "loading", stops: [] });
  const lat = position?.lat;
  const lon = position?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const ctrl = new AbortController();
    setResults((r) => ({ status: "loading", stops: r.stops }));
    fetchNearby(lat, lon, ctrl.signal)
      .then((stops) => setResults({ status: "done", stops: stops.slice(0, max) }))
      .catch((err) => {
        if (!isAbort(err)) setResults((r) => ({ status: "error", stops: r.stops }));
      });
    return () => ctrl.abort();
  }, [lat, lon, max]);

  return { geo, position, results, locate };
}
