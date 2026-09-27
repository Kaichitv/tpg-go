"use client";

import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import type { Favorite } from "@/lib/favorites";
import { splitStopName } from "@/lib/stopName";
import { useNow } from "@/lib/time";
import { useBoard } from "@/lib/useBoard";
import BoardSkeleton from "./BoardSkeleton";
import Departures from "./Departures";
import FavStar from "./FavStar";
import GlassCard from "./GlassCard";
import IconButton from "./IconButton";

type Props = {
  favorite: Favorite;
  index: number;
  count: number;
  editing: boolean;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

const AT_A_GLANCE = 3;

/** Un arrêt favori et ses prochains passages en un coup d'œil. */
export default function FavoriteCard({ favorite, index, count, editing, onMove, onRemove }: Props) {
  const { board, error, loading } = useBoard(favorite.id, 8);
  const now = useNow(10_000);
  const { place, stop } = splitStopName(favorite.name);
  const headingId = `fav-${favorite.id}`;

  return (
    <GlassCard as="article" aria-labelledby={headingId} className="overflow-hidden">
      <div className="flex items-center gap-1 border-b border-hairline py-1 pr-1.5 pl-4">
        <Link
          href={`/stop/${encodeURIComponent(favorite.id)}?name=${encodeURIComponent(favorite.name)}`}
          className="group -my-1 flex min-h-12 min-w-0 flex-1 items-center gap-1 rounded-xl"
        >
          <span className="min-w-0">
            <h3 id={headingId} className="truncate text-[17px] leading-tight font-semibold">
              {stop}
            </h3>
            {place && <span className="block truncate text-[13px] text-muted">{place}</span>}
          </span>
          <CaretRightIcon
            size={16}
            weight="bold"
            aria-hidden
            className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
          />
          <span className="sr-only">: voir tous les passages</span>
        </Link>

        {editing ? (
          <div className="flex items-center">
            <IconButton label={`Monter ${favorite.name}`} disabled={index === 0} onClick={() => onMove(favorite.id, -1)}>
              <ArrowUpIcon size={20} aria-hidden />
            </IconButton>
            <IconButton
              label={`Descendre ${favorite.name}`}
              disabled={index === count - 1}
              onClick={() => onMove(favorite.id, 1)}
            >
              <ArrowDownIcon size={20} aria-hidden />
            </IconButton>
            <IconButton label={`Supprimer ${favorite.name} des favoris`} onClick={() => onRemove(favorite.id)} className="text-late">
              <TrashIcon size={20} aria-hidden />
            </IconButton>
          </div>
        ) : (
          <FavStar id={favorite.id} name={favorite.name} />
        )}
      </div>

      {!editing &&
        (board && now ? (
          <Departures departures={board.departures} now={now} originName={board.stop.name} max={AT_A_GLANCE} />
        ) : error && !loading ? (
          <p className="px-4 py-4 text-[15px] text-late">{error}</p>
        ) : (
          <BoardSkeleton rows={AT_A_GLANCE} />
        ))}
      {!editing && board && error && (
        <p className="border-t border-hairline px-4 py-2 text-[12px] text-late">{error} · données précédentes</p>
      )}
    </GlassCard>
  );
}
