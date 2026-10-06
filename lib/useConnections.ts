"use client";

// lib/useConnections.ts
// Charge les itinéraires entre deux extrémités et les rafraîchit toutes les 60 s
// tant que la page est visible (retards, courses passées), immédiatement au
// retour au premier plan ou du réseau. En cas d'erreur, on conserve les derniers
// résultats reçus (marqués comme périmés).

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchConnections, isAbort } from "./api";
import type { ConnectionsResult, Endpoint } from "./types";

const REFRESH_MS = 60_000;

export type ConnectionsState = {
  result: ConnectionsResult | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refresh: () => void;
};

/** `from` et `to` doivent rester stables entre les rendus (useMemo côté appelant). */
export function useConnections(from: Endpoint | null, to: Endpoint | null): ConnectionsState {
  const [result, setResult] = useState<ConnectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!from || !to) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    try {
      setResult(await fetchConnections(from, to, c.signal));
      setError(null);
      setOffline(false);
    } catch (err) {
      if (isAbort(err)) return;
      const off = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(off);
      // 404 : message utile (p. ex. aucun arrêt TPG à moins de 2 km de la position).
      const notFound = err instanceof ApiError && err.status === 404;
      setError(off ? "Hors ligne" : notFound ? err.message : "Impossible de calculer l’itinéraire.");
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!from || !to) {
      setLoading(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const tick = async () => {
      stop();
      await load();
      if (!active || document.visibilityState !== "visible") return;
      stop();
      timer = setTimeout(tick, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
      else stop();
    };

    tick();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", tick);
    return () => {
      active = false;
      stop();
      ctrl.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", tick);
    };
  }, [from, to, load]);

  return { result, error, loading, offline, refresh: load };
}
