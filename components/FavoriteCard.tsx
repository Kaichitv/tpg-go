"use client";

import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import type { Favorite } from "@/lib/favorites";
import FavStar from "./FavStar";
import IconButton from "./IconButton";
import StopCard from "./StopCard";

type Props = {
  favorite: Favorite;
  index: number;
  count: number;
  editing: boolean;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
};

/** Un arrêt favori et ses prochains passages ; en mode édition, réordonner ou supprimer. */
export default function FavoriteCard({ favorite, index, count, editing, onMove, onRemove }: Props) {
  return (
    <StopCard
      id={favorite.id}
      name={favorite.name}
      collapsed={editing}
      trailing={
        editing ? (
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
        )
      }
    />
  );
}
