// lib/lineColors.ts
// Couleurs des badges de ligne. Ordre de résolution :
//   1. lib/lineColors.overrides.ts  — lignes phares vérifiées à la main (source citée)
//   2. lib/lineColors.fallback.json — snapshot committé, produit par
//      scripts/build-line-colors.mjs (GTFS officiel, complété par tpg.ch)
//   3. orange TPG
// Le runtime ne lit que ces fichiers, jamais le zip GTFS. Le texte officiel est
// conservé s'il atteint WCAG AA sur le fond ; sinon (ou s'il manque) on calcule
// le meilleur contraste entre quasi-noir et blanc.

import fallback from "./lineColors.fallback.json";
import { LINE_COLOR_OVERRIDES } from "./lineColors.overrides";

export const ACCENT = "#F59700";

/** Couleurs de texte candidates pour un badge (quasi-noir chaud / blanc). */
const DARK_TEXT = "#1A1200";
const LIGHT_TEXT = "#FFFFFF";
const PURE_BLACK = "#000000";
/** WCAG AA, texte normal. */
const AA = 4.5;

export type LineColorSource = "override" | "fallback" | "default";
export type LineColor = { bg: string; fg: string; source: LineColorSource; fromSource: boolean };

type Entry = { bg: string; text?: string };
const FALLBACK: Readonly<Record<string, Entry>> = fallback;

const HEX = /^#[0-9A-F]{6}$/i;

const cache = new Map<string, LineColor>();

export function getLineColor(shortName: string): LineColor {
  const key = shortName.trim();
  const hit = cache.get(key);
  if (hit) return hit;

  const override = valid(LINE_COLOR_OVERRIDES[key]);
  const snapshot = override ? undefined : valid(FALLBACK[key]);
  const entry = override ?? snapshot;
  const source: LineColorSource = override ? "override" : snapshot ? "fallback" : "default";

  const bg = entry?.bg.toUpperCase() ?? ACCENT;
  const text = entry?.text && HEX.test(entry.text) ? entry.text.toUpperCase() : undefined;
  const fg = text && contrastRatio(bg, text) >= AA ? text : bestTextColor(bg);
  const color: LineColor = { bg, fg, source, fromSource: source !== "default" };
  cache.set(key, color);
  return color;
}

/** Ignore une entrée dont le fond n'est pas un #RRGGBB valide (on passe au niveau suivant). */
function valid(entry: Entry | undefined): Entry | undefined {
  return entry && HEX.test(entry.bg) ? entry : undefined;
}

export function bestTextColor(bg: string): string {
  const best = contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
  // Fonds moyens (ex. #E91E77) : le quasi-noir peut rester sous AA là où le noir pur passe.
  return best === DARK_TEXT && contrastRatio(bg, best) < AA ? PURE_BLACK : best;
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
