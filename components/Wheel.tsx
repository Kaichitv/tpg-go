"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

export type WheelOption = {
  value: string;
  label: string;
  /** Lecture par les lecteurs d'écran, si différente du libellé (« 8 heures » pour « 08 »). */
  spoken?: string;
};

type Props = {
  /** Nom de la colonne pour les lecteurs d'écran (« Jour », « Heure »…). */
  label: string;
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
};

/** Hauteur d'une ligne (cible tactile ≥ 44 px) et nombre de lignes visibles. */
export const WHEEL_ROW_PX = 44;
export const WHEEL_ROWS = 5;
const PAD_PX = ((WHEEL_ROWS - 1) / 2) * WHEEL_ROW_PX;

// Fondu haut et bas, façon roue iOS. La ligne choisie et ses voisines immédiates
// (~75 % d'opacité) restent au-dessus de 4,5:1 (AA) ; les lignes du bord, simple
// indice de défilement, s'estompent et redeviennent nettes en approchant du centre.
const FADE =
  "linear-gradient(to bottom, transparent, rgb(0 0 0 / 0.35) 15%, #000 40%, #000 60%, rgb(0 0 0 / 0.35) 85%, transparent)";

/**
 * Colonne de roue : défilement natif avec aimantation (inertie du système), la
 * ligne au centre est la valeur. Toucher ou cliquer une ligne l'amène au centre.
 * Pour le clavier et les lecteurs d'écran, c'est une liste d'options (listbox) :
 * ↑ ↓, Page ↑ / Page ↓ (5 lignes), Début / Fin.
 */
export default function Wheel({ label, options, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // Dernière ligne émise par le défilement : y faire défiler à nouveau contrarierait l'inertie.
  const emitted = useRef<number | null>(null);
  // Défilement programmé en cours (clavier, toucher) : ses positions intermédiaires ne sont pas émises.
  const target = useRef<number | null>(null);

  // useEffect (et non useLayoutEffect) : la feuille parente doit être ouverte (showModal)
  // pour que la position de défilement s'applique.
  useEffect(() => {
    const el = ref.current;
    if (!el || emitted.current === index) return;
    const first = emitted.current === null;
    emitted.current = index;
    if (first) {
      el.scrollTop = index * WHEEL_ROW_PX;
      return;
    }
    target.current = index;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: index * WHEEL_ROW_PX, behavior: reduce ? "auto" : "smooth" });
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ROW_PX)));
    if (target.current !== null) {
      if (i === target.current) target.current = null;
      return;
    }
    if (i === emitted.current) return;
    emitted.current = i;
    onChange(options[i].value);
  };

  // Le doigt ou la molette reprend la main sur un défilement programmé.
  const takeOver = () => {
    target.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = options.length - 1;
    const next =
      e.key === "ArrowDown" ? index + 1
      : e.key === "ArrowUp" ? index - 1
      : e.key === "PageDown" ? index + 5
      : e.key === "PageUp" ? index - 5
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(options[Math.min(last, Math.max(0, next))].value);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${id}-${index}`}
      onScroll={onScroll}
      onPointerDown={takeOver}
      onTouchStart={takeOver}
      onWheel={takeOver}
      onKeyDown={onKeyDown}
      style={{ height: WHEEL_ROWS * WHEEL_ROW_PX, paddingBlock: PAD_PX, maskImage: FADE, WebkitMaskImage: FADE }}
      className="relative snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o, i) => (
        <div
          key={o.value}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === index}
          aria-label={o.spoken}
          onClick={() => onChange(o.value)}
          style={{ height: WHEEL_ROW_PX }}
          className={`flex cursor-pointer snap-center items-center justify-center px-2 text-[20px] whitespace-nowrap tabular-nums select-none ${
            i === index ? "font-semibold" : ""
          }`}
        >
          {o.label}
        </div>
      ))}
    </div>
  );
}
