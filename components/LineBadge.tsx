import { getLineColor } from "@/lib/lineColors";

const CATEGORY_LABELS: Record<string, string> = {
  T: "Tram",
  NFT: "Tram",
  TRAM: "Tram",
  B: "Bus",
  NFB: "Bus",
  BUS: "Bus",
  TRO: "Trolleybus",
  BAT: "Bateau",
  BAV: "Bateau",
  FAE: "Bateau",
  S: "Train",
  SN: "Train",
  R: "Train",
  RE: "Train",
  IR: "Train",
  IC: "Train",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category.toUpperCase()] ?? "Ligne";
}

type Props = {
  line: string;
  category?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Ligne d'un autre exploitant (train CFF, Léman Express…) : fond neutre, car les
   * couleurs connues sont celles des lignes TPG (« RE 33 » n'est pas le bus 33).
   */
  neutral?: boolean;
  className?: string;
};

const SIZING = {
  sm: "h-7 min-w-8 px-1.5 text-[13px] rounded-[9px]",
  md: "h-9 min-w-10 px-2 text-[15px] rounded-[11px]",
  lg: "h-11 min-w-11 px-2.5 text-lg rounded-[13px]",
} as const;

/** Badge de ligne à sa couleur officielle (orange TPG si inconnue), texte contrasté. */
export default function LineBadge({ line, category = "", size = "md", neutral = false, className = "" }: Props) {
  const { bg, fg } = getLineColor(line);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold whitespace-nowrap tabular-nums tracking-tight shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] ${SIZING[size]} ${neutral ? "bg-surface-press text-fg" : ""} ${className}`}
      style={neutral ? undefined : { backgroundColor: bg, color: fg }}
      aria-label={`${categoryLabel(category)} ${line}`}
      role="img"
    >
      {line}
    </span>
  );
}
