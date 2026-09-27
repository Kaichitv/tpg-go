"use client";

import { useState } from "react";
import { StarIcon } from "@phosphor-icons/react/ssr";
import { useFavorites, useHydrated } from "@/lib/favorites";
import AppTitle from "./AppTitle";
import BoardSkeleton from "./BoardSkeleton";
import FavoriteCard from "./FavoriteCard";
import Card from "./Card";
import StickyBar from "./StickyBar";
import StopSearch from "./StopSearch";

/** Accueil : recherche d'arrêt puis favoris, chacun avec ses prochains passages. */
export default function Home() {
  const { favorites, move, remove } = useFavorites();
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const isEditing = editing && favorites.length > 0;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="pt-4 pb-3">
        <AppTitle />
      </header>

      <StickyBar className="mb-5 py-2">
        <div role="search">
          <StopSearch />
        </div>
      </StickyBar>

      <section aria-labelledby="favorites-title">
        <div className="mb-2 flex min-h-11 items-center justify-between px-1">
          <h2 id="favorites-title" className="text-[22px] font-bold tracking-tight">
            Favoris
          </h2>
          {hydrated && favorites.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={isEditing}
              className="min-h-11 rounded-full px-3 text-[17px] font-medium text-accent-ink hover:bg-surface-hover"
            >
              {isEditing ? "OK" : "Modifier"}
            </button>
          )}
        </div>

        {!hydrated ? (
          <Card className="overflow-hidden">
            <BoardSkeleton rows={2} />
          </Card>
        ) : favorites.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
              <StarIcon size={26} weight="fill" aria-hidden />
            </span>
            <p className="text-[17px] font-semibold">Aucun favori pour l’instant</p>
            <p className="max-w-xs text-[15px] text-muted">
              Recherche un arrêt, puis touche l’étoile pour retrouver ici ses prochains passages.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {favorites.map((f, i) => (
              <li key={f.id}>
                <FavoriteCard
                  favorite={f}
                  index={i}
                  count={favorites.length}
                  editing={isEditing}
                  onMove={move}
                  onRemove={remove}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-10 px-1 text-center text-[12px] leading-relaxed text-subtle">
        Horaires temps réel quand disponibles, sinon théoriques.
        <br />
        Données : transport.opendata.ch · Lignes : GTFS opentransportdata.swiss
      </footer>
    </main>
  );
}
