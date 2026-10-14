"use client";

// lib/useGeolocation.ts
// Position de l'appareil pour « À proximité » et l'itinéraire. La permission n'est
// demandée qu'au geste de l'utilisateur (HIG) ; une fois accordée, on localise dès
// l'ouverture. La dernière position est gardée en mémoire le temps de la session,
// pour ne pas relocaliser à chaque changement d'onglet.

import { useCallback, useEffect, useState } from "react";

export type Position = { lat: number; lon: number; accuracyM: number; at: number };

export type GeoState =
  | { status: "idle" } // pas encore demandé
  | { status: "locating"; last: Position | null }
  | { status: "ready"; position: Position }
  | { status: "denied" }
  | { status: "unsupported" } // API absente ou contexte non sécurisé (http)
  | { status: "failed"; last: Position | null }; // position introuvable ou délai dépassé

const FRESH_MS = 2 * 60_000;
// Accès déjà accordé sur cet appareil (un drapeau, jamais la position). Safari répond
// « prompt » à `permissions.query` à chaque chargement tant que la page n'a pas appelé
// l'API Geolocation (WebKit, par conception) : sans ce rappel, il faudrait retoucher
// « Utiliser ma position » à chaque ouverture de l'app sur iPhone.
const ALLOWED_KEY = "tpg-go:geo-allowed:v1";
let last: Position | null = null;

/** `auto` : localiser dès l'ouverture si l'accès a déjà été accordé ; sinon, attendre `locate`. */
export function useGeolocation(auto = true) {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const locate = useCallback(() => {
    if (!supported()) {
      setState({ status: "unsupported" });
      return;
    }
    setState({ status: "locating", last });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        last = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracyM: Math.round(p.coords.accuracy),
          at: Date.now(),
        };
        rememberAllowed(true);
        setState({ status: "ready", position: last });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Refus ou accès retiré dans les réglages : on ne relocalise plus à l'ouverture.
          rememberAllowed(false);
          setState({ status: "denied" });
        } else {
          setState({ status: "failed", last });
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, []);

  useEffect(() => {
    if (!supported()) {
      setState({ status: "unsupported" });
      return;
    }
    if (last && Date.now() - last.at < FRESH_MS) {
      setState({ status: "ready", position: last });
      return;
    }
    if (!auto) return;
    if (wasAllowed()) {
      locate();
      return;
    }
    // Pas de rappel (accordé avant ce drapeau, ou dans les réglages) : Chrome et
    // Firefox savent déjà dire si l'accès est accordé.
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (!cancelled && p.state === "granted") locate();
      })
      .catch(() => {
        /* API Permissions partielle (anciens Safari) : on attend le geste */
      });
    return () => {
      cancelled = true;
    };
  }, [auto, locate]);

  return { state, locate };
}

function supported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext;
}

function wasAllowed(): boolean {
  try {
    return localStorage.getItem(ALLOWED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberAllowed(allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(ALLOWED_KEY, "1");
    else localStorage.removeItem(ALLOWED_KEY);
  } catch {
    /* mode privé : il faudra retoucher « Utiliser ma position » à la prochaine ouverture */
  }
}
