import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  /** Action à droite du titre (p. ex. « Effacer »). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Section d'écran titrée (h2), avec action optionnelle alignée à droite. */
export default function Section({ id, title, action, children, className = "" }: Props) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-2 flex min-h-11 items-center justify-between gap-2 px-1">
        <h2 id={id} className="text-[20px] font-bold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
