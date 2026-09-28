"use client";

import { useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon, StarIcon } from "@phosphor-icons/react/ssr";
import { useFavorites, useHydrated } from "@/lib/favorites";
import BoardSkeleton from "./BoardSkeleton";
import Card from "./Card";
import FavoriteCard from "./FavoriteCard";
import Screen from "./Screen";

/** Onglet Favoris (accueil) : les arrêts favoris, chacun avec ses prochains passages. */
export default function FavoritesScreen() {
  const { favorites, move, remove } = useFavorites();
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const isEditing = editing && favorites.length > 0;

  return (
    <Screen
      title="Favoris"
      action={
        hydrated &&
        favorites.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={isEditing}
            className="-mr-2 min-h-11 rounded-full px-3 text-[17px] font-medium text-accent-ink hover:bg-surface-hover"
          >
            {isEditing ? "OK" : "Modifier"}
          </button>
        )
      }
    >
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
          <Link
            href="/search"
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1"
          >
            <MagnifyingGlassIcon size={18} weight="bold" aria-hidden />
            Rechercher un arrêt
          </Link>
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

      <footer className="mt-10 px-1 text-center text-[12px] leading-relaxed text-subtle">
        Horaires temps réel quand disponibles, sinon théoriques.
        <br />
        Données : transport.opendata.ch · Lignes : GTFS opentransportdata.swiss
      </footer>
    </Screen>
  );
}
