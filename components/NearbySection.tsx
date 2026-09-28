"use client";

import type { ReactNode } from "react";
import { ArrowClockwiseIcon, NavigationArrowIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import type { NearbyStops } from "@/lib/useNearbyStops";
import BoardSkeleton from "./BoardSkeleton";
import Card from "./Card";
import IconButton from "./IconButton";
import Section from "./Section";
import StopCard from "./StopCard";

/**
 * Arrêts les plus proches de la position, avec leurs prochains passages.
 * L'état (position, liste) vient du parent, pour survivre au masquage de la
 * section pendant la saisie d'une recherche.
 */
export default function NearbySection({ nearby }: { nearby: NearbyStops }) {
  const { geo, position, locate } = nearby;
  const busy = geo.status === "locating";

  return (
    <Section
      id="nearby-title"
      title="À proximité"
      action={
        position && (
          <IconButton label="Actualiser ma position" onClick={locate} disabled={busy} className="-mr-2 text-accent-ink">
            <ArrowClockwiseIcon size={22} weight="bold" aria-hidden className={busy ? "animate-spin" : ""} />
          </IconButton>
        )
      }
    >
      <p className="sr-only" aria-live="polite">
        {busy ? "Localisation en cours" : ""}
      </p>

      {position ? (
        <>
          <p className="mb-3 px-1 text-[13px] text-muted">
            Distances à vol d’oiseau depuis ta position (précision ±&nbsp;{formatDistance(position.accuracyM)}).
          </p>
          {geo.status === "failed" && <Notice>Position non actualisée : résultats de ta position précédente.</Notice>}
          <StopList nearby={nearby} />
        </>
      ) : geo.status === "idle" ? (
        <Prompt
          text="Ta position sert uniquement à trouver les arrêts les plus proches."
          action={
            <button type="button" onClick={locate} className={primaryButton}>
              <NavigationArrowIcon size={18} weight="fill" aria-hidden />
              Utiliser ma position
            </button>
          }
        />
      ) : geo.status === "locating" ? (
        <Card className="overflow-hidden" aria-busy>
          <p className="border-b border-hairline px-4 py-3 text-[15px] text-muted">Localisation…</p>
          <BoardSkeleton rows={3} />
        </Card>
      ) : geo.status === "denied" ? (
        <Prompt
          title="Accès à la position refusé"
          text="Autorise la localisation pour ce site dans les réglages du navigateur (sur iPhone : Réglages › Confidentialité et sécurité › Service de localisation), puis réessaie."
          action={
            <button type="button" onClick={locate} className={primaryButton}>
              Réessayer
            </button>
          }
        />
      ) : geo.status === "unsupported" ? (
        <p className="px-1 text-[15px] text-muted">Ce navigateur ne permet pas d’accéder à ta position.</p>
      ) : (
        <Prompt
          title="Position introuvable"
          text="Impossible de te localiser pour l’instant. Vérifie que la localisation est activée, puis réessaie."
          action={
            <button type="button" onClick={locate} className={primaryButton}>
              Réessayer
            </button>
          }
        />
      )}
    </Section>
  );
}

function StopList({ nearby }: { nearby: NearbyStops }) {
  const { status, stops } = nearby.results;

  if (!stops.length) {
    if (status === "loading") {
      return (
        <Card className="overflow-hidden" aria-busy>
          <BoardSkeleton rows={3} />
        </Card>
      );
    }
    return (
      <p className={`px-1 text-[15px] ${status === "error" ? "text-late" : "text-muted"}`}>
        {status === "error"
          ? "Impossible de récupérer les arrêts proches. Réessaie dans un instant."
          : "Aucun arrêt TPG à moins de 2 km de ta position."}
      </p>
    );
  }

  return (
    <>
      {status === "error" && <Notice>Liste non actualisée : erreur de chargement.</Notice>}
      <ul className="flex flex-col gap-4" aria-busy={status === "loading"}>
        {stops.map((s) => (
          <li key={s.id}>
            <StopCard
              id={s.id}
              name={s.name}
              headingLevel={3}
              detail={s.distanceM !== null ? formatDistance(s.distanceM) : undefined}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function Prompt({ title, text, action }: { title?: string; text: string; action: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-6 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
        <NavigationArrowIcon size={26} weight="fill" aria-hidden />
      </span>
      {title && <p className="text-[17px] font-semibold">{title}</p>}
      <p className="max-w-xs text-[15px] text-muted">{text}</p>
      {action}
    </Card>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 rounded-2xl bg-late-bg px-3 py-2 text-[13px] text-late">
      <WarningIcon size={16} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

const primaryButton =
  "mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1";

const metres = new Intl.NumberFormat("fr-CH", { style: "unit", unit: "meter", maximumFractionDigits: 0 });
const kilometres = new Intl.NumberFormat("fr-CH", { style: "unit", unit: "kilometer", maximumFractionDigits: 1 });

/** 85 → « 85 m » (arrondi à 10 m au-delà de 100 m) ; 1240 → « 1,2 km ». */
function formatDistance(m: number): string {
  if (m < 1000) return metres.format(m < 100 ? m : Math.round(m / 10) * 10);
  return kilometres.format(m / 1000);
}
