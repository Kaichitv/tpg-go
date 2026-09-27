"use client";

import { StarIcon } from "@phosphor-icons/react/ssr";
import { useFavorites, useHydrated } from "@/lib/favorites";
import IconButton from "./IconButton";

type Props = { id: string; name: string; className?: string };

/** Étoile d'ajout / retrait des favoris (bouton bascule). */
export default function FavStar({ id, name, className = "" }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const hydrated = useHydrated();
  const on = hydrated && isFavorite(id);

  return (
    <IconButton
      label={on ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      aria-pressed={on}
      onClick={() => toggle({ id, name })}
      className={`${on ? "text-accent-ink" : "text-muted"} ${className}`}
    >
      <StarIcon size={24} weight={on ? "fill" : "regular"} aria-hidden />
    </IconButton>
  );
}
