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

/** Arrêt TPG proche de ma position, avec la marche estimée jusqu'à lui. */
export type WalkStop = { stopId: string; walkMin: number };

/**
 * Ma position comme extrémité d'itinéraire, réduite sur l'appareil (lib/walk.ts) :
 * arrêts proches et marche jusqu'à chacun, plus la marche directe jusqu'à l'autre
 * extrémité quand elle est à distance de marche. Aucune coordonnée.
 */
export type PositionEndpoint = { kind: "position"; near: WalkStop[]; directWalkMin: number | null };

/** Extrémité d'un itinéraire : un arrêt TPG (id DIDOK) ou ma position. */
export type Endpoint = { kind: "stop"; stopId: string } | PositionEndpoint;

/** Montée ou descente d'une étape en transport. */
export type LegStop = {
  stop: Stop;
  time: TimePoint;
  platform: string | null;
};

/** Étape à bord d'une course. */
export type RideLeg = {
  kind: "ride";
  /** Identifiant de course chez la source (sert à suivre le trajet). */
  journey: string;
  /** Libellé affiché : « 12 », « L4 », « RE 33 »… */
  line: string;
  category: string;
  operator: string | null;
  /** Ligne exploitée par les TPG : seules celles-ci prennent les couleurs officielles. */
  isTpg: boolean;
  destination: string;
  from: LegStop;
  to: LegStop;
  /** Arrêts de la course, de la montée à la descente (incluses). */
  stops: TripStop[];
};

/** Étape à pied (correspondance, ou trajet depuis / vers une position). */
export type WalkLeg = {
  kind: "walk";
  /** null = position de l'utilisateur. */
  from: Stop | null;
  to: Stop | null;
  departure: string;
  arrival: string;
  durationMin: number;
  /** Durée estimée par TPG Go à vol d'oiseau, et non fournie par la source. */
  estimated: boolean;
};

export type Leg = RideLeg | WalkLeg;

export type Connection = {
  /** Clé unique stable : courses empruntées + heure de départ théorique. */
  key: string;
  /** Heure à laquelle se mettre en route (marche initiale comprise). */
  departure: TimePoint;
  arrival: TimePoint;
  /** Nombre de changements de véhicule. */
  transfers: number;
  legs: Leg[];
};

/** Extrémité choisie dans l'UI : un arrêt, ou la position de l'appareil (localisée au besoin). */
export type Place = { kind: "position" } | { kind: "stop"; id: string; name: string };

/** Itinéraire planifié : partir à `at`, ou arriver au plus tard à `at` (ISO). */
export type PlannedTime = { mode: "depart" | "arrive"; at: string };

/** Saisie de l'onglet Itinéraire (un champ peut être vide ; `when` null = partir maintenant). */
export type ItineraryQuery = { from: Place | null; to: Place | null; when: PlannedTime | null };

export type ConnectionsResult = {
  updatedAt: string;
  connections: Connection[];
};

/** Heure effective (temps réel si dispo, sinon théorique). */
export function effectiveTime(t: TimePoint | null): string | null {
  return t ? (t.realtime ?? t.scheduled) : null;
}
