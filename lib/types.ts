// lib/types.ts
// Modèle de domaine partagé entre les routes serveur et l'UI.
// Indépendant de la source (transport.opendata.ch aujourd'hui, OJP demain).

export type StopKind = "tram" | "bus" | "train" | "boat" | "other";

export type Stop = {
  id: string;
  name: string;
  kind: StopKind;
  lat: number | null;
  lon: number | null;
};

/** Arrêt proche d'une position ; distance à vol d'oiseau en mètres (null si inconnue). */
export type NearbyStop = Stop & { distanceM: number | null };

/** Un horaire : théorique + temps réel (null si la source n'en fournit pas). */
export type TimePoint = {
  scheduled: string; // ISO 8601 avec fuseau
  realtime: string | null;
};

/** Un arrêt de la course (séquence des arrêts à venir). */
export type TripStop = {
  id: string;
  name: string;
  arrival: TimePoint | null;
  departure: TimePoint | null;
  delayMin: number | null;
};

export type Departure = {
  /** Clé unique stable : identifiant de course + heure théorique. */
  key: string;
  /** Identifiant de la course chez la source (sert à suivre le trajet). */
  journey: string;
  line: string;
  /** Code catégorie (T = tram, B = bus…). */
  category: string;
  operator: string | null;
  destination: string;
  scheduled: string;
  realtime: string | null;
  /** Retard en minutes ; null = pas de temps réel. */
  delayMin: number | null;
  platform: string | null;
  /** Arrêts à venir, à partir de cet arrêt (inclus) jusqu'au terminus. */
  stops: TripStop[];
};

export type Board = {
  stop: Stop;
  updatedAt: string;
  departures: Departure[];
};

/** Paramètres pour retrouver une course à un arrêt donné. */
export type TripQuery = {
  journey: string;
  line: string;
  /** Arrêt d'ancrage (typiquement le prochain arrêt de la course). */
  stopId: string;
  /** Heure théorique de passage à cet arrêt (ISO). */
  at: string;
};

export type Trip = {
  journey: string;
  line: string;
  category: string;
  destination: string;
  updatedAt: string;
  /** Arrêts à partir de l'arrêt d'ancrage. */
  stops: TripStop[];
};

/** Heure effective (temps réel si dispo, sinon théorique). */
export function effectiveTime(t: TimePoint | null): string | null {
  return t ? (t.realtime ?? t.scheduled) : null;
}
