"use client";

import { ArrowClockwiseIcon, WarningIcon, WifiSlashIcon } from "@phosphor-icons/react/ssr";
import { agoLabel, useNow } from "@/lib/time";
import IconButton from "./IconButton";

type Props = {
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  onRefresh: () => void;
  /** Libellé accessible du bouton d'actualisation. */
  refreshLabel?: string;
};

/** « Mis à jour il y a… » + état réseau + bouton d'actualisation. */
export default function StatusLine({
  updatedAt,
  loading,
  error,
  offline,
  onRefresh,
  refreshLabel = "Actualiser les passages",
}: Props) {
  const now = useNow(5_000);

  let text: React.ReactNode = loading ? "Actualisation…" : null;
  if (!loading && error) {
    text = (
      <span className="inline-flex items-center gap-1.5 text-late">
        {offline ? <WifiSlashIcon size={16} aria-hidden /> : <WarningIcon size={16} aria-hidden />}
        {offline ? "Hors ligne" : "Échec de l'actualisation"}
        {updatedAt ? " · données précédentes" : ""}
      </span>
    );
  } else if (!loading && updatedAt && now) {
    text = `Mis à jour ${agoLabel(updatedAt, now)}`;
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-2">
      <p className="text-[13px] text-muted" aria-live="polite">
        {text}
      </p>
      <IconButton label={refreshLabel} onClick={onRefresh} disabled={loading} className="text-muted">
        <ArrowClockwiseIcon size={20} aria-hidden className={loading ? "animate-spin" : ""} />
      </IconButton>
    </div>
  );
}
