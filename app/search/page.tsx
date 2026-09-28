import type { Metadata } from "next";
import SearchScreen from "@/components/SearchScreen";

export const metadata: Metadata = { title: "Rechercher" };

export default function SearchPage() {
  return <SearchScreen />;
}
