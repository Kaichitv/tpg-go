"use client";

// lib/useStopSearch.ts
// Autocomplétion d'arrêts TPG : requête différée pendant la frappe, annulée si
// la saisie change. Partagée par la recherche et les champs de l'itinéraire.

import { useEffect, useState } from "react";
import { fetchStops, isAbort } from "./api";
import type { Stop } from "./types";

const DEBOUNCE_MS = 250;
export const MIN_CHARS = 2;

export type StopSearchStatus = "idle" | "loading" | "done" | "error";

export function useStopSearch(query: string): { q: string; hits: Stop[]; status: StopSearchStatus } {
  const q = query.trim();
  const [hits, setHits] = useState<Stop[]>([]);
  const [status, setStatus] = useState<StopSearchStatus>("idle");

  useEffect(() => {
    if (q.length < MIN_CHARS) {
      setHits([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setHits(await fetchStops(q, ctrl.signal));
        setStatus("done");
      } catch (err) {
        if (!isAbort(err)) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return { q, hits, status };
}
