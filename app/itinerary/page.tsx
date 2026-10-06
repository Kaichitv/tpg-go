import type { Metadata } from "next";
import ItineraryScreen from "@/components/ItineraryScreen";
import { getTpgStop } from "@/lib/stopIndex";
import type { ItineraryQuery, Place } from "@/lib/types";

export const metadata: Metadata = { title: "Itinéraire" };

type Props = {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
};

/**
 * ?from=&to= : id d'arrêt TPG ou « here » (ma position). Sans `from`, départ de
 * ma position. Sans aucun paramètre (onglet touché), l'écran reprend la dernière
 * saisie de la session. Les noms d'arrêts sont résolus ici, dans l'index local.
 */
export default async function ItineraryPage({ searchParams }: Props) {
  const { from, to } = await searchParams;
  let initial: ItineraryQuery | null = null;
  if (from !== undefined || to !== undefined) {
    const start: Place = place(from) ?? { kind: "position" };
    const end = place(to);
    initial = { from: start, to: start.kind === "position" && end?.kind === "position" ? null : end };
  }
  // `key` : un nouveau lien (« Y aller » d'un autre arrêt) réinitialise l'écran.
  return <ItineraryScreen key={`${from ?? ""}>${to ?? ""}`} initial={initial} />;
}

function place(v: string | string[] | undefined): Place | null {
  if (typeof v !== "string") return null;
  if (v === "here") return { kind: "position" };
  const stop = getTpgStop(v);
  return stop ? { kind: "stop", id: stop.id, name: stop.name } : null;
}
