"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
import StickyBar from "./StickyBar";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type Status = "idle" | "loading" | "done" | "error";

type Props = {
  /** Contenu affiché tant qu'aucune recherche n'est en cours (récents, à proximité…). */
  idle?: ReactNode;
};

/**
 * Recherche d'arrêt avec autocomplétion (pattern ARIA combobox). Les résultats
 * s'affichent sous le champ, dans le flux de la page, à la place du contenu
 * `idle`, et restent visibles quand le clavier se ferme ; faire défiler la
 * liste rétracte le clavier.
 */
export default function StopSearch({ idle }: Props) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Stop[]>([]);
  const [status, setStatus] = useState<Status>("idle");
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
        setHits(stops);
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
    router.push(`/stop/${encodeURIComponent(s.id)}?name=${encodeURIComponent(s.name)}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const s = hits[active] ?? hits[0];
      if (s) {
        e.preventDefault();
        pick(s);
      }
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const showList = q.length >= MIN_CHARS && status !== "idle";
  const activeId = active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <>
      <StickyBar className="-mt-2 mb-4 py-2">
        <div role="search">
          <div className="elev-2 flex h-12 items-center gap-2 rounded-2xl pr-1 pl-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--focus)">
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
              placeholder="Nom d’arrêt"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              onChange={(e) => setQuery(e.target.value)}
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
        </div>
      </StickyBar>

      <div
        className={`elev-1 overflow-hidden rounded-3xl ${showList ? "animate-fade-in" : "hidden"}`}
        onTouchMove={() => inputRef.current?.blur()}
      >
        <ul id={listId} role="listbox" aria-label="Arrêts trouvés" className="py-1.5">
          {hits.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
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

      {!showList && idle}

      <p className="sr-only" aria-live="polite">
        {status === "done" ? `${hits.length} arrêt${hits.length > 1 ? "s" : ""} trouvé${hits.length > 1 ? "s" : ""}` : ""}
      </p>
    </>
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

/** Met en gras la partie correspondant à la recherche (insensible casse/accents/ponctuation). */
function Highlight({ text, query }: { text: string; query: string }) {
  // Normalisation caractère par caractère : garde les indices alignés sur `text`.
  const fold = (s: string) =>
    s
      .split("")
      .map((c) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().charAt(0) || c)
      .map((c) => (/[\p{L}\p{N}]/u.test(c) ? c : " "))
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
