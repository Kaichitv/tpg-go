// app/api/departures/route.ts
// Prochains passages à un arrêt, via l'API communautaire transport.opendata.ch.
// L'appel se fait côté serveur : pas de CORS, on cache le résultat,
// et on protège l'API amont (limitée à ~1000 req/jour/IP).
//
// Pour basculer plus tard vers l'OJP officiel (opentransportdata.swiss),
// il suffit de réécrire le fetch ici : le front ne change pas.

export const dynamic = "force-dynamic"; // on gère le cache nous-mêmes ci-dessous

type RawStop = {
  departure?: string | null;
  prognosis?: { departure?: string | null; platform?: string | null } | null;
  delay?: number | null;
  platform?: string | null;
};

type RawEntry = {
  name?: string;
  number?: string;
  category?: string;
  to?: string;
  stop?: RawStop;
};

export type Departure = {
  line: string;
  category: string;
  to: string;
  scheduled: string | null; // ISO
  realtime: string | null; // ISO (prédit si dispo, sinon = théorique)
  delayMin: number;
  platform: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stop = searchParams.get("stop")?.trim();
  const limit = searchParams.get("limit") ?? "12";

  if (!stop) {
    return Response.json({ error: "Paramètre 'stop' manquant" }, { status: 400 });
  }

  const upstream =
    `https://transport.opendata.ch/v1/stationboard` +
    `?station=${encodeURIComponent(stop)}&limit=${encodeURIComponent(limit)}`;

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      // cache 20s : les mobiles peuvent poller sans marteler l'API amont
      next: { revalidate: 20 },
    });

    if (!res.ok) {
      return Response.json(
        { error: "upstream", status: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { stationboard?: RawEntry[] };

    const departures: Departure[] = (data.stationboard ?? []).map((e) => {
      const s = e.stop ?? {};
      const scheduled = s.departure ?? null;
      const realtime = s.prognosis?.departure ?? scheduled;
      return {
        line: e.number ?? e.name ?? "?",
        category: e.category ?? "",
        to: e.to ?? "",
        scheduled,
        realtime,
        delayMin: typeof s.delay === "number" ? s.delay : 0,
        platform: s.prognosis?.platform ?? s.platform ?? null,
      };
    });

    return Response.json(
      { stop, updatedAt: new Date().toISOString(), departures },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch (err) {
    return Response.json(
      { error: "fetch_failed", detail: String(err) },
      { status: 502 }
    );
  }
}
