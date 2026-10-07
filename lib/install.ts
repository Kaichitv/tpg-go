"use client";

// lib/install.ts
// Installation de la PWA. Le web n'offre pas de bouton « Installer » universel :
//  - Chromium (Chrome Android, Edge, Samsung Internet…) émet `beforeinstallprompt`,
//    capté dès le <head> (lib/installInit.ts) ; prompt() ouvre la boîte native.
//  - iOS/iPadOS n'expose aucune API : on ne peut qu'indiquer le geste
//    (Partager → Sur l'écran d'accueil).
//  - Ailleurs (Firefox, Safari macOS…), rien à proposer.

import { useSyncExternalStore } from "react";

/** Événement non standard de Chromium, absent des types DOM de TypeScript. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    /** Posé par installInitScript, vidé une fois utilisé ou l'app installée. */
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    /** Safari iOS : true quand l'app est lancée depuis l'écran d'accueil. */
    readonly standalone?: boolean;
  }
}

export type InstallMode = "prompt" | "ios" | "none";

const SNOOZE_KEY = "tpg-go:install-snoozed:v1";
/** Après « Fermer » ou un refus, la suggestion revient au plus tôt 30 jours plus tard. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

const STANDALONE_QUERY = "(display-mode: standalone)";

const listeners = new Set<() => void>();

function isStandalone(): boolean {
  return window.matchMedia(STANDALONE_QUERY).matches || navigator.standalone === true;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS se présente comme un Mac : on le reconnaît à son écran tactile.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function getSnapshot(): InstallMode {
  if (isStandalone()) return "none";
  if (window.__installPrompt) return "prompt";
  return isIOS() ? "ios" : "none";
}

function getServerSnapshot(): InstallMode {
  return "none";
}

function subscribe(listener: () => void) {
  const standalone = window.matchMedia(STANDALONE_QUERY);
  listeners.add(listener);
  // Le script du <head> est abonné avant nous : l'événement est déjà rangé quand on relit.
  window.addEventListener("beforeinstallprompt", listener);
  window.addEventListener("appinstalled", listener);
  standalone.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("beforeinstallprompt", listener);
    window.removeEventListener("appinstalled", listener);
    standalone.removeEventListener("change", listener);
  };
}

/** Ce que ce navigateur permet : boîte d'installation, consigne iOS, ou rien (déjà installée…). */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Ouvre la boîte d'installation native (Chromium) ; résout true si elle est acceptée.
 * L'événement ne sert qu'une fois : on le libère d'emblée, le navigateur en
 * réémettra un si l'installation reste possible.
 */
export async function promptInstall(): Promise<boolean> {
  const event = window.__installPrompt;
  if (!event) return false;
  window.__installPrompt = null;
  listeners.forEach((l) => l());
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

export function isInstallSnoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY)) < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeInstall() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    /* mode privé : la suggestion reviendra à la prochaine visite */
  }
}
