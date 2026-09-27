"use client";

import { useRef, type ReactNode } from "react";
import { useInView } from "@/lib/useInView";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Barre collée en haut de l'écran. Transparente au repos ; dès que le contenu
 * défile dessous, elle devient opaque et gagne une ombre (élévation).
 * Déborde de la marge de <main> pour couvrir toute la largeur.
 */
export default function StickyBar({ children, className = "" }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  const atTop = useInView(sentinel);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div
        data-stuck={!atTop}
        className={`sticky-bar sticky top-0 z-20 -mx-4 px-4 ${className}`}
      >
        {children}
      </div>
    </>
  );
}
