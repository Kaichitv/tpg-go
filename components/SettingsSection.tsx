import type { ReactNode } from "react";

/** Groupe de l'écran Réglages : petit titre en capitales au-dessus de son contenu (HIG). */
export default function SettingsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-2 px-4 text-[13px] font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
