"use client";

// lib/favorites.ts
// Favoris persistés en localStorage, exposés via useSyncExternalStore :
// un seul état partagé entre composants, synchronisé entre onglets.

import { useCallback, useSyncExternalStore } from "react";

export type Favorite = { id: string; name: string };

const KEY = "tpg-go:favorites:v1";
const EMPTY: Favorite[] = [];

let cache: Favorite[] | null = null;
const listeners = new Set<() => void>();

function read(): Favorite[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return EMPTY;
    return raw.filter(
      (f): f is Favorite =>
        typeof f === "object" && f !== null && typeof f.id === "string" && typeof f.name === "string",
    );
  } catch {
    return EMPTY; // stockage indisponible (navigation privée…) ou JSON corrompu
  }
}

function getSnapshot(): Favorite[] {
  cache ??= read();
  return cache;
}

function getServerSnapshot(): Favorite[] {
  return EMPTY;
}

function write(next: Favorite[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
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

const noopSubscribe = () => () => {};

/** true une fois côté client (évite d'afficher un état vide trompeur au SSR). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

  const toggle = useCallback((stop: Favorite) => {
    const cur = getSnapshot();
    write(
      cur.some((f) => f.id === stop.id)
        ? cur.filter((f) => f.id !== stop.id)
        : [...cur, { id: stop.id, name: stop.name }],
    );
  }, []);

  const remove = useCallback((id: string) => {
    write(getSnapshot().filter((f) => f.id !== id));
  }, []);

  /** Déplace un favori de `delta` positions (réordonnancement). */
  const move = useCallback((id: string, delta: number) => {
    const cur = [...getSnapshot()];
    const from = cur.findIndex((f) => f.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= cur.length) return;
    const [item] = cur.splice(from, 1);
    cur.splice(to, 0, item);
    write(cur);
  }, []);

  return { favorites, isFavorite, toggle, remove, move };
}
