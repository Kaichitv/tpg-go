// lib/themeInit.ts
// Constantes du thème utilisables côté serveur (layout) comme côté client.

export const THEME_KEY = "tpg-go:theme:v1";

/** Couleurs de la barre d'état (doivent suivre --bg de globals.css). */
export const THEME_COLORS = { light: "#f6f6f7", dark: "#08090a" } as const;

/**
 * Script inline exécuté avant le 1er rendu : pose data-theme pour éviter un
 * flash du mauvais thème. Doit rester autonome (aucune dépendance).
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
