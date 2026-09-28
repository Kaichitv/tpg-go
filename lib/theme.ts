"use client";

// lib/theme.ts
// Thème choisi dans les Réglages : « auto » suit le système, sinon clair ou sombre
// forcé via <html data-theme>. Persisté en localStorage, partagé via
// useSyncExternalStore et synchronisé entre onglets (même principe que les favoris).

import { useCallback, useSyncExternalStore } from "react";
import { THEME_COLORS, THEME_KEY } from "./themeInit";

export type Theme = "auto" | "light" | "dark";

let cache: Theme | null = null;
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

function getSnapshot(): Theme {
  cache ??= read();
  return cache;
}

function getServerSnapshot(): Theme {
  return "auto";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
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

/** Applique le thème au document : attribut data-theme + couleur de la barre d'état. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;

  // Next émet une meta theme-color par media query ; en thème forcé, les deux
  // prennent la couleur choisie, en auto chacune retrouve la sienne.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.media ?? "";
    const own = media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light;
    m.content = theme === "auto" ? own : THEME_COLORS[theme];
  });
}

/**
 * Applique le thème stocké maintenant puis à chaque changement (Réglages ou autre
 * onglet). Lu hors rendu React : pas de passage par l'instantané serveur « auto »
 * à l'hydratation, qui effacerait le data-theme posé par le script inline.
 */
export function watchTheme(): () => void {
  const sync = () => applyTheme(getSnapshot());
  sync();
  return subscribe(sync);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    cache = next;
    try {
      if (next === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* mode privé : le choix vaut pour la session */
    }
    listeners.forEach((l) => l());
  }, []);

  return { theme, setTheme };
}
