// app/api/connections/route.ts
// Itinéraires entre deux extrémités : ?from=&to=, chacune un id d'arrêt TPG
// (« 8587387 ») ou « here » (ma position, au plus une extrémité). La position
// n'arrive jamais ici : l'appareil l'a réduite (lib/walk.ts) aux arrêts proches
// avec la marche jusqu'à chacun, near=<id>:<min>,…, et à la marche directe
// jusqu'à l'autre extrémité si elle est à distance de marche, walk=<min>.
// Itinéraire planifié : at=<ISO> (partir à), avec arriveBy=1 (arriver à).
// La logique (marche, tri) est dans lib/itinerary.ts.

import { errorResponse } from "@/lib/apiResponse";
import { planConnections } from "@/lib/itinerary";
import { PLAN_DAYS } from "@/lib/plannedTime";
import type { ConnectionsResult, Endpoint, PlannedTime, WalkStop } from "@/lib/types";
import { CANDIDATES, MAX_DIRECT_WALK_MIN, MAX_NEAR_WALK_MIN } from "@/lib/walk";

export const dynamic = "force-dynamic"; // cache à TTL strict géré dans lib/transport.ts

/** Heure planifiée acceptée : un peu dans le passé (horloges décalées), jusqu'à l'horizon de planification. */
const PAST_TOLERANCE_MS = 60 * 60_000;
const MAX_AHEAD_MS = (PLAN_DAYS + 1) * 86_400_000;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const from = parseEndpoint(p.get("from"), p);
  const to = parseEndpoint(p.get("to"), p);

  if (!from || !to) {
    return badRequest("Paramètres requis : from et to (id d'arrêt, ou « here » avec near)");
  }
  if (from.kind === "position" && to.kind === "position") {
    return badRequest("Une seule extrémité peut être une position");
  }
  if (from.kind === "stop" && to.kind === "stop" && from.stopId === to.stopId) {
    return badRequest("Départ et arrivée identiques");
  }
  const when = parseWhen(p.get("at"), p.get("arriveBy"));
  if (when === undefined) {
    return badRequest(`Paramètre at invalide : date ISO 8601, au plus ${PLAN_DAYS} jours à l'avance`);
  }

  try {
    const result: ConnectionsResult = {
      updatedAt: new Date().toISOString(),
      connections: await planConnections(from, to, when),
    };
    // « private » quand la requête porte sur ma position (arrêts proches) : pas de cache partagé.
    const scope = from.kind === "position" || to.kind === "position" ? "private" : "public";
    return Response.json(result, { headers: { "Cache-Control": `${scope}, max-age=15` } });
  } catch (err) {
    return errorResponse(err);
  }
}

function parseEndpoint(raw: string | null, p: URLSearchParams): Endpoint | null {
  const v = raw?.trim() ?? "";
  if (/^\d+$/.test(v)) return { kind: "stop", stopId: v };
  if (v !== "here") return null;
  const near = parseNear(p.get("near"));
  const walk = p.get("walk");
  const directWalkMin = walk === null ? null : minutes(walk, MAX_DIRECT_WALK_MIN);
  if (!near || (walk !== null && directWalkMin === null)) return null;
  return { kind: "position", near, directWalkMin };
}

/** Heure planifiée ; null = partir maintenant, undefined = mal formée ou hors bornes. */
function parseWhen(at: string | null, arriveBy: string | null): PlannedTime | null | undefined {
  if (at === null) return arriveBy === null ? null : undefined;
  if (arriveBy !== null && arriveBy !== "1") return undefined;
  const t = Date.parse(at);
  const now = Date.now();
  if (Number.isNaN(t) || t < now - PAST_TOLERANCE_MS || t > now + MAX_AHEAD_MS) return undefined;
  return { mode: arriveBy ? "arrive" : "depart", at: new Date(t).toISOString() };
}

/** « 8587387:3,8587388:5 » → arrêts proches et marche jusqu'à chacun ; null si mal formé. */
function parseNear(raw: string | null): WalkStop[] | null {
  const parts = raw?.split(",") ?? [];
  if (!parts.length || parts.length > CANDIDATES) return null;
  const near: WalkStop[] = [];
  for (const part of parts) {
    const m = /^(\d+):(\d+)$/.exec(part);
    const walkMin = m ? minutes(m[2], MAX_NEAR_WALK_MIN) : null;
    if (!m || walkMin === null || near.some((s) => s.stopId === m[1])) return null;
    near.push({ stopId: m[1], walkMin });
  }
  return near;
}

/** Minutes entières entre 1 et `max`, sinon null. */
function minutes(raw: string, max: number): number | null {
  const n = Number(raw);
  return /^\d+$/.test(raw) && n >= 1 && n <= max ? n : null;
}

function badRequest(detail: string): Response {
  return Response.json({ error: "bad_request", detail }, { status: 400 });
}
