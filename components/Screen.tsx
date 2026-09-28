import type { ReactNode } from "react";

type Props = {
  /** Grand titre de l'écran (façon iOS). */
  title: string;
  /** Action à droite du titre (p. ex. « Modifier »). */
  action?: ReactNode;
  children: ReactNode;
};

/** Écran racine d'un onglet : grand titre, marges de sécurité, place pour la tabbar. */
export default function Screen({ title, action, children }: Props) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-tabbar">
      <header className="flex min-h-11 items-end justify-between gap-2 pt-4 pb-6">
        <h1 className="text-[34px] leading-none font-bold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}
