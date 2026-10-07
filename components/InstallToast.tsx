"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { DownloadSimpleIcon, ExportIcon, XIcon } from "@phosphor-icons/react/ssr";
import IconButton from "./IconButton";
import { isInstallSnoozed, promptInstall, snoozeInstall, useInstallMode } from "@/lib/install";

/** Laisse l'écran s'afficher avant de suggérer l'installation. */
const SHOW_DELAY_MS = 3000;

/**
 * Suggestion d'installation flottante au-dessus de la tabbar, sur écran tactile
 * uniquement (sur ordinateur, le navigateur a déjà son bouton dans la barre d'adresse).
 * Chromium : « Installer » ouvre la boîte native. iOS : aucune API, on indique le geste.
 * Fermer, ou refuser la boîte native, la masque 30 jours. Absent des Réglages,
 * qui proposent leur propre entrée « Installer l’app ».
 */
export default function InstallToast() {
  const mode = useInstallMode();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isInstallSnoozed() || !window.matchMedia("(pointer: coarse)").matches) return;
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open || mode === "none" || pathname === "/settings") return null;

  const close = () => {
    snoozeInstall();
    setOpen(false);
  };

  const install = async () => {
    setOpen(false);
    if (!(await promptInstall())) snoozeInstall();
  };

  return (
    <aside aria-labelledby="install-toast-title" className="above-tabbar fixed inset-x-0 z-50 px-4 animate-toast-in">
      <div className="elev-3 mx-auto flex max-w-xl items-start gap-3 rounded-3xl p-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          unoptimized
          className="size-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p id="install-toast-title" className="text-[16px] leading-snug font-semibold">
            Installez l’app <span className="whitespace-nowrap">TPG Go</span>
          </p>
          {mode === "prompt" ? (
            <>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">
                Accès direct depuis l’écran d’accueil, en plein écran.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-on-accent shadow-elev-1"
              >
                <DownloadSimpleIcon size={18} weight="bold" aria-hidden />
                Installer
              </button>
            </>
          ) : (
            <p className="mt-0.5 text-[13px] leading-snug text-muted">
              Touchez{" "}
              <span className="font-medium whitespace-nowrap text-fg">
                Partager <ExportIcon size={16} weight="bold" aria-hidden className="inline align-[-3px]" />
              </span>{" "}
              (sous <span aria-hidden>•••</span>
              <span className="sr-only">le bouton Plus</span> selon l’affichage), puis{" "}
              <span className="font-medium text-fg">« Sur l’écran d’accueil »</span>.
            </p>
          )}
        </div>
        <IconButton label="Fermer" onClick={close} className="-mt-1 -mr-1">
          <XIcon size={20} aria-hidden />
        </IconButton>
      </div>
    </aside>
  );
}
