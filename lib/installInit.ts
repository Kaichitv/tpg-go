// lib/installInit.ts
// Script inline du <head> : capte `beforeinstallprompt` (Chromium) dès son émission,
// souvent avant l'hydratation de React, et le garde pour le bouton « Installer »
// (lib/install.ts). preventDefault() remplace la mini-barre de Chrome par notre toast.
// Doit rester autonome (aucune dépendance).

export const installInitScript = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e});addEventListener("appinstalled",function(){window.__installPrompt=null})`;
