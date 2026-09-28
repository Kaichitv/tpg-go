// lib/suggestion.ts
// Modèle et validation d'une suggestion d'amélioration, partagés client/serveur.

export const NAME_MAX = 50;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1000;

export type Suggestion = {
  name: string;
  message: string;
};

/** Valide un corps de requête ; renvoie la suggestion nettoyée, ou un message d'erreur. */
export function parseSuggestion(body: unknown): Suggestion | string {
  if (typeof body !== "object" || body === null) return "Requête invalide.";
  const { name, message } = body as Record<string, unknown>;
  if (typeof name !== "string" || typeof message !== "string") return "Requête invalide.";

  const n = name.trim().replace(/\s+/g, " ");
  const m = message.trim();
  if (!n) return "Indique ton nom.";
  if (n.length > NAME_MAX) return `Nom trop long (${NAME_MAX} caractères max).`;
  if (m.length < MESSAGE_MIN) return `Suggestion trop courte (${MESSAGE_MIN} caractères min).`;
  if (m.length > MESSAGE_MAX) return `Suggestion trop longue (${MESSAGE_MAX} caractères max).`;
  return { name: n, message: m };
}
