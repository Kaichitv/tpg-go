// app/api/locations/route.ts
// Recherche d'arrêts par nom (autocomplétion du sélecteur d'arrêt).

export const dynamic = "force-dynamic";

export type StopHit = {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
};

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ stops: [] });
  }

  const upstream =
    `https://transport.opendata.ch/v1/locations` +
    `?query=${encodeURIComponent(q)}&type=station`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // les arrêts ne bougent pas
    });
    if (!res.ok) {
      return Response.json({ error: "upstream", status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as {
      stations?: Array<{
        id?: string;
        name?: string;
        coordinate?: { x?: number | null; y?: number | null };
      }>;
    };

    const stops: StopHit[] = (data.stations ?? [])
      .filter((s) => s.name)
      .map((s) => ({
        id: s.id ?? s.name!,
        name: s.name!,
        lat: s.coordinate?.x ?? null,
        lon: s.coordinate?.y ?? null,
      }));

    return Response.json({ stops });
  } catch (err) {
    return Response.json({ error: "fetch_failed", detail: String(err) }, { status: 502 });
  }
}
