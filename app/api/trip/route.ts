// app/api/trip/route.ts
// Suite du trajet d'une course, retrouvée à un arrêt d'ancrage (le prochain arrêt).
// Permet de continuer à rafraîchir le suivi même après le départ de l'arrêt consulté.

import { errorResponse } from "@/lib/apiResponse";
import { getTrip } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const journey = p.get("journey")?.trim();
  const line = p.get("line")?.trim();
  const stopId = p.get("stop")?.trim();
  const at = p.get("at")?.trim();

  if (!journey || !line || !stopId || !at || !/^\d+$/.test(stopId)) {
    return Response.json(
      { error: "Paramètres requis : journey, line, stop (id), at (ISO)" },
      { status: 400 },
    );
  }

  try {
    const trip = await getTrip({ journey, line, stopId, at });
    return Response.json(trip, { headers: { "Cache-Control": "public, max-age=15" } });
  } catch (err) {
    return errorResponse(err);
  }
}
