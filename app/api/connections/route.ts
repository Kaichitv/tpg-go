// app/api/connections/route.ts
// Itinéraires entre deux extrémités : ?from=&to=, chacune un id d'arrêt TPG
// (« 8587387 ») ou une position « lat,lon » (WGS84). Au plus une position.
// La logique (arrêts proches, marche estimée, tri) est dans lib/itinerary.ts.

import { errorResponse } from "@/lib/apiResponse";
import { planConnections } from "@/lib/itinerary";
import type { ConnectionsResult, Endpoint } from "@/lib/types";

export const dynamic = "force-dynamic"; // cache à TTL strict géré dans lib/transport.ts

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const from = parseEndpoint(p.get("from"));
  const to = parseEndpoint(p.get("to"));

  if (!from || !to) {
    return badRequest("Paramètres requis : from et to (id d'arrêt ou « lat,lon »)");
  }
  if (from.kind === "position" && to.kind === "position") {
    return badRequest("Une seule extrémité peut être une position");
  }
  if (from.kind === "stop" && to.kind === "stop" && from.stopId === to.stopId) {
    return badRequest("Départ et arrivée identiques");
  }

  try {
    const result: ConnectionsResult = {
      updatedAt: new Date().toISOString(),
      connections: await planConnections(from, to),
    };
    // « private » quand la requête contient une position : pas de cache partagé.
    const scope = from.kind === "position" || to.kind === "position" ? "private" : "public";
    return Response.json(result, { headers: { "Cache-Control": `${scope}, max-age=15` } });
  } catch (err) {
    return errorResponse(err);
  }
}

function parseEndpoint(raw: string | null): Endpoint | null {
  const v = raw?.trim() ?? "";
  if (/^\d+$/.test(v)) return { kind: "stop", stopId: v };
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(v);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { kind: "position", lat, lon } : null;
}

function badRequest(detail: string): Response {
  return Response.json({ error: "bad_request", detail }, { status: 400 });
}
