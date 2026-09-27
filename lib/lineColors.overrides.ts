// lib/lineColors.overrides.ts
// Couleurs des lignes phares, prioritaires sur le snapshot lineColors.fallback.json.
// Elles garantissent le rendu des lignes les plus vues même si une future
// extraction (GTFS ou tpg.ch) venait à manquer ou à diverger.
//
// RÈGLE : uniquement des hex confirmés par une source officielle (tpg.ch, plan du
// réseau officiel, GTFS). Pas de source vérifiable → pas d'entrée (le snapshot ou
// l'orange TPG s'appliquent). Chaque entrée cite sa source.
//
// Vérification du 2026-09-27, double source concordante pour chaque ligne :
//   [liste]  https://www.tpg.ch/fr/lignes — objet `lignes` (couleur.color / couleur.classes)
//   [page]   https://www.tpg.ch/fr/lignes/<n> — badge `.line-logo` de la page de la ligne
// Texte : classes tpg.ch « blanc » → #FFFFFF, « noir » → #000000
// (CSS officielle : `.line-logo.blanc span { color: white }`, `.noir span { color: black }`).

export type LineColorOverride = { bg: string; text?: string };

export const LINE_COLOR_OVERRIDES: Readonly<Record<string, LineColorOverride>> = {
  // Tramways
  "12": { bg: "#F5A300", text: "#000000" }, // tpg.ch [liste] + [page] /fr/lignes/12
  "14": { bg: "#5A1E82", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/14
  "15": { bg: "#84471C", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/15
  "17": { bg: "#00ACE7", text: "#000000" }, // tpg.ch [liste] + [page] /fr/lignes/17
  "18": { bg: "#B82F89", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/18

  // Lignes urbaines principales (bus et trolleybus 1 à 19)
  "1": { bg: "#5A1E82", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/1
  "2": { bg: "#D2DB4A", text: "#000000" }, // tpg.ch [liste] + [page] /fr/lignes/2
  "3": { bg: "#B82F89", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/3
  "5": { bg: "#00ACE7", text: "#000000" }, // tpg.ch [liste] + [page] /fr/lignes/5
  "6": { bg: "#008CBE", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/6
  "7": { bg: "#00A828", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/7
  "8": { bg: "#84471C", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/8
  "9": { bg: "#E2001D", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/9
  "10": { bg: "#006E3D", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/10
  "11": { bg: "#82419E", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/11
  "19": { bg: "#A05909", text: "#FFFFFF" }, // tpg.ch [liste] + [page] /fr/lignes/19
};
