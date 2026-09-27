"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BoatIcon,
  BusIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  TrainIcon,
  TramIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { fetchStops, isAbort } from "@/lib/api";
import type { Stop, StopKind } from "@/lib/types";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type Status = "idle" | "loading" | "done" | "error";

/** Recherche d'arrêt avec autocomplétion (pattern ARIA combobox). */
export default function StopSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Stop[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = query.trim();

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
        const stops = await fetchStops(q, ctrl.signal);
        setHits(rankForGeneva(stops));
        setActive(-1);
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

  const pick = (s: Stop) => {
    setOpen(false);
    setQuery("");
    router.push(`/stop/${encodeURIComponent(s.id)}?name=${encodeURIComponent(s.name)}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const s = hits[active] ?? (hits.length ? hits[0] : null);
      if (s && open) {
        e.preventDefault();
        pick(s);
      }
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setQuery("");
    }
  };

  const showList = open && q.length >= MIN_CHARS && status !== "idle";
  const activeId = active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="relative">
      <div className="glass flex h-12 items-center gap-2 rounded-2xl pr-1 pl-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--focus)">
        <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Rechercher un arrêt"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList ? activeId : undefined}
          value={query}
          placeholder="Rechercher un arrêt"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-fg outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {status === "loading" && (
          <CircleNotchIcon size={20} aria-hidden className="shrink-0 animate-spin text-muted" />
        )}
        {query && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-subtle hover:text-muted"
          >
            <XCircleIcon size={20} weight="fill" aria-hidden />
          </button>
        )}
      </div>

      <div
        className={`glass-strong absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl ${showList ? "animate-fade-in" : "hidden"}`}
      >
        <ul id={listId} role="listbox" aria-label="Arrêts trouvés" className="max-h-[60dvh] overflow-y-auto py-1.5">
          {hits.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // Empêche le blur de l'input avant le clic (tactile et souris).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseMove={() => setActive(i)}
              className={`mx-1.5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[16px] ${i === active ? "bg-surface-press" : ""}`}
            >
              <KindIcon kind={s.kind} />
              <span className="min-w-0 flex-1 truncate">
                <Highlight text={s.name} query={q} />
              </span>
            </li>
          ))}
        </ul>
        {status === "done" && !hits.length && (
          <p className="px-4 pb-3 text-[15px] text-muted">Aucun arrêt trouvé pour « {q} ».</p>
        )}
        {status === "error" && (
          <p className="px-4 pb-3 text-[15px] text-late">Recherche indisponible. Réessaie dans un instant.</p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {status === "done" ? `${hits.length} arrêt${hits.length > 1 ? "s" : ""} trouvé${hits.length > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}

function KindIcon({ kind }: { kind: StopKind }) {
  const props = { size: 20, "aria-hidden": true, className: "shrink-0 text-muted" } as const;
  switch (kind) {
    case "tram":
      return <TramIcon {...props} />;
    case "bus":
      return <BusIcon {...props} />;
    case "train":
      return <TrainIcon {...props} />;
    case "boat":
      return <BoatIcon {...props} />;
    default:
      return <MapPinIcon {...props} />;
  }
}

/** Met en gras la partie correspondant à la recherche (insensible casse/accents). */
function Highlight({ text, query }: { text: string; query: string }) {
  // Normalisation caractère par caractère : garde les indices alignés sur `text`.
  const fold = (s: string) =>
    s
      .split("")
      .map((c) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().charAt(0) || c)
      .join("");
  const i = fold(text).indexOf(fold(query));
  if (i < 0 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-semibold">{text.slice(i, i + query.length)}</strong>
      {text.slice(i + query.length)}
    </>
  );
}

/** Canton de Genève (approx.) : remonte ces arrêts en tête, ordre de pertinence conservé. */
function rankForGeneva(stops: Stop[]): Stop[] {
  const inGeneva = (s: Stop) =>
    s.lat !== null && s.lon !== null && s.lat > 46.12 && s.lat < 46.37 && s.lon > 5.95 && s.lon < 6.32;
  return [...stops.filter(inGeneva), ...stops.filter((s) => !inGeneva(s))];
}
