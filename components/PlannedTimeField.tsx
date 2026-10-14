"use client";

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ClockIcon, XCircleIcon, XIcon } from "@phosphor-icons/react/ssr";
import { dayOptions, isPlannable, MINUTE_STEP, plannedLabel } from "@/lib/plannedTime";
import type { PlannedTime } from "@/lib/types";
import { fromZurichWallTime, zurichWallTime } from "@/lib/zurichTime";
import IconButton from "./IconButton";
import Wheel, { WHEEL_ROW_PX, type WheelOption } from "./Wheel";

type Props = {
  /** Heure choisie ; null = partir maintenant. */
  value: PlannedTime | null;
  /** Horloge partagée de l'écran (null avant l'hydratation). */
  now: number | null;
  onChange: (value: PlannedTime | null) => void;
};

const MODES: { value: PlannedTime["mode"]; label: string }[] = [
  { value: "depart", label: "Partir à" },
  { value: "arrive", label: "Arriver à" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, unit: string) => `${n} ${unit}${n > 1 ? "s" : ""}`;
const HOURS: WheelOption[] = Array.from({ length: 24 }, (_, h) => ({
  value: pad(h),
  label: pad(h),
  spoken: plural(h, "heure"),
}));
const MINUTES: WheelOption[] = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => ({
  value: pad(i * MINUTE_STEP),
  label: pad(i * MINUTE_STEP),
  spoken: plural(i * MINUTE_STEP, "minute"),
}));
const STEP_MS = MINUTE_STEP * 60_000;

/**
 * Ligne « Partir maintenant » / « Arriver demain à 08:00 » de la carte Départ /
 * Arrivée. La toucher ouvre une feuille : partir à ou arriver à, puis une roue
 * jour · heure · minutes (heure suisse, 24 h, comme Plans d'Apple). La croix
 * revient au départ immédiat.
 */
export default function PlannedTimeField({ value, now, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Avant l'hydratation, seul le jour relatif dépend de l'horloge : identique côté serveur.
  const label = plannedLabel(value, now ?? Date.now());

  return (
    <div className="flex items-center">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:-outline-offset-2 active:bg-surface-press"
      >
        <ClockIcon size={20} weight={value ? "fill" : "bold"} aria-hidden className="shrink-0 text-accent-ink" />
        <span className={`min-w-0 flex-1 truncate text-[16px] ${value ? "font-semibold" : ""}`}>{label}</span>
        <span className="sr-only">, choisir la date et l’heure</span>
      </button>
      {value && (
        <IconButton
          label="Partir maintenant"
          onClick={() => {
            onChange(null);
            buttonRef.current?.focus(); // la croix disparaît : le focus reste dans la carte
          }}
          className="mr-1 text-muted"
        >
          <XCircleIcon size={22} weight="fill" aria-hidden />
        </IconButton>
      )}
      {open && <PlannedTimeSheet value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Feuille modale : contrôle segmenté, roue jour (30 jours) · heure · minutes (pas de 5). */
function PlannedTimeSheet({
  value,
  onChange,
  onClose,
}: {
  value: PlannedTime | null;
  onChange: (value: PlannedTime | null) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  // Valeurs figées à l'ouverture : heure choisie (au pas le plus proche), sinon
  // maintenant arrondi au pas suivant (jamais dans le passé).
  const [days] = useState(() => dayOptions(Date.now()));
  const [initial] = useState(() => {
    const steps = value ? Math.round(Date.parse(value.at) / STEP_MS) : Math.ceil(Date.now() / STEP_MS);
    return zurichWallTime(new Date(steps * STEP_MS));
  });
  const [mode, setMode] = useState<PlannedTime["mode"]>(value?.mode ?? "depart");
  // Jour hors de la liste (minuit passé depuis le choix) : le premier proposé.
  const [day, setDay] = useState(() => (days.some((d) => d.value === initial.date) ? initial.date : days[0].value));
  const [hour, setHour] = useState(initial.time.slice(0, 2));
  const [minute, setMinute] = useState(initial.time.slice(3, 5));
  const [error, setError] = useState<string | null>(null);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };

  // Ouverture modale native (focus piégé, fond inerte) ; focus sur le segment coché.
  // Le navigateur rend le focus à la ligne « Partir maintenant » à la fermeture.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    el?.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus();
  }, []);

  const close = () => dialog.current?.close();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // null : heure sautée au passage à l'heure d'été (dernier dimanche de mars, 02:00–02:59).
    const at = fromZurichWallTime({ date: day, time: `${hour}:${minute}` });
    if (!at) {
      setError("Cette heure n’existe pas ce jour-là (passage à l’heure d’été).");
    } else if (!isPlannable(at.toISOString(), Date.now())) {
      setError("Cette heure est déjà passée.");
    } else {
      onChange({ mode, at: at.toISOString() });
      close();
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) close(); // clic sur le fond
      }}
      className="elev-4 fixed inset-x-0 top-auto bottom-0 m-0 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border-b-0 p-0 text-fg open:animate-sheet-in backdrop:animate-fade-in"
    >
      <header className="shrink-0 border-b border-hairline px-4 pt-2 pb-3">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-hairline" />
        <div className="flex items-center gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 text-[20px] leading-tight font-semibold">
            Date et heure
          </h2>
          <IconButton label="Fermer" onClick={close} className="-mr-2">
            <XIcon size={22} aria-hidden />
          </IconButton>
        </div>
      </header>

      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <fieldset>
          <legend className="sr-only">Heure de départ ou d’arrivée</legend>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-press p-1">
            {MODES.map((m) => {
              const checked = mode === m.value;
              return (
                <label
                  key={m.value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-[15px] font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) ${
                    checked ? "elev-2 text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    value={m.value}
                    checked={checked}
                    onChange={() => setMode(m.value)}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="relative grid grid-cols-[minmax(0,1fr)_3.5rem_auto_3.5rem] items-center gap-x-1">
          {/* Bande de sélection derrière les trois colonnes, comme une roue iOS. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-surface-press"
            style={{ height: WHEEL_ROW_PX }}
          />
          <Wheel label="Jour" options={days} value={day} onChange={edit(setDay)} />
          <Wheel label="Heure" options={HOURS} value={hour} onChange={edit(setHour)} />
          <span aria-hidden className="relative text-[20px] font-semibold">
            :
          </span>
          <Wheel label="Minutes" options={MINUTES} value={minute} onChange={edit(setMinute)} />
        </div>

        <p role="alert" className="px-1 text-[15px] text-late empty:hidden">
          {error}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              close();
            }}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-accent-ink hover:bg-surface-hover"
          >
            Partir maintenant
          </button>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-on-accent shadow-elev-1"
          >
            Valider
          </button>
        </div>
      </form>
    </dialog>
  );
}
