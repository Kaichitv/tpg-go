"use client";

// lib/tabs.ts
// Onglets de la tabbar et onglet « d'origine » : une page de détail (arrêt) est
// poussée dans l'onglet d'où on vient, qui reste sélectionné dans la tabbar et
// sert de cible au bouton retour.

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

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

/**
 * Onglet de rattachement d'une page de détail, quand on ne sait pas d'où l'on
 * vient (lien direct, rechargement) : la confidentialité appartient aux Réglages.
 */
const HOME_TABS: Readonly<Record<string, TabId>> = { "/privacy": "settings" };

/** Onglet dont `pathname` est la racine, ou null (page de détail). */
export function tabAt(pathname: string): Tab | null {
  return TABS.find((t) => t.href === pathname) ?? null;
}

export function getTab(id: TabId): Tab {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

// Dernier onglet racine visité, en mémoire : la tabbar vit dans le layout racine
// et n'est pas démontée entre les navigations. Null tant qu'aucun n'a été visité.
let origin: TabId | null = null;
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

/**
 * Onglet d'où l'on vient. Sans onglet visité (lien direct, rechargement) :
 * l'onglet de rattachement de la page, sinon Favoris (p. ex. pour un arrêt).
 */
export function useOriginTab(): Tab {
  const pathname = usePathname();
  const id = useSyncExternalStore(
    subscribe,
    () => origin,
    () => null,
  );
  return getTab(id ?? HOME_TABS[pathname] ?? DEFAULT_TAB);
}
