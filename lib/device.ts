"use client";

// lib/device.ts
// Appareil, système et navigateur joints à une suggestion, pour aider à reproduire un
// bug. Volontairement grossier : versions majeures, jamais le modèle exact. Le
// User-Agent est en partie figé par les navigateurs :
//  - Safari 26+ annonce iOS 18.6 ou 18.7 quelle que soit la version, mais garde la
//    sienne (Version/26.1), qui suit celle d'iOS ;
//  - Chrome Android annonce « Android 10; K » quelle que soit la version ;
//  - macOS reste « 10_15_7 », Windows « NT 10.0 » (10 comme 11).
// Les Client Hints de Chromium (userAgentData) donnent alors la vraie version du système.

import { useEffect, useState } from "react";
import { isStandalone } from "./install";
import type { ClientInfo } from "./suggestion";

/** Client Hints de Chromium, absents des types DOM de TypeScript. */
interface NavigatorUAData {
  getHighEntropyValues(hints: string[]): Promise<{ platformVersion?: string }>;
}

declare global {
  interface Navigator {
    readonly userAgentData?: NavigatorUAData;
  }
}

/** Infos de l'appareil courant : null au rendu serveur, puis précisées par les Client Hints. */
export function useClientInfo(): ClientInfo | null {
  const [info, setInfo] = useState<ClientInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = (platformVersion?: string) =>
      describeClient(navigator.userAgent, navigator.maxTouchPoints > 1, isStandalone(), platformVersion);
    setInfo(read());
    navigator.userAgentData
      ?.getHighEntropyValues(["platformVersion"])
      .then((h) => {
        if (!cancelled) setInfo(read(h.platformVersion));
      })
      .catch(() => {
        /* indices refusés : la lecture du User-Agent suffit */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}

/** « iPhone, iOS 26.1 · Safari 26.1 · app installée » */
export function clientLabel(c: ClientInfo): string {
  return [c.os ? `${c.device}, ${c.os}` : c.device, c.browser, c.installed ? "app installée" : "dans le navigateur"].join(
    " · ",
  );
}

export function describeClient(ua: string, touch: boolean, standalone: boolean, platformVersion?: string): ClientInfo {
  return { ...platform(ua, touch, platformVersion), browser: browser(ua), installed: standalone };
}

function platform(ua: string, touch: boolean, platformVersion?: string): { device: string; os: string } {
  const hinted = platformVersion ? Number.parseInt(platformVersion, 10) : Number.NaN;
  const known = !Number.isNaN(hinted);
  // iPadOS se présente comme un Mac : on le reconnaît à son écran tactile.
  const ipad = ua.includes("iPad") || (ua.includes("Macintosh") && touch);
  if (ipad || /iPhone|iPod/.test(ua)) {
    return { device: ipad ? "iPad" : "iPhone", os: `${ipad ? "iPadOS" : "iOS"} ${appleVersion(ua)}`.trim() };
  }
  if (ua.includes("Android")) {
    const v = /Android (\d+)/.exec(ua);
    const frozen = ua.includes("Android 10; K)");
    return {
      device: ua.includes("Mobile") ? "téléphone" : "tablette",
      os: `Android ${known ? hinted : v && !frozen ? v[1] : ""}`.trim(),
    };
  }
  if (ua.includes("CrOS")) return { device: "ordinateur", os: "ChromeOS" };
  if (ua.includes("Windows")) {
    // Client Hints : 13 et plus pour Windows 11, 1 à 12 pour Windows 10.
    const v = !known || hinted < 1 ? "" : hinted >= 13 ? "11" : "10";
    return { device: "ordinateur", os: `Windows ${v}`.trim() };
  }
  if (ua.includes("Macintosh")) return { device: "ordinateur", os: known ? `macOS ${hinted}` : "macOS" };
  if (ua.includes("Linux")) return { device: "ordinateur", os: "Linux" };
  return { device: "appareil inconnu", os: "" };
}

/** Version d'iOS : celle de Safari quand elle est là (non figée), sinon celle du système. */
function appleVersion(ua: string): string {
  const safari = /Version\/(\d+(?:\.\d+)?)/.exec(ua);
  if (safari && !/(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(ua)) return safari[1];
  const os = /OS (\d+)_(\d+)/.exec(ua);
  if (!os) return "";
  // 18.6 et au-delà peut être iOS 26 ou suivant, annoncé comme 18.x par WebKit (app installée…).
  return os[1] === "18" && Number(os[2]) >= 6 ? `${os[1]}.${os[2]} ou plus` : `${os[1]}.${os[2]}`;
}

// Ordre important : Edge, Opera et Samsung Internet s'annoncent aussi comme Chrome et Safari.
const BROWSERS: [RegExp, string][] = [
  [/(?:Edg|EdgA|EdgiOS)\/(\d+)/, "Edge"],
  [/(?:OPR|OPT|OPiOS)\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:CriOS|Chrome)\/(\d+)/, "Chrome"],
  [/Version\/(\d+(?:\.\d+)?).*Safari/, "Safari"],
];

function browser(ua: string): string {
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]}`;
  }
  // Apple sans jeton de navigateur (app installée, vue web) : c'est le moteur de Safari.
  return /iPhone|iPad|iPod|Macintosh/.test(ua) ? "Safari" : "navigateur inconnu";
}
