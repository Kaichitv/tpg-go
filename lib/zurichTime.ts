// lib/zurichTime.ts
// Heure murale suisse (Europe/Zurich), quel que soit le fuseau de l'appareil ou
// du serveur : « 2026-10-15 » + « 08:00 » ↔ instant. Partagé client/serveur
// (pas de "use client" : utilisable dans les composants serveur et les routes).

export const TZ = "Europe/Zurich";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date (« 2026-10-15 ») et heure (« 08:00 ») en heure suisse. */
export type WallTime = { date: string; time: string };

export function zurichWallTime(d: Date): WallTime {
  const parts = partsFmt.formatToParts(d);
  const p = (t: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === t)?.value ?? "";
  return { date: `${p("year")}-${p("month")}-${p("day")}`, time: `${p("hour")}:${p("minute")}` };
}

/**
 * Instant correspondant à une heure murale suisse ; null si le format est invalide
 * ou si l'heure n'existe pas (sautée au passage à l'heure d'été).
 */
export function fromZurichWallTime({ date, time }: WallTime): Date | null {
  const guess = wallAsUtc(date, time);
  if (guess === null) return null;
  // Décalage de Zurich à cet instant ; deuxième passe pour les changements d'heure.
  let ts = guess - offsetMs(guess);
  ts = guess - offsetMs(ts);
  const d = new Date(ts);
  const back = zurichWallTime(d);
  return back.date === date && back.time === time ? d : null;
}

/** « 2026-10-15 » + n jours (calendrier, sans fuseau). */
export function addDays(date: string, n: number): string {
  const ts = wallAsUtc(date, "00:00");
  return ts === null ? date : new Date(ts + n * 86_400_000).toISOString().slice(0, 10);
}

/** Heure murale lue comme si elle était UTC (ms) ; null si mal formée. */
function wallAsUtc(date: string, time: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, day, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  const ts = Date.UTC(y, mo - 1, day, h, mi);
  // Date.UTC accepte le 31 février (→ 3 mars) : on refuse ce qui déborde.
  const check = new Date(ts);
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === day && h < 24 && mi < 60 ? ts : null;
}

/** Avance de l'heure suisse sur UTC à l'instant `ts` (ms). */
function offsetMs(ts: number): number {
  const { date, time } = zurichWallTime(new Date(ts));
  return (wallAsUtc(date, time) ?? ts) - (ts - (ts % 60_000));
}
