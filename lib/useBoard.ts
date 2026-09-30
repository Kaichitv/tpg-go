"use client";

// lib/useBoard.ts
// Charge et rafraîchit les passages d'un arrêt tant que la page est visible :
// toutes les 15 s quand un passage est imminent (< 3 min), sinon toutes les 30 s ;
// immédiatement au retour au premier plan ou du réseau. En cas d'erreur, on
// conserve les dernières données reçues (marquées comme périmées).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard, isAbort } from "./api";
import type { Board } from "./types";

const REFRESH_MS = 30_000;
const REFRESH_SOON_MS = 15_000;
const SOON_MS = 3 * 60_000;

export type BoardState = {
  board: Board | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refresh: () => void;
};

/** Rafraîchit plus souvent quand un passage est imminent : c'est là qu'un retard compte. */
function refreshDelay(board: Board | null): number {
  if (!board) return REFRESH_MS;
  const now = Date.now();
  const soon = board.departures.some((d) => {
    const left = new Date(d.realtime ?? d.scheduled).getTime() - now;
    return left > -30_000 && left < SOON_MS;
  });
  return soon ? REFRESH_SOON_MS : REFRESH_MS;
}

export function useBoard(stopId: string, limit: number): BoardState {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const latest = useRef<Board | null>(null);

  const load = useCallback(async () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    try {
      const b = await fetchBoard(stopId, limit, c.signal);
      latest.current = b;
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
    latest.current = null;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    // Minuterie ré-armée après chaque chargement : l'intervalle suit les données reçues.
    const tick = async () => {
      stop();
      await load();
      if (!active || document.visibilityState !== "visible") return;
      stop();
      timer = setTimeout(tick, refreshDelay(latest.current));
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
  }, [load]);

  return { board, error, loading, offline, refresh: load };
}
