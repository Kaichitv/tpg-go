// lib/plannedTime.ts
// Itinéraire planifié : « Partir à » / « Arriver à » une date et une heure, en
// heure suisse. Bornes, libellés et format d'URL, partagés client/serveur.

import type { PlannedTime } from "./types";
import { addDays, fromZurichWallTime, TZ, zurichWallTime } from "./zurichTime";

/** Jours proposés : la source ne publie les horaires que quelques semaines à l'avance. */
export const PLAN_DAYS = 30;
/**
 * En deçà, l'heure demandée est assez proche pour suivre l'actualité (actualisation
 * fréquente, suivi d'une étape). Au-delà, le temps réel n'est pas encore connu.
 */
export const LIVE_AHEAD_MS = 60 * 60_000;
/** Pas des minutes dans le sélecteur (roue de 12 lignes). */
export const MINUTE_STEP = 5;
/** Une heure dépassée depuis moins longtemps reste valable (heure choisie à la minute près). */
const PAST_GRACE_MS = 60_000;

/** Heure entre maintenant (à la minute près) et l'horizon de planification. */
export function isPlannable(at: string, now: number): boolean {
  const t = Date.parse(at);
  return t >= now - PAST_GRACE_MS && t <= now + PLAN_DAYS * 86_400_000;
}

/** Itinéraire immédiat, ou heure planifiée assez proche pour suivre l'actualité. */
export function isLive(when: PlannedTime | null, now: number): boolean {
  return !when || Date.parse(when.at) - now < LIVE_AHEAD_MS;
}

/** Instant → « 2026-10-15T08:00 » (heure suisse) : URL lisible et partageable. */
export function plannedParam(when: PlannedTime): string {
  const { date, time } = zurichWallTime(new Date(when.at));
  return `${date}T${time}`;
}

/** « 2026-10-15T08:00 » (heure suisse) → heure planifiée ; null si invalide. */
export function parsePlannedParam(mode: PlannedTime["mode"], raw: string): PlannedTime | null {
  const [date = "", time = ""] = raw.split("T");
  const at = fromZurichWallTime({ date, time });
  return at ? { mode, at: at.toISOString() } : null;
}

const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

/** Jour de `iso` par rapport à aujourd'hui : null (aujourd'hui), « demain » ou « le jeu. 15 oct. ». */
export function dayPhrase(iso: string, now: number): string | null {
  const day = zurichWallTime(new Date(iso)).date;
  const today = zurichWallTime(new Date(now)).date;
  if (day === today) return null;
  return day === addDays(today, 1) ? "demain" : `le ${dayFmt.format(new Date(iso))}`;
}

/** « Partir maintenant », « Partir à 08:00 », « Arriver demain à 08:00 », « Partir le jeu. 15 oct. à 08:00 ». */
export function plannedLabel(when: PlannedTime | null, now: number): string {
  if (!when) return "Partir maintenant";
  const day = dayPhrase(when.at, now);
  const clock = zurichWallTime(new Date(when.at)).time;
  return `${when.mode === "depart" ? "Partir" : "Arriver"} ${day ? `${day} ` : ""}à ${clock}`;
}

/**
 * Jours proposés dans le sélecteur : « Aujourd'hui », « Demain », « Sam. 17 oct. »…,
 * et leur lecture complète (« demain, jeudi 15 octobre »).
 */
export function dayOptions(now: number): { value: string; label: string; spoken: string }[] {
  const today = zurichWallTime(new Date(now)).date;
  return Array.from({ length: PLAN_DAYS }, (_, i) => {
    const value = addDays(today, i);
    // Midi : jamais dans une heure sautée, le jour affiché est le bon.
    const noon = fromZurichWallTime({ date: value, time: "12:00" }) ?? new Date(now);
    const long = longDayFmt.format(noon);
    if (i < 2) return { value, label: i ? "Demain" : "Aujourd’hui", spoken: `${i ? "demain" : "aujourd’hui"}, ${long}` };
    const label = dayFmt.format(noon);
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1), spoken: long };
  });
}
