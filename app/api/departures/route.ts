// app/api/departures/route.ts
// Prochains passages à un arrêt. Toute la logique source est dans lib/transport.ts :
// appel côté serveur (pas de CORS), cache amont ~20 s, API tierce protégée.

import { errorResponse } from "@/lib/apiResponse";
import { getDepartures } from "@/lib/transport";

export const dynamic = "force-dynamic"; // cache à TTL strict géré dans lib/transport.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // `stop` : identifiant numérique (recommandé) ou nom exact de l'arrêt.
  const stop = searchParams.get("stop")?.trim();
  const limit = clamp(Number(searchParams.get("limit") ?? 12), 1, 30);

  if (!stop) {
    return Response.json({ error: "Paramètre 'stop' manquant" }, { status: 400 });
  }

  try {
    const board = await getDepartures(stop, limit);
    return Response.json(board, { headers: { "Cache-Control": "public, max-age=15" } });
  } catch (err) {
    return errorResponse(err);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : max;
}
