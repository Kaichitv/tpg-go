// lib/api.ts
// Accès client aux routes serveur /api/*. L'UI ne connaît que ces fonctions et
// les types de lib/types.ts — jamais la source tierce.

import type { Suggestion } from "./suggestion";
import type { Board, ConnectionsResult, Endpoint, NearbyStop, Stop, Trip, TripQuery } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** `from` (ISO) : départs à partir de cette heure, sans séquence d'arrêts (correspondances). */
export function fetchBoard(stop: string, limit: number, signal?: AbortSignal, from?: string): Promise<Board> {
  const params = new URLSearchParams({ stop, limit: String(limit) });
  if (from) params.set("from", from);
  return getJson<Board>(`/api/departures?${params}`, signal);
}

export async function fetchStops(q: string, signal?: AbortSignal): Promise<Stop[]> {
  const data = await getJson<{ stops: Stop[] }>(`/api/locations?${new URLSearchParams({ q })}`, signal);
  return data.stops;
}

export async function fetchNearby(lat: number, lon: number, signal?: AbortSignal): Promise<NearbyStop[]> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const data = await getJson<{ stops: NearbyStop[] }>(`/api/nearby?${params}`, signal);
  return data.stops;
}

export function fetchTrip(q: TripQuery, signal?: AbortSignal): Promise<Trip> {
  const params = new URLSearchParams({ journey: q.journey, line: q.line, stop: q.stopId, at: q.at });
  return getJson<Trip>(`/api/trip?${params}`, signal);
}

export function fetchConnections(from: Endpoint, to: Endpoint, signal?: AbortSignal): Promise<ConnectionsResult> {
  const params = new URLSearchParams({ from: endpointParam(from), to: endpointParam(to) });
  return getJson<ConnectionsResult>(`/api/connections?${params}`, signal);
}

/** Arrêt → id ; position → « lat,lon » arrondis à ~10 m (suffisant pour estimer la marche). */
function endpointParam(e: Endpoint): string {
  return e.kind === "stop" ? e.stopId : `${e.lat.toFixed(4)},${e.lon.toFixed(4)}`;
}

/** `website` : pot de miel anti-robots, laissé vide par un humain. */
export async function sendSuggestion(s: Suggestion & { website?: string }): Promise<void> {
  const res = await fetch("/api/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status);
  }
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
