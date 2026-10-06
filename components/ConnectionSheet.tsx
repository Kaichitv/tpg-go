"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretDownIcon, PersonSimpleWalkIcon, XIcon } from "@phosphor-icons/react/ssr";
import { formatDuration, leaveLabel, transfersLabel } from "@/lib/connectionLabels";
import { getLineColor } from "@/lib/lineColors";
import { formatClock } from "@/lib/time";
import type { Connection, RideLeg, TimePoint } from "@/lib/types";
import IconButton from "./IconButton";
import LineBadge from "./LineBadge";

type Props = {
  connection: Connection;
  now: number;
  onClose: () => void;
  /** Suivre l'étape à bord d'indice `legIndex` (feuille de suivi du trajet). */
  onFollow: (legIndex: number) => void;
  /** Étape dont le bouton « Suivre » reprend le focus (retour du suivi). */
  focusLeg?: number | null;
};

/** Segment du rail au-dessus ou au-dessous du point d'une ligne. */
type Rail = { kind: "line"; color: string } | { kind: "walk" } | null;

type Row =
  | {
      type: "stop";
      key: string;
      name: string;
      time: TimePoint;
      /** Heure calculée par TPG Go (marche estimée), pas fournie par la source. */
      estimated: boolean;
      platform: string | null;
      above: Rail;
      below: Rail;
    }
  | { type: "ride"; key: string; leg: RideLeg; index: number; rail: Rail; expanded: boolean }
  | { type: "via"; key: string; name: string; time: TimePoint | null; rail: Rail }
  | { type: "walk"; key: string; minutes: number; estimated: boolean; wait: number }
  | { type: "wait"; key: string; minutes: number };

const WALK: Rail = { kind: "walk" };

/**
 * Détail d'un itinéraire en feuille modale : frise des étapes (heure, rail, arrêt),
 * quais, marche et correspondances, arrêts intermédiaires dépliables. Chaque étape
 * TPG se suit dans la feuille de suivi du trajet (progression déduite des horaires).
 */
export default function ConnectionSheet({ connection: c, now, onClose, onFollow, focusLeg = null }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const rows = useMemo(() => buildRows(c, expanded), [c, expanded]);

  // Ouverture modale native (même schéma que la feuille de suivi) ; au retour du suivi,
  // le focus revient sur le bouton « Suivre » touché.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    if (focusLeg !== null) el?.querySelector<HTMLElement>(`[data-follow="${focusLeg}"]`)?.focus();
  }, [focusLeg]);

  const toggle = (i: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  const dep = at(c.departure);
  const arr = at(c.arrival);
  const minutes = Math.round((ms(arr) - ms(dep)) / 60_000);
  const estimatedWalk = c.legs.some((l) => l.kind === "walk" && l.estimated);
  const theoretical = c.legs.some((l) => l.kind === "ride" && (!l.from.time.realtime || !l.to.time.realtime));
  const titleId = `connection-${c.key}-title`;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close(); // clic sur le fond
      }}
      className="elev-4 fixed inset-x-0 top-auto bottom-0 m-0 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border-b-0 p-0 text-fg open:animate-sheet-in backdrop:animate-fade-in"
    >
      <header className="shrink-0 border-b border-hairline px-4 pt-2 pb-3">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[20px] leading-tight font-semibold tabular-nums">
              <span className="sr-only">Itinéraire de </span>
              {formatClock(dep)} <span aria-hidden>→</span>
              <span className="sr-only"> à </span> {formatClock(arr)}
            </h2>
            <p className="text-[13px] text-muted">
              {formatDuration(minutes)} · {transfersLabel(c.transfers)} ·{" "}
              <span className="font-medium text-accent-ink">{leaveLabel(c, now)}</span>
            </p>
          </div>
          <IconButton label="Fermer l’itinéraire" onClick={() => dialog.current?.close()} className="-mr-2">
            <XIcon size={22} aria-hidden />
          </IconButton>
        </div>
      </header>

      <div className="overflow-y-auto overscroll-contain py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <ol aria-label="Étapes de l’itinéraire">
          {rows.map((r) => (
            <RowItem key={r.key} row={r} now={now} onToggle={toggle} onFollow={onFollow} />
          ))}
        </ol>
        {(estimatedWalk || theoretical) && (
          <p className="mt-3 px-4 text-[13px] text-subtle">
            {estimatedWalk && "Marche « ~ » estimée à vol d’oiseau, sans tenir compte du trajet réel. "}
            {theoretical && "« prévu » : horaire théorique, pas de temps réel."}
          </p>
        )}
      </div>
    </dialog>
  );
}

function RowItem({
  row: r,
  now,
  onToggle,
  onFollow,
}: {
  row: Row;
  now: number;
  onToggle: (legIndex: number) => void;
  onFollow: (legIndex: number) => void;
}) {
  const grid = "grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-3 px-4";

  switch (r.type) {
    case "stop":
      return (
        <li className={grid}>
          <TimeCell time={r.time} estimated={r.estimated} />
          <RailCell above={r.above} below={r.below} dot="stop" />
          <div className="flex min-h-12 items-center gap-2 py-2">
            <span className="min-w-0 flex-1 text-[16px] leading-snug font-semibold">{r.name}</span>
            {r.platform && (
              <span className="shrink-0 text-[13px] text-muted">{platformLabel(r.platform)}</span>
            )}
          </div>
        </li>
      );

    case "ride": {
      const l = r.leg;
      const travelled = Math.max(1, l.stops.length - 1);
      const vias = Math.max(0, l.stops.length - 2);
      const min = Math.round((ms(at(l.to.time)) - ms(at(l.from.time))) / 60_000);
      const summary = `${travelled} arrêt${travelled > 1 ? "s" : ""} · ${min} min`;
      // Seules les courses TPG se retrouvent à coup sûr dans les tableaux de passages.
      const canFollow = l.isTpg && Boolean(l.journey) && ms(at(l.to.time)) > now;
      return (
        <li className={grid}>
          <span />
          <RailCell above={r.rail} below={r.rail} dot="none" />
          <div className="py-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <LineBadge line={l.line} category={l.category} size="sm" neutral={!l.isTpg} />
              <span className="min-w-0 text-[15px] font-medium">Direction {l.destination}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {vias ? (
                <button
                  type="button"
                  aria-expanded={r.expanded}
                  onClick={() => onToggle(r.index)}
                  className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted hover:bg-surface-hover"
                >
                  {summary}
                  <span className="sr-only">, {r.expanded ? "masquer" : "afficher"} les arrêts intermédiaires</span>
                  <CaretDownIcon
                    size={14}
                    weight="bold"
                    aria-hidden
                    className={`transition-transform ${r.expanded ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <span className="inline-flex min-h-11 items-center text-[13px] font-medium text-muted">{summary}</span>
              )}
              {canFollow && (
                <button
                  type="button"
                  data-follow={r.index}
                  aria-haspopup="dialog"
                  onClick={() => onFollow(r.index)}
                  className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent/15 px-4 text-[15px] font-semibold text-accent-ink hover:bg-accent/20"
                >
                  Suivre
                  <span className="sr-only"> le trajet de la ligne {l.line}</span>
                </button>
              )}
            </div>
          </div>
        </li>
      );
    }

    case "via":
      return (
        <li className={grid}>
          <span className="self-center text-right text-[13px] text-muted tabular-nums">
            {r.time && formatClock(at(r.time))}
          </span>
          <RailCell above={r.rail} below={r.rail} dot="via" />
          <span className="flex min-h-9 items-center text-[14px] text-muted">{r.name}</span>
        </li>
      );

    case "walk":
      return (
        <li className={grid}>
          <span />
          <RailCell above={WALK} below={WALK} dot="none" />
          <span className="flex min-h-12 items-center gap-1.5 py-2 text-[14px] text-muted">
            <PersonSimpleWalkIcon size={18} weight="bold" aria-hidden className="shrink-0" />
            <span>
              {r.estimated && "~"}
              {r.minutes} min à pied
              {r.estimated && <span className="text-subtle"> (estimation)</span>}
              {r.wait > 0 && ` · ${r.wait} min d’attente`}
            </span>
          </span>
        </li>
      );

    case "wait":
      return (
        <li className={grid}>
          <span />
          <RailCell above={WALK} below={WALK} dot="none" />
          <span className="flex min-h-11 items-center py-2 text-[14px] text-muted">
            Correspondance{r.minutes > 0 ? ` · ${r.minutes} min` : ""}
          </span>
        </li>
      );
  }
}

/** Heure effective ; en dessous, l'heure prévue barrée (retard), « prévu » ou « estimé ». */
function TimeCell({ time, estimated }: { time: TimePoint; estimated: boolean }) {
  const eff = at(time);
  const shifted = time.realtime !== null && formatClock(time.realtime) !== formatClock(time.scheduled);
  const late = shifted && ms(eff) > ms(time.scheduled);
  return (
    <span className="flex flex-col items-end justify-center py-2 tabular-nums">
      <span className={`text-[16px] font-semibold ${late ? "text-late" : estimated ? "text-muted" : ""}`}>
        {formatClock(eff)}
      </span>
      {shifted ? (
        <span className="text-[12px] text-subtle">
          <span className="sr-only">prévu </span>
          <s>{formatClock(time.scheduled)}</s>
        </span>
      ) : estimated ? (
        <span className="text-[12px] text-subtle">estimé</span>
      ) : !time.realtime ? (
        <span className="text-[12px] text-subtle">prévu</span>
      ) : null}
    </span>
  );
}

/** Rail vertical : trait à la couleur de la ligne, pointillés pour la marche et les correspondances. */
function RailCell({ above, below, dot }: { above: Rail; below: Rail; dot: "stop" | "via" | "none" }) {
  const color = (above?.kind === "line" ? above : below?.kind === "line" ? below : null)?.color ?? "var(--fg-subtle)";
  return (
    <span aria-hidden className="relative flex justify-center self-stretch">
      <Segment rail={above} className="top-0" />
      <Segment rail={below} className="bottom-0" />
      {dot === "stop" && (
        <span
          className="relative z-10 my-auto size-3.5 rounded-full border-[3px]"
          style={{ borderColor: color, background: "var(--surface-4)" }}
        />
      )}
      {dot === "via" && <span className="relative z-10 my-auto size-2 rounded-full" style={{ background: color }} />}
    </span>
  );
}

function Segment({ rail, className }: { rail: Rail; className: string }) {
  if (!rail) return null;
  if (rail.kind === "walk") {
    return <span className={`absolute h-1/2 border-l-2 border-dotted border-subtle ${className}`} />;
  }
  return <span className={`absolute h-1/2 w-1 ${className}`} style={{ background: rail.color }} />;
}

/** Frise : arrêt de départ, étape, arrêts intermédiaires (si dépliés), arrêt d'arrivée… */
function buildRows(c: Connection, expanded: ReadonlySet<number>): Row[] {
  const rows: Row[] = [];
  c.legs.forEach((leg, i) => {
    const prev = c.legs[i - 1];
    const next = c.legs[i + 1];

    if (leg.kind === "walk") {
      if (!prev) {
        rows.push({
          type: "stop",
          key: `${i}-origin`,
          name: leg.from?.name ?? "Ma position",
          time: { scheduled: leg.departure, realtime: null },
          estimated: leg.estimated,
          platform: null,
          above: null,
          below: WALK,
        });
      }
      const wait = next?.kind === "ride" ? minutesBetween(leg.arrival, at(next.from.time)) : 0;
      rows.push({ type: "walk", key: `${i}-walk`, minutes: leg.durationMin, estimated: leg.estimated, wait });
      if (!next) {
        rows.push({
          type: "stop",
          key: `${i}-destination`,
          name: leg.to?.name ?? "Ma position",
          time: { scheduled: leg.arrival, realtime: null },
          estimated: leg.estimated,
          platform: null,
          above: WALK,
          below: null,
        });
      }
      return;
    }

    const rail: Rail = { kind: "line", color: leg.isTpg ? getLineColor(leg.line).bg : "var(--fg-subtle)" };
    if (prev?.kind === "ride") {
      rows.push({ type: "wait", key: `${i}-wait`, minutes: minutesBetween(at(prev.to.time), at(leg.from.time)) });
    }
    rows.push({
      type: "stop",
      key: `${i}-board`,
      name: leg.from.stop.name,
      time: leg.from.time,
      estimated: false,
      platform: leg.from.platform,
      above: prev ? WALK : null,
      below: rail,
    });
    rows.push({ type: "ride", key: `${i}-ride`, leg, index: i, rail, expanded: expanded.has(i) });
    if (expanded.has(i)) {
      leg.stops.slice(1, -1).forEach((s, k) =>
        rows.push({ type: "via", key: `${i}-via-${k}`, name: s.name, time: s.departure ?? s.arrival, rail }),
      );
    }
    rows.push({
      type: "stop",
      key: `${i}-alight`,
      name: leg.to.stop.name,
      time: leg.to.time,
      estimated: false,
      platform: leg.to.platform,
      above: rail,
      below: next ? WALK : null,
    });
  });
  return rows;
}

/** TPG : quais lettrés (« Quai F ») ; trains : voies numérotées (« Voie 3 »). */
function platformLabel(p: string): string {
  return /^\d/.test(p) ? `Voie ${p}` : `Quai ${p}`;
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((ms(b) - ms(a)) / 60_000));
}

function at(t: TimePoint): string {
  return t.realtime ?? t.scheduled;
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}
