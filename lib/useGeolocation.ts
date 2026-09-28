"use client";

// lib/useGeolocation.ts
// Position de l'appareil pour « À proximité ». La permission n'est demandée qu'au
// geste de l'utilisateur (HIG), sauf si elle est déjà accordée : on localise alors
// dès l'ouverture. La dernière position est gardée en mémoire le temps de la
// session, pour ne pas relocaliser à chaque changement d'onglet.

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
let last: Position | null = null;

export function useGeolocation() {
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
        setState({ status: "ready", position: last });
      },
      (err) => {
        setState(err.code === err.PERMISSION_DENIED ? { status: "denied" } : { status: "failed", last });
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
    // Permission déjà accordée : pas besoin d'attendre un geste.
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
  }, [locate]);

  return { state, locate };
}

function supported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext;
}
