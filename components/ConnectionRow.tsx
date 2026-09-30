import type { Departure } from "@/lib/types";
import { formatClock } from "@/lib/time";
import LineBadge, { categoryLabel } from "./LineBadge";

type Props = {
  departure: Departure;
  /** Course actuellement suivie : atténuée, pour la reconnaître parmi les correspondances. */
  own?: boolean;
};

/** Un départ à un arrêt de correspondance : ligne, destination, heure de départ (non interactif). */
export default function ConnectionRow({ departure: d, own = false }: Props) {
  const at = d.realtime ?? d.scheduled;
  const late = d.delayMin !== null && d.delayMin > 0;
  const noRealtime = d.delayMin === null;
  const dim = own ? "opacity-55" : "";

  const a11y = [
    own ? "Votre course" : null,
    `${categoryLabel(d.category)} ${d.line} vers ${d.destination}`,
    `départ à ${formatClock(at)}`,
    late ? `retard de ${d.delayMin} minute${d.delayMin! > 1 ? "s" : ""}` : null,
    noRealtime ? "horaire théorique, pas de temps réel" : null,
    d.platform ? `quai ${d.platform}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
      <span className="sr-only">{a11y}</span>

      <span aria-hidden className={dim}>
        <LineBadge line={d.line} category={d.category} />
      </span>

      <span className="min-w-0" aria-hidden>
        <span className={`block truncate text-[16px] leading-snug font-medium ${dim}`}>{d.destination}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          {own ? (
            <span className="font-semibold text-accent-ink">Votre course</span>
          ) : (
            d.platform && <span>Quai {d.platform}</span>
          )}
        </span>
      </span>

      <span className={`flex flex-col items-end tabular-nums ${dim}`} aria-hidden>
        <span className={`text-[17px] font-semibold ${late ? "text-late" : ""}`}>{formatClock(at)}</span>
        {late ? (
          <span className="text-[12px] text-subtle">
            <s>{formatClock(d.scheduled)}</s>
          </span>
        ) : noRealtime ? (
          <span className="text-[12px] text-subtle">théorique</span>
        ) : null}
      </span>
    </div>
  );
}
