// lib/stopName.ts
// « Genève, Bel-Air » → { place: "Genève", stop: "Bel-Air" } pour une hiérarchie
// de titres claire (nom d'arrêt en avant, localité en sous-titre).

export function splitStopName(name: string): { place: string | null; stop: string } {
  const i = name.indexOf(", ");
  if (i <= 0) return { place: null, stop: capitalize(name) };
  return { place: name.slice(0, i), stop: capitalize(name.slice(i + 2)) };
}

/** La source écrit parfois « gare Cornavin » : majuscule initiale pour un titre. */
function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("fr-CH") + s.slice(1);
}
