// lib/suggestion.ts
// Modèle et validation d'une suggestion d'amélioration, partagés client/serveur.

export const NAME_MAX = 50;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1000;

/** Contexte grossier joint pour reproduire un bug (lib/device.ts) : ni modèle exact, ni identifiant. */
export type ClientInfo = {
  /** « iPhone », « téléphone », « ordinateur »… */
  device: string;
  /** « iOS 26.1 », « Android 14 » ; vide si inconnu. */
  os: string;
  /** « Safari 26.1 », « Chrome 141 »… */
  browser: string;
  /** Lancée depuis l'écran d'accueil (PWA) plutôt que dans le navigateur. */
  installed: boolean;
};

export type Suggestion = {
  /** Nom ou pseudo, facultatif (minimisation) : chaîne vide si absent. */
  name: string;
  message: string;
  /** Joint seulement si la case du formulaire reste cochée. */
  client: ClientInfo | null;
};

const CLIENT_FIELD_MAX = 40;
// Libellés produits par lib/device.ts : lettres, chiffres et ponctuation simple (pas de Markdown Discord).
const CLIENT_FIELD = /^[\p{L}\p{N} .,+()-]*$/u;

/** Valide un corps de requête ; renvoie la suggestion nettoyée, ou un message d'erreur. */
export function parseSuggestion(body: unknown): Suggestion | string {
  if (typeof body !== "object" || body === null) return "Requête invalide.";
  const { name = "", message, client } = body as Record<string, unknown>;
  if (typeof name !== "string" || typeof message !== "string") return "Requête invalide.";

  const n = name.trim().replace(/\s+/g, " ");
  const m = message.trim();
  if (n.length > NAME_MAX) return `Nom trop long (${NAME_MAX} caractères max).`;
  if (m.length < MESSAGE_MIN) return `Suggestion trop courte (${MESSAGE_MIN} caractères min).`;
  if (m.length > MESSAGE_MAX) return `Suggestion trop longue (${MESSAGE_MAX} caractères max).`;
  // Contexte facultatif : mal formé, il est ignoré sans bloquer l'envoi.
  return { name: n, message: m, client: parseClientInfo(client) };
}

function parseClientInfo(v: unknown): ClientInfo | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const device = clientField(r.device);
  const os = clientField(r.os);
  const browser = clientField(r.browser);
  // Discord refuse un champ vide : appareil et navigateur sont obligatoires.
  if (!device || os === null || !browser || typeof r.installed !== "boolean") return null;
  return { device, os, browser, installed: r.installed };
}

function clientField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length <= CLIENT_FIELD_MAX && CLIENT_FIELD.test(s) ? s : null;
}
