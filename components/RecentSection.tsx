"use client";

import Link from "next/link";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ssr";
import { useFavorites } from "@/lib/favorites";
import { useRecents } from "@/lib/recents";
import { splitStopName } from "@/lib/stopName";
import Card from "./Card";
import Section from "./Section";

const MAX_SHOWN = 5;

/** Arrêts récemment consultés, hors favoris (déjà dans leur onglet). */
export default function RecentSection() {
  const { recents, clear } = useRecents();
  const { isFavorite } = useFavorites();
  const shown = recents.filter((r) => !isFavorite(r.id)).slice(0, MAX_SHOWN);

  if (!shown.length) return null;

  return (
    <Section
      id="recent-title"
      title="Récents"
      className="mb-6"
      action={
        <button
          type="button"
          onClick={clear}
          className="-mr-2 min-h-11 rounded-full px-3 text-[17px] font-medium text-accent-ink hover:bg-surface-hover"
        >
          Effacer<span className="sr-only"> les arrêts récents</span>
        </button>
      }
    >
      <Card as="ul" className="divide-y divide-hairline overflow-hidden">
        {shown.map((r) => {
          const { place, stop } = splitStopName(r.name);
          return (
            <li key={r.id}>
              <Link
                href={`/stop/${encodeURIComponent(r.id)}?name=${encodeURIComponent(r.name)}`}
                className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-hover active:bg-surface-press"
              >
                <ClockCounterClockwiseIcon size={20} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{stop}</span>
                  {place && <span className="block truncate text-[13px] text-muted">{place}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </Card>
    </Section>
  );
}
