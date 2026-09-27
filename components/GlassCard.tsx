import type { ComponentPropsWithoutRef, ElementType } from "react";

type Props<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** Surface vitrée : translucide, flou d'arrière-plan, bordure hairline, ombre douce. */
export default function GlassCard<T extends ElementType = "div">({
  as,
  className = "",
  ...rest
}: Props<T>) {
  const Tag = (as ?? "div") as ElementType;
  return <Tag className={`glass rounded-3xl ${className}`} {...rest} />;
}
