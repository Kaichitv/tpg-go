"use client";

// lib/tabs.ts
// Onglets de la tabbar et onglet « d'origine » : une page de détail (arrêt) est
// poussée dans l'onglet d'où on vient, qui reste sélectionné dans la tabbar et
// sert de cible au bouton retour.

import { useSyncExternalStore } from "react";

export type TabId = "favorites" | "search" | "itinerary" | "settings";

export type Tab = { id: TabId; href: string; label: string };

/** Ordre d'affichage dans la tabbar. L'accueil (« / ») est l'onglet Favoris. */
export const TABS: readonly Tab[] = [
  { id: "favorites", href: "/", label: "Favoris" },
  { id: "search", href: "/search", label: "Recherche" },
  { id: "itinerary", href: "/itinerary", label: "Itinéraire" },
  { id: "settings", href: "/settings", label: "Réglages" },
];

const DEFAULT_TAB: TabId = "favorites";

/** Onglet dont `pathname` est la racine, ou null (page de détail). */
export function tabAt(pathname: string): Tab | null {
  return TABS.find((t) => t.href === pathname) ?? null;
}

export function getTab(id: TabId): Tab {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

// Dernier onglet racine visité, en mémoire : la tabbar vit dans le layout racine
// et n'est pas démontée entre les navigations.
let origin: TabId = DEFAULT_TAB;
const listeners = new Set<() => void>();

export function setOriginTab(id: TabId) {
  if (id === origin) return;
  origin = id;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Onglet d'où l'on vient (Favoris par défaut, p. ex. sur un lien direct vers un arrêt). */
export function useOriginTab(): Tab {
  const id = useSyncExternalStore(
    subscribe,
    () => origin,
    () => DEFAULT_TAB,
  );
  return getTab(id);
}
