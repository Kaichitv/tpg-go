"use client";

import { useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GearSixIcon,
  MagnifyingGlassIcon,
  PathIcon,
  StarIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { TABS, setOriginTab, tabAt, useOriginTab, type TabId } from "@/lib/tabs";

const ICONS: Record<TabId, Icon> = {
  favorites: StarIcon,
  search: MagnifyingGlassIcon,
  itinerary: PathIcon,
  settings: GearSixIcon,
};

/**
 * Tabbar pleine largeur collée en bas (HIG) : icône + libellé, onglet actif en
 * orange et icône pleine. Sur une page de détail, l'onglet d'origine reste actif.
 * Toucher l'onglet déjà affiché remonte en haut de l'écran, comme sur iOS.
 */
export default function TabBar() {
  const pathname = usePathname();
  const root = tabAt(pathname);
  const origin = useOriginTab();
  const active = root ?? origin;

  useEffect(() => {
    if (root) setOriginTab(root.id);
  }, [root]);

  const onSameTab = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <nav aria-label="Navigation principale" className="tab-bar fixed inset-x-0 bottom-0 z-40">
      <ul className="mx-auto grid h-(--tabbar-h) max-w-xl grid-cols-4">
        {TABS.map((t) => {
          const Icon = ICONS[t.id];
          const selected = t.id === active.id;
          return (
            <li key={t.id} className="flex">
              <Link
                href={t.href}
                aria-current={selected ? (root ? "page" : "true") : undefined}
                onClick={selected && root ? onSameTab : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl pt-1 text-[11px] leading-none font-medium transition-colors focus-visible:-outline-offset-2 ${
                  selected ? "text-accent-ink" : "text-muted hover:text-fg"
                }`}
              >
                <Icon size={26} weight={selected ? "fill" : "regular"} aria-hidden />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
