import type { ComponentPropsWithoutRef, ElementType } from "react";

const ELEVATION = { 1: "elev-1", 2: "elev-2", 3: "elev-3" } as const;

type Props<T extends ElementType> = {
  as?: T;
  /** Niveau d'élévation (1 = carte posée, par défaut). */
  elevation?: keyof typeof ELEVATION;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** Surface élevée : fond du niveau, reflet d'arête, bordure hairline, ombre du niveau. */
export default function Card<T extends ElementType = "div">({
  as,
  elevation = 1,
  className = "",
  ...rest
}: Props<T>) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag className={`${ELEVATION[elevation]} rounded-3xl ${className}`} {...rest} />;
}
