// lib/api.ts
// Accès client aux routes serveur /api/*. L'UI ne connaît que ces fonctions et
// les types de lib/types.ts — jamais la source tierce.

import type { Suggestion } from "./suggestion";
import type { Board, NearbyStop, Stop, Trip, TripQuery } from "./types";

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

export function fetchBoard(stop: string, limit: number, signal?: AbortSignal): Promise<Board> {
  return getJson<Board>(`/api/departures?${new URLSearchParams({ stop, limit: String(limit) })}`, signal);
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
