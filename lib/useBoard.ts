"use client";

// lib/useBoard.ts
// Charge et rafraîchit les passages d'un arrêt : toutes les 30 s tant que la page
// est visible, immédiatement au retour au premier plan ou du réseau. En cas
// d'erreur, on conserve les dernières données reçues (marquées comme périmées).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard, isAbort } from "./api";
import type { Board } from "./types";

const REFRESH_MS = 30_000;

export type BoardState = {
  board: Board | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refresh: () => void;
};

export function useBoard(stopId: string, limit: number): BoardState {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    try {
      const b = await fetchBoard(stopId, limit, c.signal);
      setBoard(b);
      setError(null);
      setOffline(false);
    } catch (err) {
      if (isAbort(err)) return;
      const off = typeof navigator !== "undefined" && !navigator.onLine;
      setOffline(off);
      setError(off ? "Hors ligne" : "Impossible de récupérer les horaires.");
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
  }, [stopId, limit]);

  useEffect(() => {
    setBoard(null);
    load();

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      stop();
      timer = setInterval(load, REFRESH_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", load);
    return () => {
      stop();
      ctrl.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", load);
    };
  }, [load]);

  return { board, error, loading, offline, refresh: load };
}
