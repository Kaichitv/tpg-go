import type { Metadata } from "next";
import StopBoard from "@/components/StopBoard";
import { splitStopName } from "@/lib/stopName";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { name } = await searchParams;
  return { title: typeof name === "string" ? splitStopName(name).stop : "Arrêt" };
}

export default async function StopPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { name } = await searchParams;
  return (
    <StopBoard id={decodeURIComponent(id)} initialName={typeof name === "string" ? name : undefined} />
  );
}
