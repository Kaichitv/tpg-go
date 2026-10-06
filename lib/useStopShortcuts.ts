"use client";

// lib/useStopShortcuts.ts
// Arrêts proposés sans saisie dans l'onglet Itinéraire : favoris d'abord, puis
// arrêts récemment consultés, sans doublon.

import { useMemo } from "react";
import { useFavorites } from "./favorites";
import { useRecents } from "./recents";

export type StopShortcut = { id: string; name: string; source: "favorite" | "recent" };

/** `excludeId` : arrêt déjà choisi dans l'autre champ. */
export function useStopShortcuts(excludeId: string | null, max = 8): StopShortcut[] {
  const { favorites } = useFavorites();
  const { recents } = useRecents();

  return useMemo(() => {
    const seen = new Set(excludeId ? [excludeId] : []);
    const list: StopShortcut[] = [];
    for (const [items, source] of [
      [favorites, "favorite"],
      [recents, "recent"],
    ] as const) {
      for (const s of items) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        list.push({ id: s.id, name: s.name, source });
      }
    }
    return list.slice(0, max);
  }, [favorites, recents, excludeId, max]);
}
