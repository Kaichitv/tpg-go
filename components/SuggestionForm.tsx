"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CheckCircleIcon, CircleNotchIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react/ssr";
import { ApiError, sendSuggestion } from "@/lib/api";
import { MESSAGE_MAX, NAME_MAX, parseSuggestion } from "@/lib/suggestion";
import Card from "./Card";

type Status = "idle" | "sending" | "sent";

const FIELD =
  "elev-2 w-full rounded-2xl bg-transparent px-3.5 text-[17px] text-fg outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1 disabled:opacity-60";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return err.message;
    if (err.status === 429) return "Trop d’envois d’affilée. Réessaie dans quelques minutes.";
    if (err.status === 503) return "Les suggestions ne sont pas disponibles pour le moment.";
  }
  return "Envoi impossible. Vérifie ta connexion et réessaie.";
}

/** Formulaire « nom + suggestion », transmis au développeur via /api/suggestions. */
export default function SuggestionForm() {
  const id = useId();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // pot de miel anti-robots
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<"name" | "message" | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    const parsed = parseSuggestion({ name, message });
    if (typeof parsed === "string") {
      setError(parsed);
      setInvalid(name.trim() ? "message" : "name");
      return;
    }
    setError(null);
    setInvalid(null);
    setStatus("sending");
    try {
      await sendSuggestion({ ...parsed, website });
      setStatus("sent");
    } catch (err) {
      setError(errorMessage(err));
      setStatus("idle");
    }
  };

  const again = () => {
    setMessage("");
    setStatus("idle");
    // Après le rendu du formulaire, on replace le focus dans le champ de texte.
    requestAnimationFrame(() => messageRef.current?.focus());
  };

  if (status === "sent") {
    return (
      <Card className="flex flex-col items-center gap-2 px-4 py-6 text-center" role="status">
        <CheckCircleIcon size={40} weight="fill" aria-hidden className="text-ontime" />
        <p className="text-[17px] font-semibold">Merci {name.trim()} !</p>
        <p className="text-[15px] text-muted">Ta suggestion a bien été envoyée.</p>
        <button type="button" onClick={again} className="mt-2 min-h-11 rounded-full px-4 text-[15px] font-medium text-accent-ink hover:bg-surface-hover">
          Envoyer une autre suggestion
        </button>
      </Card>
    );
  }

  const sending = status === "sending";
  const errorId = `${id}-error`;

  return (
    <Card as="form" noValidate onSubmit={onSubmit} aria-describedby={`${id}-hint`} className="flex flex-col gap-4 p-4">
      <p id={`${id}-hint`} className="text-[15px] text-muted">
        Une idée, un bug, un manque ? Ton message est transmis directement au développeur, rien n’est publié.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="px-1 text-[13px] font-medium text-muted">
          Nom
        </label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          enterKeyHint="next"
          placeholder="Ton prénom ou pseudo"
          aria-invalid={invalid === "name"}
          aria-describedby={invalid === "name" ? errorId : undefined}
          className={`${FIELD} h-11`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between px-1">
          <label htmlFor={`${id}-message`} className="text-[13px] font-medium text-muted">
            Suggestion
          </label>
          <span className="text-[12px] text-subtle tabular-nums" aria-hidden>
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>
        <textarea
          id={`${id}-message`}
          ref={messageRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={5}
          placeholder="Ce que tu aimerais voir dans TPG Go…"
          aria-invalid={invalid === "message"}
          aria-describedby={invalid === "message" ? errorId : undefined}
          className={`${FIELD} resize-y py-2.5 leading-snug`}
        />
      </div>

      {/* Invisible et hors tabulation : seuls les robots le remplissent. */}
      <div aria-hidden className="sr-only">
        <label>
          Site web
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <p id={errorId} role="alert" className="px-1 text-[15px] text-late empty:hidden">
        {error}
      </p>

      <button type="submit" disabled={sending} className={`${BUTTON} self-end`}>
        {sending ? (
          <CircleNotchIcon size={18} weight="bold" aria-hidden className="animate-spin" />
        ) : (
          <PaperPlaneTiltIcon size={18} weight="bold" aria-hidden />
        )}
        {sending ? "Envoi…" : "Envoyer"}
      </button>
    </Card>
  );
}
