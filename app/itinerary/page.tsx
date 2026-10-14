import type { Metadata } from "next";
import ItineraryScreen from "@/components/ItineraryScreen";
import { isPlannable, parsePlannedParam } from "@/lib/plannedTime";
import { getTpgStop } from "@/lib/stopIndex";
import type { ItineraryQuery, Place, PlannedTime } from "@/lib/types";

export const metadata: Metadata = { title: "Itinéraire" };

type Param = string | string[] | undefined;

type Props = {
  searchParams: Promise<{ from?: Param; to?: Param; depart?: Param; arrive?: Param }>;
};

/**
 * ?from=&to= : id d'arrêt TPG ou « here » (ma position). Sans `from`, départ de
 * ma position. ?depart= ou ?arrive= : heure suisse « 2026-10-15T08:00 » ; sans
 * eux, ou si l'heure est passée, départ immédiat. Sans aucun paramètre (onglet
 * touché), l'écran reprend la dernière saisie de la session. Les noms d'arrêts
 * sont résolus ici, dans l'index local.
 */
export default async function ItineraryPage({ searchParams }: Props) {
  const { from, to, depart, arrive } = await searchParams;
  let initial: ItineraryQuery | null = null;
  if ([from, to, depart, arrive].some((v) => v !== undefined)) {
    const start: Place = place(from) ?? { kind: "position" };
    const end = place(to);
    initial = {
      from: start,
      to: start.kind === "position" && end?.kind === "position" ? null : end,
      when: planned("arrive", arrive) ?? planned("depart", depart),
    };
  }
  // `key` : un nouveau lien (« Y aller » d'un autre arrêt) réinitialise l'écran.
  const key = [from, to, depart, arrive].map((v) => v ?? "").join(">");
  return <ItineraryScreen key={key} initial={initial} />;
}

function place(v: Param): Place | null {
  if (typeof v !== "string") return null;
  if (v === "here") return { kind: "position" };
  const stop = getTpgStop(v);
  return stop ? { kind: "stop", id: stop.id, name: stop.name } : null;
}

function planned(mode: PlannedTime["mode"], v: Param): PlannedTime | null {
  const when = typeof v === "string" ? parsePlannedParam(mode, v) : null;
  return when && isPlannable(when.at, Date.now()) ? when : null;
}
