"use client";

// lib/time.ts
// Horloge partagée et formats d'heure (fuseau suisse, quel que soit l'appareil).

import { useEffect, useState } from "react";

const TZ = "Europe/Zurich";

const clockFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date.now() rafraîchi toutes les `intervalMs` ms (null avant l'hydratation). */
export function useNow(intervalMs = 10_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatClock(iso: string): string {
  return clockFmt.format(new Date(iso));
}

/** Minutes entières restantes (arrondi inférieur, comme les afficheurs). */
export function minutesUntil(iso: string, now: number): number {
  return Math.floor((new Date(iso).getTime() - now) / 60_000);
}

export type Countdown =
  | { kind: "now" }
  | { kind: "minutes"; minutes: number }
  | { kind: "clock"; clock: string };

/** Moins d'une minute → « maintenant » ; moins d'une heure → minutes ; sinon heure. */
export function countdown(iso: string, now: number): Countdown {
  const m = minutesUntil(iso, now);
  if (m < 1) return { kind: "now" };
  if (m < 60) return { kind: "minutes", minutes: m };
  return { kind: "clock", clock: formatClock(iso) };
}

/** `approx` : heure théorique seule (pas de temps réel), à ne pas annoncer comme certaine. */
export function countdownLabel(c: Countdown, approx = false): string {
  switch (c.kind) {
    case "now":
      return approx ? "départ théorique imminent" : "départ imminent";
    case "minutes":
      return `dans ${approx ? "environ " : ""}${c.minutes} minute${c.minutes > 1 ? "s" : ""}`;
    case "clock":
      return `à ${c.clock}`;
  }
}

export function agoLabel(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "à l’instant";
  if (s < 60) return `il y a ${s} s`;
  return `il y a ${Math.floor(s / 60)} min`;
}
