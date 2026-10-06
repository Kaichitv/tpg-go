"use client";

import { CaretRightIcon, PersonSimpleWalkIcon } from "@phosphor-icons/react/ssr";
import { formatDuration, leaveLabel, transfersLabel } from "@/lib/connectionLabels";
import { splitStopName } from "@/lib/stopName";
import { formatClock } from "@/lib/time";
import type { Connection, Leg, RideLeg, TimePoint } from "@/lib/types";
import LineBadge, { categoryLabel } from "./LineBadge";

type Props = {
  connection: Connection;
  now: number;
  onSelect: (c: Connection) => void;
};

/**
 * Un itinéraire : heures de départ et d'arrivée, durée, enchaînement des lignes et
 * de la marche, compte à rebours avant de partir. Le temps réel est celui de la
 * première course ; sans lui, l'horaire est signalé comme théorique. Toucher la
 * carte ouvre le détail.
 */
export default function ConnectionCard({ connection: c, now, onSelect }: Props) {
  const dep = at(c.departure);
  const arr = at(c.arrival);
  const minutes = Math.round((ms(arr) - ms(dep)) / 60_000);
  const first = c.legs.find((l): l is RideLeg => l.kind === "ride") ?? null;
  const realtime = first?.from.time.realtime ?? null;
  const noRealtime = first !== null && realtime === null;
  const delayMin = realtime && first ? Math.round((ms(realtime) - ms(first.from.time.scheduled)) / 60_000) : 0;
  const late = delayMin > 0;
  const leave = leaveLabel(c, now, noRealtime);

  const summary = first
    ? `Depuis ${splitStopName(first.from.stop.name).stop} · ${transfersLabel(c.transfers)}`
    : "À pied, sans transport";

  const spoken = [
    `Départ ${formatClock(dep)}, arrivée ${formatClock(arr)}, ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    `${c.legs.map(legSpoken).join(", puis ")}.`,
    `${leave}.`,
    late ? `Retard de ${delayMin} minute${delayMin > 1 ? "s" : ""}.` : null,
    noRealtime ? "Horaire théorique, pas de temps réel." : null,
    "Voir le détail",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      aria-haspopup="dialog"
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:-outline-offset-2 active:bg-surface-press"
    >
      <span className="sr-only">{spoken}</span>
      <span aria-hidden className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-semibold tabular-nums">
            {formatClock(dep)} → {formatClock(arr)}
          </span>
          <span className="shrink-0 text-[17px] font-semibold tabular-nums">{formatDuration(minutes)}</span>
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {c.legs.map((l, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <CaretRightIcon size={12} weight="bold" className="text-subtle" />}
              {l.kind === "ride" ? (
                <LineBadge line={l.line} category={l.category} size="sm" neutral={!l.isTpg} />
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-muted tabular-nums">
                  <PersonSimpleWalkIcon size={16} weight="bold" />
                  {l.estimated && "~"}
                  {l.durationMin}
                </span>
              )}
            </span>
          ))}
        </span>

        <span className="mt-2 flex items-center justify-between gap-3 text-[13px]">
          <span className="min-w-0 text-muted">{summary}</span>
          <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
            <span className={`font-semibold ${late ? "text-late" : noRealtime ? "text-muted" : "text-accent-ink"}`}>
              {leave}
            </span>
            {late ? (
              <span className="rounded-full bg-late-bg px-1.5 py-px text-[12px] font-semibold text-late">+{delayMin} min</span>
            ) : (
              noRealtime && <span className="text-[12px] text-subtle">théorique</span>
            )}
          </span>
        </span>
      </span>
      <CaretRightIcon
        size={16}
        weight="bold"
        aria-hidden
        className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function legSpoken(l: Leg): string {
  if (l.kind === "ride") {
    return `${categoryLabel(l.category)} ${l.line} de ${l.from.stop.name} à ${l.to.stop.name}`;
  }
  const walk = `${l.estimated ? "environ " : ""}${l.durationMin} minute${l.durationMin > 1 ? "s" : ""} à pied`;
  return `${walk} jusqu’à ${l.to ? l.to.name : "ta position"}`;
}

function at(t: TimePoint): string {
  return t.realtime ?? t.scheduled;
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}
