// lib/discord.ts
// Transmission des suggestions vers un salon Discord (serveur uniquement).
// L'URL du webhook vient de DISCORD_WEBHOOK_URL et n'est jamais exposée au client.

import pkg from "@/package.json";
import type { Suggestion } from "./suggestion";

export class NotConfiguredError extends Error {
  constructor() {
    super("DISCORD_WEBHOOK_URL manquant");
    this.name = "NotConfiguredError";
  }
}

const ACCENT = 0xf59700;
const TIMEOUT_MS = 8000;

export async function postSuggestion(s: Suggestion): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) throw new NotConfiguredError();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      username: "TPG Go",
      // Aucun @everyone / @here / mention ne doit pouvoir être déclenché par le texte saisi.
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: "Nouvelle suggestion",
          color: ACCENT,
          author: { name: s.name },
          description: s.message,
          footer: { text: `TPG Go v${pkg.version}` },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
}
