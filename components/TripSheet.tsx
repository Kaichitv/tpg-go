"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlagCheckeredIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react/ssr";
import { fetchTrip, isAbort } from "@/lib/api";
import { getLineColor } from "@/lib/lineColors";
import { computeProgress, type StopState } from "@/lib/progress";
import { agoLabel, formatClock, minutesUntil, useNow } from "@/lib/time";
import type { Departure, TimePoint, TripStop } from "@/lib/types";
import IconButton from "./IconButton";
import LineBadge, { categoryLabel } from "./LineBadge";

const REFRESH_MS = 30_000;

type Props = {
  departure: Departure;
  originName: string;
  onClose: () => void;
};

/**
 * Suivi du trajet d'une course : séquence complète des arrêts à venir,
 * heure prévue + temps réel, prochain arrêt mis en avant.
 * La progression est DÉDUITE DES HORAIRES — aucune position GPS n'est affichée.
 */
export default function TripSheet({ departure: d, originName, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLLIElement>(null);
  const [stops, setStops] = useState<TripStop[]>(d.stops);
  const [updatedAt, setUpdatedAt] = useState<string>(() => new Date().toISOString());
  const [stale, setStale] = useState(false);
  const now = useNow(15_000) ?? Date.now();

  const progress = useMemo(() => computeProgress(stops, now), [stops, now]);
  const { bg: lineColor } = getLineColor(d.line);
  const hasRealtime = stops.some((s) => (s.departure ?? s.arrival)?.realtime);

  // Ouverture modale native : piège le focus, Échap ferme, fond inerte.
  // Pas de close() au démontage : il déclencherait onClose (et le double montage
  // du StrictMode refermerait la feuille) ; le retrait du DOM suffit.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Amène le prochain arrêt dans la vue à l'ouverture.
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: "center" });
  }, []);

  // Rafraîchissement : on retrouve la course au prochain arrêt (fonctionne même
  // après son départ de l'arrêt consulté), puis on fusionne avec les arrêts passés.
  const stopsRef = useRef(stops);
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);
  const refresh = useCallback(
    async (signal: AbortSignal) => {
      const cur = stopsRef.current;
      const { nextIndex } = computeProgress(cur, Date.now());
      const anchor = cur[nextIndex];
      if (!anchor?.departure) return; // course terminée ou terminus : rien à rafraîchir
      try {
        const fresh = await fetchTrip(
          { journey: d.journey, line: d.line, stopId: anchor.id, at: anchor.departure.scheduled },
          signal,
        );
        const idx = cur.findIndex((s, i) => i >= nextIndex && s.id === fresh.stops[0]?.id);
        setStops([...cur.slice(0, idx >= 0 ? idx : nextIndex), ...fresh.stops]);
        setUpdatedAt(fresh.updatedAt);
        setStale(false);
      } catch (err) {
        if (!isAbort(err)) setStale(true);
      }
    },
    [d.journey, d.line],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh(ctrl.signal);
    }, REFRESH_MS);
    return () => {
      clearInterval(t);
      ctrl.abort();
    };
  }, [refresh]);

  const titleId = `trip-${d.key}-title`;
  const next = progress.finished ? null : stops[progress.nextIndex];
  const nextTime = next ? timeOf(next) : null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) dialog.current?.close(); // clic sur le fond
      }}
      className="glass-strong fixed inset-x-0 top-auto bottom-0 m-0 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border-b-0 p-0 text-fg open:animate-sheet-in backdrop:animate-fade-in"
    >
      <header className="shrink-0 border-b border-hairline px-4 pt-2 pb-3">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex items-center gap-3">
          <LineBadge line={d.line} category={d.category} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[20px] leading-tight font-semibold">
              <span className="sr-only">
                {categoryLabel(d.category)} {d.line} vers{" "}
              </span>
              {d.destination}
            </h2>
            <p className="truncate text-[13px] text-muted">
              Depuis {originName} · {formatClock(d.realtime ?? d.scheduled)}
            </p>
          </div>
          <IconButton label="Fermer le trajet" onClick={() => dialog.current?.close()} className="-mr-2">
            <XIcon size={22} aria-hidden />
          </IconButton>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-surface-hover px-3 py-2 text-[13px] leading-snug text-muted">
          <InfoIcon size={18} aria-hidden className="mt-px shrink-0" />
          <span>
            Progression <strong className="font-semibold text-fg">estimée d’après les horaires</strong>
            {hasRealtime ? " (temps réel inclus)" : ""}. Pas de position GPS du véhicule.
          </span>
        </p>

        <div className="mt-2 flex items-center justify-between gap-2 text-[13px]" aria-live="polite">
          {progress.finished ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-muted">
              <FlagCheckeredIcon size={16} aria-hidden /> Course terminée
            </span>
          ) : next && nextTime ? (
            <span className="font-medium text-accent-ink">
              {progress.states[progress.nextIndex] === "dwelling" ? "À l’arrêt : " : "Prochain arrêt : "}
              {next.name}
              {progress.states[progress.nextIndex] === "next" && ` · ${relative(nextTime, now)}`}
            </span>
          ) : null}
          <span className={`shrink-0 ${stale ? "text-late" : "text-subtle"}`}>
            {stale ? (
              <span className="inline-flex items-center gap-1">
                <WarningIcon size={14} aria-hidden /> Non actualisé
              </span>
            ) : (
              agoLabel(updatedAt, now)
            )}
          </span>
        </div>
        {!hasRealtime && (
          <p className="mt-1 text-[13px] text-subtle">Temps réel indisponible : horaires théoriques.</p>
        )}
      </header>

      <ol aria-label="Arrêts de la course" className="overflow-y-auto overscroll-contain py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {stops.map((s, i) => (
          <StopItem
            key={`${s.id}-${i}`}
            ref={i === progress.nextIndex ? nextRef : undefined}
            stop={s}
            state={progress.states[i]}
            first={i === 0}
            last={i === stops.length - 1}
            color={lineColor}
            now={now}
          />
        ))}
      </ol>
    </dialog>
  );
}

type ItemProps = {
  stop: TripStop;
  state: StopState;
  first: boolean;
  last: boolean;
  color: string;
  now: number;
  ref?: React.Ref<HTMLLIElement>;
};

function StopItem({ stop, state, first, last, color, now, ref }: ItemProps) {
  const passed = state === "passed";
  const current = state === "next" || state === "dwelling";
  const t = timeOf(stop);
  const late = stop.delayMin !== null && stop.delayMin > 0;
  const idle = "var(--hairline)";

  return (
    <li
      ref={ref}
      aria-current={current ? "step" : undefined}
      className={`relative flex min-h-12 items-center gap-3 px-4 ${current ? "bg-accent/12" : ""}`}
    >
      {/* Rail : segment avant / après le point, coloré à la couleur de la ligne une fois parcouru. */}
      <span aria-hidden className="relative flex w-5 shrink-0 self-stretch justify-center">
        {!first && (
          <span
            className="absolute top-0 h-1/2 w-1 rounded-b-full"
            // Vers le prochain arrêt, la position exacte est inconnue : segment neutre
            // tant que le véhicule n'y stationne pas.
            style={{ background: passed || state === "dwelling" ? color : idle }}
          />
        )}
        {!last && (
          <span className="absolute bottom-0 h-1/2 w-1 rounded-t-full" style={{ background: passed ? color : idle }} />
        )}
        <span
          className={`relative z-10 my-auto rounded-full border-2 ${current ? "size-4 animate-pulse-ring" : "size-3"}`}
          style={{
            borderColor: passed || current ? color : "var(--fg-subtle)",
            background: passed ? color : "var(--surface-solid)",
          }}
        />
      </span>

      <span className={`min-w-0 flex-1 py-2.5 ${passed ? "opacity-55" : ""}`}>
        <span className={`block truncate text-[16px] ${current ? "font-semibold" : ""}`}>{stop.name}</span>
        {current && (
          <span className="block text-[12px] font-medium text-accent-ink">
            {state === "dwelling" ? "À l’arrêt" : "Prochain arrêt"}
            {state === "next" && t ? ` · ${relative(t, now)}` : ""}
          </span>
        )}
        <span className="sr-only">{passed ? " (desservi)" : ""}</span>
      </span>

      {t && (
        <span className={`flex shrink-0 flex-col items-end tabular-nums ${passed ? "opacity-55" : ""}`}>
          <span className={`text-[16px] font-semibold ${late ? "text-late" : ""}`}>
            {formatClock(t.realtime ?? t.scheduled)}
          </span>
          {t.realtime && t.realtime !== t.scheduled && formatClock(t.realtime) !== formatClock(t.scheduled) ? (
            <span className="text-[12px] text-subtle">
              <span className="sr-only">prévu </span>
              <s>{formatClock(t.scheduled)}</s>
            </span>
          ) : !t.realtime ? (
            <span className="text-[12px] text-subtle">prévu</span>
          ) : null}
        </span>
      )}
    </li>
  );
}

/** Heure de passage affichée : départ, ou arrivée pour le terminus. */
function timeOf(s: TripStop): TimePoint | null {
  return s.departure ?? s.arrival;
}

function relative(t: TimePoint, now: number): string {
  const m = minutesUntil(t.realtime ?? t.scheduled, now);
  return m < 1 ? "imminent" : `dans ${m} min`;
}
