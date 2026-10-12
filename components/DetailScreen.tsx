"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import { useOriginTab } from "@/lib/tabs";
import { useInView } from "@/lib/useInView";
import StickyBar from "./StickyBar";

/**
 * Page de détail poussée dans l'onglet d'origine (même schéma que la page d'un
 * arrêt) : retour vers cet onglet, grand titre, titre compact quand il a défilé.
 */
export default function DetailScreen({ title, children }: { title: string; children: ReactNode }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleVisible = useInView(titleRef);
  const origin = useOriginTab();

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-tabbar">
      <StickyBar>
        <nav className="-mx-2 grid grid-cols-[1fr_auto_1fr] items-center py-1" aria-label="Navigation">
          <Link
            href={origin.href}
            className="inline-flex min-h-11 items-center gap-0.5 justify-self-start rounded-full pr-3 pl-1 text-[17px] text-accent-ink hover:bg-surface-hover"
          >
            <CaretLeftIcon size={22} weight="bold" aria-hidden />
            {origin.label}
          </Link>
          <span
            aria-hidden
            className={`max-w-[45vw] truncate text-[17px] font-semibold transition-opacity duration-200 ${titleVisible ? "opacity-0" : "opacity-100"}`}
          >
            {title}
          </span>
        </nav>
      </StickyBar>

      <h1 ref={titleRef} className="mt-2 mb-1 px-1 text-[30px] leading-tight font-bold tracking-tight">
        {title}
      </h1>
      {children}
    </main>
  );
}
