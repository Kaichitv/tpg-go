"use client";

import { useNearbyStops } from "@/lib/useNearbyStops";
import NearbySection from "./NearbySection";
import RecentSection from "./RecentSection";
import Screen from "./Screen";
import StopSearch from "./StopSearch";

/** Arrêts affichés avec leurs passages (chaque carte interroge l'API toutes les 30 s). */
const MAX_NEARBY = 6;

/**
 * Onglet Recherche : champ de recherche d'arrêt ; tant qu'il est vide, les arrêts
 * récents puis ceux à proximité. La position est gardée ici, au-dessus de la
 * section, pour ne pas relocaliser à chaque frappe.
 */
export default function SearchScreen() {
  const nearby = useNearbyStops(MAX_NEARBY);

  return (
    <Screen title="Rechercher">
      <StopSearch
        idle={
          <>
            <RecentSection />
            <NearbySection nearby={nearby} />
          </>
        }
      />
    </Screen>
  );
}
