// lib/lineColors.ts
// Couleurs des badges de ligne. Lit le JSON généré au build par
// scripts/build-line-colors.mjs (GTFS officiel + overrides) — jamais le zip GTFS.
// Sans couleur connue : orange TPG, avec une couleur de texte choisie pour le contraste.

import generated from "./lineColors.generated.json";

export const ACCENT = "#F59700";

/** Couleurs de texte candidates pour un badge (quasi-noir chaud / blanc). */
const DARK_TEXT = "#1A1200";
const LIGHT_TEXT = "#FFFFFF";
/** WCAG AA, texte normal. */
const AA = 4.5;

export type LineColor = { bg: string; fg: string; fromSource: boolean };

type Generated = { lines: Record<string, { bg: string; fg?: string }> };
const LINES = (generated as Generated).lines;

const cache = new Map<string, LineColor>();

export function getLineColor(line: string): LineColor {
  const hit = cache.get(line);
  if (hit) return hit;

  const entry = LINES[line];
  const bg = entry?.bg ?? ACCENT;
  // On garde route_text_color s'il est lisible, sinon on calcule le meilleur contraste.
  const fg = entry?.fg && contrastRatio(bg, entry.fg) >= AA ? entry.fg : bestTextColor(bg);
  const color: LineColor = { bg, fg, fromSource: Boolean(entry) };
  cache.set(line, color);
  return color;
}

export function bestTextColor(bg: string): string {
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}

/** Rapport de contraste WCAG 2.x entre deux couleurs #RRGGBB. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
