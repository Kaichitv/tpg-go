// app/api/nearby/route.ts
// Arrêts les plus proches d'une position (?lat=&lon=, WGS84).

import { errorResponse } from "@/lib/apiResponse";
import { nearbyStops } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!params.get("lat") || !params.get("lon") || !inRange(lat, 90) || !inRange(lon, 180)) {
    return Response.json({ error: "bad_request", detail: "Coordonnées invalides" }, { status: 400 });
  }

  try {
    const stops = await nearbyStops(lat, lon);
    // « private » : la réponse révèle une position, pas de cache partagé.
    return Response.json({ stops }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    return errorResponse(err);
  }
}

function inRange(v: number, max: number): boolean {
  return Number.isFinite(v) && Math.abs(v) <= max;
}
