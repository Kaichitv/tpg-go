// app/api/locations/route.ts
// Recherche d'arrêts par nom (autocomplétion).

import { errorResponse } from "@/lib/apiResponse";
import { searchStops } from "@/lib/transport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ stops: [] });
  }

  try {
    const stops = await searchStops(q);
    return Response.json({ stops }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    return errorResponse(err);
  }
}
