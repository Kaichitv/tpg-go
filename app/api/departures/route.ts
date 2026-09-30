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
  const limit = clamp(Number(searchParams.get("limit") ?? 12), 1, 60);
  // `from` (ISO, optionnel) : départs à partir de cette heure — sert aux correspondances
  // à un arrêt futur d'une course. La séquence d'arrêts n'y est pas utile : on l'omet
  // pour alléger la réponse (jusqu'à 60 départs).
  const fromRaw = searchParams.get("from");
  const from = fromRaw ? new Date(fromRaw) : undefined;

  if (!stop) {
    return Response.json({ error: "Paramètre 'stop' manquant" }, { status: 400 });
  }
  if (from && Number.isNaN(from.getTime())) {
    return Response.json({ error: "Paramètre 'from' invalide" }, { status: 400 });
  }

  try {
    const board = await getDepartures(stop, limit, { from, withStops: !from });
    // Cache navigateur plus court que le rafraîchissement le plus rapide (15 s, lib/useBoard.ts),
    // sinon un rafraîchissement sur deux resservirait la réponse précédente.
    return Response.json(board, { headers: { "Cache-Control": "public, max-age=10" } });
  } catch (err) {
    return errorResponse(err);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : max;
}
