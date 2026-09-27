import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Libellé accessible obligatoire (bouton sans texte visible). */
  label: string;
  children: ReactNode;
};

/** Bouton-icône avec cible tactile de 44 × 44 px minimum (HIG). */
export default function IconButton({ label, children, className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-hover active:bg-surface-press disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
