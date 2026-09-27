"use client";

import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import type { Departure } from "@/lib/types";
import { countdown, countdownLabel, formatClock } from "@/lib/time";
import LineBadge, { categoryLabel } from "./LineBadge";

type Props = {
  departure: Departure;
  now: number;
  onSelect: (d: Departure) => void;
};

/** Un passage : badge de ligne, destination, compte à rebours, retard temps réel. */
export default function DepartureRow({ departure: d, now, onSelect }: Props) {
  const at = d.realtime ?? d.scheduled;
  const c = countdown(at, now);
  const late = d.delayMin !== null && d.delayMin > 0;
  const noRealtime = d.delayMin === null;

  const a11y = [
    `${categoryLabel(d.category)} ${d.line} vers ${d.destination}`,
    countdownLabel(c),
    late ? `retard de ${d.delayMin} minute${d.delayMin! > 1 ? "s" : ""}` : null,
    noRealtime ? "horaire théorique, pas de temps réel" : null,
    d.platform ? `quai ${d.platform}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => onSelect(d)}
      aria-label={`${a11y}. Voir le trajet`}
      aria-haspopup="dialog"
      className="group grid min-h-16 w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover active:bg-surface-press"
    >
      <LineBadge line={d.line} category={d.category} />

      <span className="min-w-0" aria-hidden>
        <span className="block truncate text-[17px] leading-snug font-medium">{d.destination}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted tabular-nums">
          {late && <s className="text-subtle">{formatClock(d.scheduled)}</s>}
          <span>{formatClock(at)}</span>
          {d.platform && <span>· Quai {d.platform}</span>}
        </span>
      </span>

      <span className="flex flex-col items-end" aria-hidden>
        <Countdown c={c} late={late} />
        {late ? (
          <span className="mt-0.5 rounded-full bg-late-bg px-1.5 py-px text-[12px] font-semibold text-late tabular-nums">
            +{d.delayMin} min
          </span>
        ) : noRealtime ? (
          <span className="mt-0.5 text-[12px] text-subtle">théorique</span>
        ) : (
          <span className="mt-0.5 text-[12px] text-ontime">à l’heure</span>
        )}
      </span>

      <CaretRightIcon
        size={16}
        weight="bold"
        aria-hidden
        className="text-subtle transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

function Countdown({ c, late }: { c: ReturnType<typeof countdown>; late: boolean }) {
  const color = late ? "text-late" : "text-fg";
  if (c.kind === "now") {
    return (
      <span className="text-accent-ink tabular-nums">
        <span className="text-[20px] leading-none font-semibold tracking-tight">&lt;&thinsp;1</span>
        <span className="ml-0.5 text-[13px] font-medium">min</span>
      </span>
    );
  }
  if (c.kind === "clock") {
    return <span className={`text-[20px] font-semibold tabular-nums ${color}`}>{c.clock}</span>;
  }
  return (
    <span className={`tabular-nums ${color}`}>
      <span className="text-[24px] leading-none font-semibold tracking-tight">{c.minutes}</span>
      <span className="ml-0.5 text-[13px] font-medium">min</span>
    </span>
  );
}
