"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CaretLeftIcon, WarningIcon, XIcon } from "@phosphor-icons/react/ssr";
import { getLineColor } from "@/lib/lineColors";
import { agoLabel, formatClock } from "@/lib/time";
import type { Departure, TimePoint, TripStop } from "@/lib/types";
import { useBoard } from "@/lib/useBoard";
import BoardSkeleton from "./BoardSkeleton";
import ConnectionRow from "./ConnectionRow";
import IconButton from "./IconButton";
import { categoryLabel } from "./LineBadge";

/** Passages affichés avant l'arrivée (en remontant la liste). */
const LOOKBACK_MS = 10 * 60_000;
/** Marge pour les courses en retard parties « avant » à l'horaire théorique. */
const DELAY_MARGIN_MS = 5 * 60_000;
/** ~10 min avant + ~15 min après l'arrivée aux arrêts les plus chargés (Bel-Air). */
const LIMIT = 60;
/** Hauteur de la ligne précédente laissée visible au-dessus du repère, pour suggérer le défilement. */
const PEEK_PX = 36;

type Props = {
  /** Arrêt de la course consulté (données rafraîchies par la feuille parente). */
  stop: TripStop;
  /** Arrivée de la course à cet arrêt. */
  arrival: TimePoint;
  journey: string;
  line: string;
  category: string;
  titleId: string;
  now: number;
  onBack: () => void;
  onClose: () => void;
};

/**
 * Correspondances à un arrêt de la course : départs autour de l'heure d'arrivée,
 * avec un repère « votre course arrive ». On ouvre la liste sur ce repère ; les
 * passages précédents restent accessibles en remontant.
 */
export default function ConnectionsView({
  stop,
  arrival,
  journey,
  line,
  category,
  titleId,
  now,
  onBack,
  onClose,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLLIElement>(null);
  const scrolled = useRef(false);

  // Début de la fenêtre figé à l'ouverture : une valeur stable évite de tout recharger à
  // chaque minute. Inutile de remonter avant maintenant (départs déjà partis).
  const [from] = useState(() => {
    const arr = new Date(arrival.realtime ?? arrival.scheduled).getTime();
    return new Date(Math.max(arr - LOOKBACK_MS, Date.now() - DELAY_MARGIN_MS)).toISOString();
  });
  const { board, error, loading, offline, refresh } = useBoard(stop.id, LIMIT, from);

  const arrivalAt = new Date(arrival.realtime ?? arrival.scheduled).getTime();
  const { bg: lineColor, fg: lineInk } = getLineColor(line);
  const vehicle = categoryLabel(category).toLowerCase();

  const { before, own, after } = useMemo(() => {
    const at = (d: Departure) => new Date(d.realtime ?? d.scheduled).getTime();
    const isOwn = (d: Departure) => d.journey === journey && d.line === line;
    const list = (board?.departures ?? [])
      .filter((d) => at(d) > now - 30_000) // masque les passages déjà partis
      .sort((a, b) => at(a) - at(b));
    const others = list.filter((d) => !isOwn(d));
    // La course suivie est placée juste après le repère, même si les deux sources
    // (trajet / tableau) n'ont pas été rafraîchies au même instant.
    return {
      before: others.filter((d) => at(d) < arrivalAt),
      own: list.find(isOwn) ?? null,
      after: others.filter((d) => at(d) >= arrivalAt),
    };
  }, [board, now, journey, line, arrivalAt]);

  // Focus sur le titre à l'ouverture : les lecteurs d'écran annoncent la nouvelle vue.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Ouvre la liste sur le repère d'arrivée (une seule fois, au premier chargement).
  useLayoutEffect(() => {
    const list = listRef.current;
    const marker = markerRef.current;
    if (scrolled.current || !board || !list || !marker) return;
    scrolled.current = true;
    list.scrollTop = Math.max(0, marker.offsetTop - PEEK_PX);
  }, [board]);

  const stale = Boolean(error && board);
  const theoretical = !arrival.realtime;

  return (
    <div className="flex min-h-0 flex-col animate-view-push">
      <header className="shrink-0 border-b border-hairline px-4 pt-2 pb-3">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex items-center gap-1">
          <IconButton label={`Retour au trajet de la ligne ${line}`} onClick={onBack} className="-ml-2">
            <CaretLeftIcon size={22} weight="bold" aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="truncate text-[20px] leading-tight font-semibold outline-none"
            >
              {stop.name}
            </h2>
            <p className="truncate text-[13px] text-muted">Correspondances</p>
          </div>
          <IconButton label="Fermer" onClick={onClose} className="-mr-2">
            <XIcon size={22} aria-hidden />
          </IconButton>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
          <span className="font-medium text-accent-ink">
            Votre {vehicle} {line} arrive à {formatClock(arrival.realtime ?? arrival.scheduled)}
            {theoretical && " (prévu)"}
          </span>
          {board && (
            <span className={`shrink-0 ${stale ? "text-late" : "text-subtle"}`}>
              {stale ? (
                <span className="inline-flex items-center gap-1">
                  <WarningIcon size={14} aria-hidden /> Non actualisé
                </span>
              ) : (
                agoLabel(board.updatedAt, now)
              )}
            </span>
          )}
        </div>
        {theoretical && (
          <p className="mt-1 text-[13px] text-subtle">Temps réel indisponible pour votre course : horaire théorique.</p>
        )}
      </header>

      <div
        ref={listRef}
        className="relative min-h-[40dvh] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {board ? (
          before.length + after.length + (own ? 1 : 0) === 0 ? (
            <p className="px-4 py-5 text-[15px] text-muted">Aucun passage prévu autour de votre arrivée.</p>
          ) : (
            <ul aria-label={`Départs à ${stop.name}`} className="divide-y divide-hairline">
              {before.map((d) => (
                <li key={d.key}>
                  <ConnectionRow departure={d} />
                </li>
              ))}
              <li ref={markerRef} className="flex items-center gap-2 px-4 py-2.5">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: lineColor }} />
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums"
                  style={{ background: lineColor, color: lineInk }}
                >
                  <span className="sr-only">Arrivée de votre {vehicle} </span>
                  <span aria-hidden>Arrivée du </span>
                  {line} · {formatClock(arrival.realtime ?? arrival.scheduled)}
                  {theoretical && " (prévu)"}
                </span>
                <span aria-hidden className="h-0.5 flex-1 rounded-full" style={{ background: lineColor }} />
              </li>
              {own && (
                <li>
                  <ConnectionRow departure={own} own />
                </li>
              )}
              {after.map((d) => (
                <li key={d.key}>
                  <ConnectionRow departure={d} />
                </li>
              ))}
            </ul>
          )
        ) : error && !loading ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[15px] text-late">{offline ? "Hors ligne" : error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <BoardSkeleton rows={6} />
        )}
      </div>
    </div>
  );
}
