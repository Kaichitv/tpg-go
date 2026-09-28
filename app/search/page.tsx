import type { Metadata } from "next";
import Screen from "@/components/Screen";
import StopSearch from "@/components/StopSearch";

export const metadata: Metadata = { title: "Rechercher" };

export default function SearchPage() {
  return (
    <Screen title="Rechercher">
      <StopSearch />
    </Screen>
  );
}
