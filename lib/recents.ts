"use client";

// lib/recents.ts
// Arrêts récemment consultés (le plus récent en tête), persistés en localStorage
// et partagés via useSyncExternalStore, comme les favoris.

import { useCallback, useSyncExternalStore } from "react";

export type RecentStop = { id: string; name: string };

const KEY = "tpg-go:recents:v1";
const MAX = 10;
const EMPTY: RecentStop[] = [];

let cache: RecentStop[] | null = null;
const listeners = new Set<() => void>();

function read(): RecentStop[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return EMPTY;
    return raw.filter(
      (r): r is RecentStop =>
        typeof r === "object" && r !== null && typeof r.id === "string" && typeof r.name === "string",
    );
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): RecentStop[] {
  cache ??= read();
  return cache;
}

function getServerSnapshot(): RecentStop[] {
  return EMPTY;
}

function write(next: RecentStop[]) {
  cache = next;
  try {
    if (next.length) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* quota ou mode privé : l'état reste en mémoire pour la session */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Note la consultation d'un arrêt (remonte en tête s'il y était déjà). */
export function addRecent(stop: RecentStop) {
  const cur = getSnapshot();
  if (cur[0]?.id === stop.id && cur[0].name === stop.name) return;
  write([{ id: stop.id, name: stop.name }, ...cur.filter((r) => r.id !== stop.id)].slice(0, MAX));
}

export function useRecents() {
  const recents = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const clear = useCallback(() => write(EMPTY), []);
  return { recents, clear };
}
