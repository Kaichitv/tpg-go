"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";
import { splitStopName } from "@/lib/stopName";
import { useNow } from "@/lib/time";
import { useBoard } from "@/lib/useBoard";
import BoardSkeleton from "./BoardSkeleton";
import Card from "./Card";
import Departures from "./Departures";

type Props = {
  id: string;
  name: string;
  /** Précision affichée après la localité (p. ex. une distance). */
  detail?: string;
  /** Actions à droite de l'en-tête (étoile, boutons d'édition…). */
  trailing?: ReactNode;
  /** Masque les passages (mode édition). */
  collapsed?: boolean;
  /** Niveau du titre de la carte dans la page (h2 par défaut). */
  headingLevel?: 2 | 3;
};

const AT_A_GLANCE = 3;

/** Un arrêt et ses prochains passages en un coup d'œil ; l'en-tête ouvre le tableau complet. */
export default function StopCard({ id, name, detail, trailing, collapsed = false, headingLevel = 2 }: Props) {
  const { board, error, loading } = useBoard(id, 8);
  const now = useNow(10_000);
  const { place, stop } = splitStopName(name);
  const headingId = `stop-card-${id}`;
  const subtitle = [place, detail].filter(Boolean).join(" · ");
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <Card as="article" aria-labelledby={headingId} className="overflow-hidden">
      <div className="flex items-center gap-1 border-b border-hairline py-1 pr-1.5 pl-4">
        <Link
          href={`/stop/${encodeURIComponent(id)}?name=${encodeURIComponent(name)}`}
          className="group -my-1 flex min-h-12 min-w-0 flex-1 items-center gap-1 rounded-xl"
        >
          <span className="min-w-0">
            <Heading id={headingId} className="truncate text-[17px] leading-tight font-semibold">
              {stop}
            </Heading>
            {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
          </span>
          <CaretRightIcon
            size={16}
            weight="bold"
            aria-hidden
            className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
          />
          <span className="sr-only">: voir tous les passages</span>
        </Link>
        {trailing}
      </div>

      {!collapsed &&
        (board && now ? (
          <Departures departures={board.departures} now={now} originName={board.stop.name} max={AT_A_GLANCE} />
        ) : error && !loading ? (
          <p className="px-4 py-4 text-[15px] text-late">{error}</p>
        ) : (
          <BoardSkeleton rows={AT_A_GLANCE} />
        ))}
      {!collapsed && board && error && (
        <p className="border-t border-hairline px-4 py-2 text-[12px] text-late">{error} · données précédentes</p>
      )}
    </Card>
  );
}
