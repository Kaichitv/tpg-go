"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Departure = {
  line: string;
  category: string;
  to: string;
  scheduled: string | null;
  realtime: string | null;
  delayMin: number;
  platform: string | null;
};

type StopHit = { id: string; name: string };

const REFRESH_MS = 30_000;
const LS_KEY = "tpg:lastStop";

export default function Home() {
  const [stop, setStop] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [hits, setHits] = useState<StopHit[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0); // re-render pour rafraîchir les "X min"
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restaure le dernier arrêt choisi
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setStop(saved);
  }, []);

  // Autocomplétion (debounce léger)
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/locations?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setHits(d.stops ?? []);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (s: string) => {
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/departures?stop=${encodeURIComponent(s)}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setDepartures(d.departures ?? []);
      setUpdatedAt(new Date());
    } catch (e) {
      setError("Impossible de récupérer les horaires.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Charge + auto-refresh quand l'arrêt change
  useEffect(() => {
    if (!stop) return;
    load(stop);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => load(stop), REFRESH_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [stop, load]);

  // Refresh quand l'app repasse au premier plan
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && stop) load(stop);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stop, load]);

  // Tick chaque seconde pour recalculer les minutes restantes
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pickStop = (s: StopHit) => {
    setStop(s.name);
    setQuery("");
    setHits([]);
    localStorage.setItem(LS_KEY, s.name);
  };

  return (
    <main className="wrap">
      <header className="head">
        <h1>TPG <span>en direct</span></h1>
        {updatedAt && (
          <p className="meta">
            {loading ? "actualisation…" : `mis à jour ${secondsAgo(updatedAt)}`}
          </p>
        )}
      </header>

      <div className="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un arrêt… (ex. Bel-Air)"
          autoComplete="off"
          inputMode="search"
        />
        {hits.length > 0 && (
          <ul className="hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button onClick={() => pickStop(h)}>{h.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stop && <h2 className="stopname">{stop}</h2>}

      {error && <p className="error">{error}</p>}

      {!stop && !error && (
        <p className="hint">Choisis un arrêt pour voir les prochains passages.</p>
      )}

      <ul className="board">
        {departures.map((d, i) => {
          const min = minutesUntil(d.realtime);
          return (
            <li key={i} className="row">
              <span className={`badge cat-${d.category.toLowerCase()}`}>{d.line}</span>
              <span className="to">{d.to}</span>
              <span className="when">
                {min === null ? "—" : min <= 0 ? "à l'instant" : `${min}′`}
                {d.delayMin > 0 && <em className="delay">+{d.delayMin}′</em>}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / 60000);
}

function secondsAgo(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 5 ? "à l'instant" : `il y a ${s}s`;
}
