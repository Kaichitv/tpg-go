"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ArrowsDownUpIcon,
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
  MapPinIcon,
  NavigationArrowIcon,
  StarIcon,
} from "@phosphor-icons/react/ssr";
import { splitStopName } from "@/lib/stopName";
import type { ItineraryQuery, Place, Stop } from "@/lib/types";
import { MIN_CHARS, useStopSearch } from "@/lib/useStopSearch";
import { useStopShortcuts, type StopShortcut } from "@/lib/useStopShortcuts";
import Card from "./Card";
import IconButton from "./IconButton";
import { Highlight, KindIcon } from "./StopSearch";

export type Field = "from" | "to";

type Props = {
  query: ItineraryQuery;
  /** Champ en cours de saisie, ou null. */
  editing: Field | null;
  onEdit: (field: Field | null) => void;
  onPick: (field: Field, place: Place) => void;
  onSwap: () => void;
};

type Option =
  | { key: string; type: "position" }
  | { key: string; type: "shortcut"; shortcut: StopShortcut }
  | { key: string; type: "hit"; stop: Stop };

const LABELS: Record<Field, string> = { from: "Départ", to: "Arrivée" };

/**
 * Champs Départ / Arrivée de l'onglet Itinéraire. Toucher un champ le passe en
 * saisie (combobox ARIA) : sans texte, « Ma position », les favoris et les arrêts
 * récents ; dès 2 lettres, les arrêts TPG correspondants. Les options s'affichent
 * sous la carte, dans le flux de la page, comme dans la recherche.
 */
export default function RouteFields({ query, editing, onEdit, onPick, onSwap }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fromRef = useRef<HTMLButtonElement>(null);
  const toRef = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const { q, hits, status } = useStopSearch(editing ? text : "");

  const other = editing ? query[editing === "from" ? "to" : "from"] : null;
  const shortcuts = useStopShortcuts(other?.kind === "stop" ? other.id : null);

  const options = useMemo<Option[]>(() => {
    if (q.length >= MIN_CHARS) {
      return hits
        .filter((s) => !(other?.kind === "stop" && other.id === s.id))
        .map((s) => ({ key: `hit-${s.id}`, type: "hit", stop: s }));
    }
    const list: Option[] = other?.kind === "position" ? [] : [{ key: "position", type: "position" }];
    return [...list, ...shortcuts.map((s): Option => ({ key: `${s.source}-${s.id}`, type: "shortcut", shortcut: s }))];
  }, [q, hits, other, shortcuts]);

  // Nouvelle liste d'options : plus d'option active.
  const [shownOptions, setShownOptions] = useState(options);
  if (options !== shownOptions) {
    setShownOptions(options);
    setActive(-1);
  }

  // Fin de saisie : le focus revient sur le champ qu'on vient de modifier (clavier, lecteur d'écran).
  const wasEditing = useRef<Field | null>(null);
  useEffect(() => {
    if (editing) {
      setText("");
      inputRef.current?.focus();
    } else if (wasEditing.current) {
      (wasEditing.current === "from" ? fromRef : toRef).current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  const pick = (o: Option) => {
    if (!editing) return;
    const place: Place =
      o.type === "position"
        ? { kind: "position" }
        : o.type === "shortcut"
          ? { kind: "stop", id: o.shortcut.id, name: o.shortcut.name }
          : { kind: "stop", id: o.stop.id, name: o.stop.name };
    onPick(editing, place);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const o = options[active] ?? (q.length >= MIN_CHARS ? options[0] : undefined);
      if (o) {
        e.preventDefault();
        pick(o);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEdit(null);
    }
  };

  const activeId = active >= 0 ? `${listId}-opt-${active}` : undefined;

  const row = (field: Field, ref: RefObject<HTMLButtonElement | null>) =>
    editing === field ? (
      <div className="flex min-h-14 items-center gap-3 pr-1 pl-4">
        <FieldIcon field={field} place={null} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={field === "from" ? "Arrêt de départ" : "Arrêt d’arrivée"}
          aria-autocomplete="list"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeId}
          value={text}
          placeholder="Rechercher un arrêt"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-[17px] text-fg outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {status === "loading" && <CircleNotchIcon size={20} aria-hidden className="shrink-0 animate-spin text-muted" />}
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="min-h-11 shrink-0 rounded-full px-3 text-[15px] font-medium text-accent-ink hover:bg-surface-hover"
        >
          Annuler
        </button>
      </div>
    ) : (
      <button
        ref={ref}
        type="button"
        onClick={() => onEdit(field)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:-outline-offset-2 active:bg-surface-press"
      >
        <FieldIcon field={field} place={query[field]} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-muted">{LABELS[field]}</span>
          <span className={`block truncate text-[17px] ${query[field] ? "" : "text-subtle"}`}>
            {placeLabel(query[field]) ?? (field === "from" ? "Choisir un départ" : "Choisir une destination")}
          </span>
        </span>
        <span className="sr-only">, modifier</span>
      </button>
    );

  return (
    <>
      <Card elevation={2} className="mb-4 flex items-center overflow-hidden">
        <div className="min-w-0 flex-1 divide-y divide-hairline">
          {row("from", fromRef)}
          {row("to", toRef)}
        </div>
        {!editing && (
          <IconButton
            label="Inverser départ et arrivée"
            onClick={onSwap}
            disabled={!query.from && !query.to}
            className="mr-1 text-accent-ink"
          >
            <ArrowsDownUpIcon size={22} weight="bold" aria-hidden />
          </IconButton>
        )}
      </Card>

      {editing && (
        <div className="elev-1 animate-fade-in overflow-hidden rounded-3xl" onTouchMove={() => inputRef.current?.blur()}>
          <ul id={listId} role="listbox" aria-label={`Choix de l’arrêt de ${editing === "from" ? "départ" : "destination"}`} className="py-1.5">
            {options.map((o, i) => (
              <li
                key={o.key}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => pick(o)}
                onMouseMove={() => setActive(i)}
                className={`mx-1.5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[16px] ${i === active ? "bg-surface-press" : ""}`}
              >
                <OptionContent option={o} query={q} />
              </li>
            ))}
          </ul>
          {q.length < MIN_CHARS && options.length <= 1 && (
            <p className="px-4 pb-3 text-[15px] text-muted">Tape au moins 2 lettres pour chercher un arrêt TPG.</p>
          )}
          {status === "done" && q.length >= MIN_CHARS && !options.length && (
            <p className="px-4 py-3 text-[15px] text-muted">Aucun arrêt trouvé pour « {q} ».</p>
          )}
          {status === "error" && (
            <p className="px-4 py-3 text-[15px] text-late">Recherche indisponible. Réessaie dans un instant.</p>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {editing && status === "done"
          ? `${options.length} arrêt${options.length > 1 ? "s" : ""} trouvé${options.length > 1 ? "s" : ""}`
          : ""}
      </p>
    </>
  );
}

function OptionContent({ option: o, query }: { option: Option; query: string }) {
  const icon = { size: 20, "aria-hidden": true, className: "shrink-0 text-muted" } as const;
  if (o.type === "position") {
    return (
      <>
        <NavigationArrowIcon {...icon} weight="fill" className="shrink-0 text-accent-ink" />
        <span className="min-w-0 flex-1 truncate font-medium">Ma position</span>
      </>
    );
  }
  if (o.type === "hit") {
    return (
      <>
        <KindIcon kind={o.stop.kind} />
        <span className="min-w-0 flex-1 truncate">
          <Highlight text={o.stop.name} query={query} />
        </span>
      </>
    );
  }
  const { place, stop } = splitStopName(o.shortcut.name);
  return (
    <>
      {o.shortcut.source === "favorite" ? (
        <StarIcon {...icon} weight="fill" className="shrink-0 text-accent-ink" />
      ) : (
        <ClockCounterClockwiseIcon {...icon} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{stop}</span>
        {place && <span className="block truncate text-[13px] text-muted">{place}</span>}
      </span>
      <span className="sr-only">{o.shortcut.source === "favorite" ? "(favori)" : "(récent)"}</span>
    </>
  );
}

/** Position : flèche ; départ : anneau ; arrivée : épingle. */
function FieldIcon({ field, place }: { field: Field; place: Place | null }) {
  if (place?.kind === "position") {
    return <NavigationArrowIcon size={20} weight="fill" aria-hidden className="shrink-0 text-accent-ink" />;
  }
  if (field === "to") {
    return <MapPinIcon size={20} weight="fill" aria-hidden className="shrink-0 text-accent-ink" />;
  }
  return (
    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
      <span className="size-3 rounded-full border-[3px] border-accent-ink" />
    </span>
  );
}

export function placeLabel(place: Place | null): string | null {
  if (!place) return null;
  return place.kind === "position" ? "Ma position" : place.name;
}
