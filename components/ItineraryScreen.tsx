"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClockCounterClockwiseIcon,
  NavigationArrowIcon,
  PathIcon,
  StarIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { useHydrated } from "@/lib/favorites";
import { splitStopName } from "@/lib/stopName";
import { useNow } from "@/lib/time";
import type { Connection, Departure, Endpoint, ItineraryQuery, Place, RideLeg } from "@/lib/types";
import { useConnections } from "@/lib/useConnections";
import { useGeolocation, type GeoState } from "@/lib/useGeolocation";
import { useStopShortcuts } from "@/lib/useStopShortcuts";
import BoardSkeleton from "./BoardSkeleton";
import Card from "./Card";
import ConnectionCard from "./ConnectionCard";
import ConnectionSheet from "./ConnectionSheet";
import RouteFields, { type Field } from "./RouteFields";
import Screen from "./Screen";
import Section from "./Section";
import StatusLine from "./StatusLine";
import TripSheet from "./TripSheet";

const DEFAULT_QUERY: ItineraryQuery = { from: { kind: "position" }, to: null };
/** Un itinéraire dont le départ est passé depuis plus longtemps est masqué en attendant l'actualisation. */
const DEPARTED_GRACE_MS = 60_000;

// Dernière saisie de la session : l'onglet la retrouve quand on y revient (HIG).
// La tabbar vit dans le layout racine, ce module n'est pas rechargé entre les onglets.
let lastQuery: ItineraryQuery | null = null;

type Props = {
  /** Saisie lue dans l'URL (?from=&to=), ou null si l'URL n'en porte pas. */
  initial: ItineraryQuery | null;
};

/**
 * Onglet Itinéraire : départ (par défaut, ma position) et arrivée, puis les
 * prochains itinéraires. L'état vit dans l'URL (/itinerary?from=…&to=…, « here »
 * pour la position) : lien « Y aller » d'un arrêt, retour arrière, partage.
 */
export default function ItineraryScreen({ initial }: Props) {
  const [query, setQuery] = useState<ItineraryQuery>(() => initial ?? lastQuery ?? DEFAULT_QUERY);
  const [editing, setEditing] = useState<Field | null>(null);
  // Détail ouvert, et étape suivie depuis ce détail (feuille de suivi du trajet).
  const [selected, setSelected] = useState<Connection | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const { state: geo, locate } = useGeolocation();
  const now = useNow(15_000);

  // URL et mémoire de session suivent la saisie (sans navigation ni rechargement serveur).
  useEffect(() => {
    lastQuery = query;
    const params = new URLSearchParams();
    if (query.from) params.set("from", placeParam(query.from));
    if (query.to) params.set("to", placeParam(query.to));
    const url = params.size ? `/itinerary?${params}` : "/itinerary";
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(null, "", url);
  }, [query]);

  const position =
    geo.status === "ready" ? geo.position : geo.status === "locating" || geo.status === "failed" ? geo.last : null;
  // Arrondi à ~10 m : une relocalisation quasi identique ne relance pas le calcul.
  const lat = position ? Math.round(position.lat * 1e4) / 1e4 : null;
  const lon = position ? Math.round(position.lon * 1e4) / 1e4 : null;
  const from = useMemo(() => endpoint(query.from, lat, lon), [query.from, lat, lon]);
  const to = useMemo(() => endpoint(query.to, lat, lon), [query.to, lat, lon]);
  const { result, error, loading, offline, refresh } = useConnections(from, to);
  // Le détail suit les actualisations ; si l'itinéraire n'est plus proposé, on garde la dernière version.
  const detail = selected ? (result?.connections.find((c) => c.key === selected.key) ?? selected) : null;
  const followedLeg = detail && following !== null ? detail.legs[following] : undefined;

  const positionField: Field | null =
    query.from?.kind === "position" ? "from" : query.to?.kind === "position" ? "to" : null;

  const pick = (field: Field, place: Place) => {
    setQuery((q) => {
      const other = field === "from" ? "to" : "from";
      // Même extrémité des deux côtés : on vide l'autre champ plutôt que d'échouer.
      const clash = q[other] && samePlace(q[other], place);
      return { ...q, [field]: place, ...(clash ? { [other]: null } : {}) };
    });
    setEditing(null);
  };

  const swap = () => setQuery((q) => ({ from: q.to, to: q.from }));

  let content: ReactNode;
  if (!query.to) {
    content = <Destinations exclude={query.from} onPick={(p) => pick("to", p)} onSearch={() => setEditing("to")} />;
  } else if (!query.from) {
    content = (
      <Prompt
        icon={<PathIcon size={26} weight="bold" aria-hidden />}
        title="D’où pars-tu ?"
        text="Choisis un arrêt de départ, ou utilise ta position."
        action={
          <button type="button" onClick={() => setEditing("from")} className={primaryButton}>
            Choisir un départ
          </button>
        }
      />
    );
  } else if (positionField && !position) {
    content = <GeoPrompt geo={geo} onLocate={locate} onChooseStop={() => setEditing(positionField)} />;
  } else {
    const visible = (result?.connections ?? []).filter(
      (c) => now === null || new Date(c.departure.realtime ?? c.departure.scheduled).getTime() >= now - DEPARTED_GRACE_MS,
    );
    content = (
      <>
        <div className="px-1">
          <StatusLine
            updatedAt={result?.updatedAt ?? null}
            loading={loading}
            error={error}
            offline={offline}
            onRefresh={refresh}
            refreshLabel="Actualiser les itinéraires"
          />
        </div>
        {positionField && geo.status === "failed" && (
          <Notice>Position non actualisée : itinéraires depuis ta position précédente.</Notice>
        )}
        <Card as="section" aria-label="Itinéraires" aria-busy={loading} className="overflow-hidden">
          {result && now ? (
            visible.length ? (
              <ol className="divide-y divide-hairline">
                {visible.map((c) => (
                  <li key={c.key}>
                    <ConnectionCard
                      connection={c}
                      now={now}
                      onSelect={(sel) => {
                        setReturnTo(null);
                        setSelected(sel);
                      }}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-5 text-[15px] text-muted">Aucun itinéraire trouvé pour le moment.</p>
            )
          ) : error && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <p className="text-[15px] text-late">{error}</p>
              <button type="button" onClick={refresh} className={primaryButton}>
                Réessayer
              </button>
            </div>
          ) : (
            <BoardSkeleton rows={4} />
          )}
        </Card>
        <p className="mt-4 px-1 text-[13px] text-subtle">
          {positionField && position
            ? `Marche estimée à vol d’oiseau depuis ta position (précision ± ${position.accuracyM} m), sans tenir compte du trajet réel. `
            : ""}
          Horaires temps réel quand disponibles, sinon théoriques.
        </p>
      </>
    );
  }

  return (
    <Screen title="Itinéraire">
      <RouteFields query={query} editing={editing} onEdit={setEditing} onPick={pick} onSwap={swap} />
      {!editing && content}

      {detail && following === null && (
        <ConnectionSheet
          key={detail.key}
          connection={detail}
          now={now ?? Date.now()}
          focusLeg={returnTo}
          onClose={() => setSelected(null)}
          onFollow={setFollowing}
        />
      )}
      {detail && followedLeg?.kind === "ride" && (
        <TripSheet
          key={`${detail.key}-${following}`}
          departure={legDeparture(followedLeg)}
          originName={followedLeg.from.stop.name}
          alightId={followedLeg.to.stop.id}
          onBack={() => {
            setReturnTo(following);
            setFollowing(null);
          }}
          onClose={() => {
            setFollowing(null);
            setSelected(null);
          }}
        />
      )}
    </Screen>
  );
}

/** Raccourcis de destination (favoris, récents) quand l'arrivée n'est pas choisie. */
function Destinations({
  exclude,
  onPick,
  onSearch,
}: {
  exclude: Place | null;
  onPick: (p: Place) => void;
  onSearch: () => void;
}) {
  const hydrated = useHydrated();
  const shortcuts = useStopShortcuts(exclude?.kind === "stop" ? exclude.id : null);
  if (!hydrated) return null;

  if (!shortcuts.length) {
    return (
      <Prompt
        icon={<PathIcon size={26} weight="bold" aria-hidden />}
        title="Où vas-tu ?"
        text="Choisis l’arrêt d’arrivée. Tes favoris et arrêts récents apparaîtront ici."
        action={
          <button type="button" onClick={onSearch} className={primaryButton}>
            Choisir une destination
          </button>
        }
      />
    );
  }

  return (
    <Section id="destinations-title" title="Où vas-tu ?">
      <Card as="ul" className="divide-y divide-hairline overflow-hidden">
        {shortcuts.map((s) => {
          const { place, stop } = splitStopName(s.name);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick({ kind: "stop", id: s.id, name: s.name })}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-hover focus-visible:-outline-offset-2 active:bg-surface-press"
              >
                {s.source === "favorite" ? (
                  <StarIcon size={20} weight="fill" aria-hidden className="shrink-0 text-accent-ink" />
                ) : (
                  <ClockCounterClockwiseIcon size={20} aria-hidden className="shrink-0 text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{stop}</span>
                  {place && <span className="block truncate text-[13px] text-muted">{place}</span>}
                </span>
                <span className="sr-only">{s.source === "favorite" ? "(favori)" : "(récent)"}</span>
              </button>
            </li>
          );
        })}
      </Card>
    </Section>
  );
}

/** Position nécessaire mais pas (encore) disponible. La permission n'est demandée qu'au geste. */
function GeoPrompt({ geo, onLocate, onChooseStop }: { geo: GeoState; onLocate: () => void; onChooseStop: () => void }) {
  const choose = (
    <button type="button" onClick={onChooseStop} className={secondaryButton}>
      Choisir un arrêt à la place
    </button>
  );
  const icon = <NavigationArrowIcon size={26} weight="fill" aria-hidden />;

  switch (geo.status) {
    case "idle":
      return (
        <Prompt
          icon={icon}
          text="Ta position sert uniquement à trouver les arrêts proches de toi et à estimer la marche."
          action={
            <>
              <button type="button" onClick={onLocate} className={primaryButton}>
                <NavigationArrowIcon size={18} weight="fill" aria-hidden />
                Utiliser ma position
              </button>
              {choose}
            </>
          }
        />
      );
    case "locating":
      return (
        <Card className="overflow-hidden" aria-busy>
          <p className="border-b border-hairline px-4 py-3 text-[15px] text-muted">Localisation…</p>
          <BoardSkeleton rows={3} />
        </Card>
      );
    case "denied":
      return (
        <Prompt
          icon={icon}
          title="Accès à la position refusé"
          text="Autorise la localisation pour ce site dans les réglages du navigateur, ou choisis un arrêt."
          action={choose}
        />
      );
    case "unsupported":
      return <Prompt icon={icon} text="Ce navigateur ne permet pas d’accéder à ta position." action={choose} />;
    default:
      return (
        <Prompt
          icon={icon}
          title="Position introuvable"
          text="Impossible de te localiser pour l’instant. Vérifie que la localisation est activée."
          action={
            <>
              <button type="button" onClick={onLocate} className={primaryButton}>
                Réessayer
              </button>
              {choose}
            </>
          }
        />
      );
  }
}

function Prompt({ icon, title, text, action }: { icon: ReactNode; title?: string; text: string; action: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-6 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent-ink">
        {icon}
      </span>
      {title && <p className="text-[17px] font-semibold">{title}</p>}
      <p className="max-w-xs text-[15px] text-muted">{text}</p>
      {action}
    </Card>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 rounded-2xl bg-late-bg px-3 py-2 text-[13px] text-late">
      <WarningIcon size={16} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

/** Étape d'un itinéraire vue comme un passage à l'arrêt de montée, pour la feuille de suivi. */
function legDeparture(l: RideLeg): Departure {
  const { scheduled, realtime } = l.from.time;
  return {
    key: `${l.journey}@${scheduled}`,
    journey: l.journey,
    line: l.line,
    category: l.category,
    operator: l.operator,
    destination: l.destination,
    scheduled,
    realtime,
    delayMin: realtime ? Math.round((new Date(realtime).getTime() - new Date(scheduled).getTime()) / 60_000) : null,
    platform: l.from.platform,
    stops: l.stops,
  };
}

function endpoint(place: Place | null, lat: number | null, lon: number | null): Endpoint | null {
  if (!place) return null;
  if (place.kind === "stop") return { kind: "stop", stopId: place.id };
  return lat !== null && lon !== null ? { kind: "position", lat, lon } : null;
}

function placeParam(place: Place): string {
  return place.kind === "position" ? "here" : place.id;
}

function samePlace(a: Place, b: Place): boolean {
  return a.kind === "position" ? b.kind === "position" : b.kind === "stop" && a.id === b.id;
}

const primaryButton =
  "mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1";
const secondaryButton =
  "inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-accent-ink hover:bg-surface-hover";
