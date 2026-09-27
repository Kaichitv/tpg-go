"use client";

import { useMemo, useState } from "react";
import type { Departure } from "@/lib/types";
import DepartureRow from "./DepartureRow";
import TripSheet from "./TripSheet";

type Props = {
  departures: Departure[];
  now: number;
  /** Nom de l'arrêt consulté (contexte du suivi de trajet). */
  originName: string;
  max?: number;
};

/** Liste de passages (triés par heure effective) + feuille de suivi du trajet. */
export default function Departures({ departures, now, originName, max }: Props) {
  const [selected, setSelected] = useState<Departure | null>(null);

  const visible = useMemo(() => {
    const at = (d: Departure) => new Date(d.realtime ?? d.scheduled).getTime();
    return departures
      .filter((d) => at(d) > now - 30_000) // masque les passages déjà partis
      .sort((a, b) => at(a) - at(b))
      .slice(0, max);
  }, [departures, now, max]);

  if (!visible.length) {
    return <p className="px-4 py-5 text-[15px] text-muted">Aucun passage prévu prochainement.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-hairline">
        {visible.map((d) => (
          <li key={d.key}>
            <DepartureRow departure={d} now={now} onSelect={setSelected} />
          </li>
        ))}
      </ul>
      {selected && (
        <TripSheet key={selected.key} departure={selected} originName={originName} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
