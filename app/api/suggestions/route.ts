// app/api/suggestions/route.ts
// Réception d'une suggestion d'amélioration (Réglages) et transmission sur Discord.

import { NotConfiguredError, postSuggestion } from "@/lib/discord";
import { parseSuggestion } from "@/lib/suggestion";

export const dynamic = "force-dynamic";

// Anti-abus « best effort » : mémoire de l'instance serverless, remise à zéro à chaque
// démarrage à froid. Suffisant pour freiner un envoi en rafale, pas un attaquant déterminé.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // navigateurs anciens / requêtes same-origin sans en-tête
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false; // « null » (iframe sandboxée, fichier local…)
  }
}

export async function POST(request: Request) {
  // Formulaire de l'app uniquement : on refuse les envois depuis un autre site.
  if (!sameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);

  // Pot de miel : champ invisible pour un humain, rempli par les robots. On fait comme si de rien.
  if (typeof body === "object" && body !== null && (body as Record<string, unknown>).website) {
    return Response.json({ ok: true });
  }

  const suggestion = parseSuggestion(body);
  if (typeof suggestion === "string") {
    return Response.json({ error: "invalid", detail: suggestion }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await postSuggestion(suggestion);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof NotConfiguredError) {
      return Response.json({ error: "not_configured" }, { status: 503 });
    }
    return Response.json({ error: "upstream", detail: String(err) }, { status: 502 });
  }
}
