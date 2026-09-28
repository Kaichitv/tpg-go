"use client";

import { CircleHalfIcon, MoonIcon, SunIcon } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { useHydrated } from "@/lib/favorites";
import { useTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: Icon }[] = [
  { value: "auto", label: "Auto", icon: CircleHalfIcon },
  { value: "light", label: "Clair", icon: SunIcon },
  { value: "dark", label: "Sombre", icon: MoonIcon },
];

/** Contrôle segmenté (boutons radio natifs) : thème auto, clair ou sombre. */
export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // Avant l'hydratation le choix stocké est inconnu : aucun segment coché.
  const hydrated = useHydrated();

  return (
    <fieldset>
      <legend className="sr-only">Thème</legend>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-press p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const checked = hydrated && theme === value;
          return (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-[15px] font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) ${
                checked ? "elev-2 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={checked}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon size={18} weight={checked ? "fill" : "regular"} aria-hidden />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
