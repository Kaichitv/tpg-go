"use client";

import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import { splitStopName } from "@/lib/stopName";
import { useNow } from "@/lib/time";
import { useBoard } from "@/lib/useBoard";
import BoardSkeleton from "./BoardSkeleton";
import Departures from "./Departures";
import FavStar from "./FavStar";
import GlassCard from "./GlassCard";
import StatusLine from "./StatusLine";

type Props = { id: string; initialName?: string };

/** Tableau complet des passages d'un arrêt. */
export default function StopBoard({ id, initialName }: Props) {
  const { board, error, loading, offline, refresh } = useBoard(id, 20);
  const now = useNow(10_000);
  const fullName = board?.stop.name ?? initialName ?? "";
  const { place, stop } = splitStopName(fullName);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <nav className="-mx-2 flex items-center justify-between" aria-label="Navigation">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 text-[17px] text-accent-ink hover:bg-surface-hover"
        >
          <CaretLeftIcon size={22} weight="bold" aria-hidden />
          Accueil
        </Link>
        {fullName && <FavStar id={board?.stop.id ?? id} name={fullName} />}
      </nav>

      <header className="mt-2 mb-1 px-1">
        {place && <p className="text-[15px] font-medium text-muted">{place}</p>}
        <h1 className="text-[30px] leading-tight font-bold tracking-tight">{stop || "Arrêt"}</h1>
      </header>

      <div className="px-1">
        <StatusLine
          updatedAt={board?.updatedAt ?? null}
          loading={loading}
          error={error}
          offline={offline}
          onRefresh={refresh}
        />
      </div>

      <GlassCard as="section" aria-label="Prochains passages" className="overflow-hidden">
        {board && now ? (
          <Departures departures={board.departures} now={now} originName={board.stop.name} />
        ) : error && !loading ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[15px] text-late">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <BoardSkeleton rows={6} />
        )}
      </GlassCard>

      <p className="mt-4 px-1 text-[13px] text-subtle">Touchez un passage pour suivre son trajet.</p>
    </main>
  );
}
