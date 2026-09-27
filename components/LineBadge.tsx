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
  size?: "md" | "lg";
  className?: string;
};

/** Badge de ligne à sa couleur officielle (orange TPG si inconnue), texte contrasté. */
export default function LineBadge({ line, category = "", size = "md", className = "" }: Props) {
  const { bg, fg } = getLineColor(line);
  const sizing =
    size === "lg"
      ? "h-11 min-w-11 px-2.5 text-lg rounded-[13px]"
      : "h-9 min-w-10 px-2 text-[15px] rounded-[11px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold tabular-nums tracking-tight shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] ${sizing} ${className}`}
      style={{ backgroundColor: bg, color: fg }}
      aria-label={`${categoryLabel(category)} ${line}`}
      role="img"
    >
      {line}
    </span>
  );
}
