"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { DownloadSimpleIcon, ExportIcon, PlusSquareIcon } from "@phosphor-icons/react/ssr";
import Card from "./Card";
import SettingsSection from "./SettingsSection";
import { promptInstall, useInstallMode } from "@/lib/install";

/**
 * Section « Installer l’app » des Réglages : toujours disponible, contrairement au
 * toast qui se met en veille. Absente quand l'app est déjà ouverte en mode installé
 * ou que le navigateur ne permet pas l'installation.
 */
export default function InstallSetting() {
  const mode = useInstallMode();
  if (mode === "none") return null;

  return (
    <SettingsSection id="settings-install" title="Installer l’app">
      {mode === "prompt" ? (
        <Card className="flex items-center gap-3 p-3">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            unoptimized
            className="size-11 shrink-0 rounded-[10px]"
          />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
            <span className="block text-[16px] text-fg">TPG Go</span>
            Accès direct depuis l’écran d’accueil, en plein écran.
          </p>
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent shadow-elev-1"
          >
            <DownloadSimpleIcon size={18} weight="bold" aria-hidden />
            Installer
          </button>
        </Card>
      ) : (
        <>
          <Card as="ol" role="list" className="space-y-3 p-4 text-[15px] leading-snug">
            <Step n={1}>
              Touchez{" "}
              <strong className="font-semibold whitespace-nowrap">
                Partager <ExportIcon size={17} weight="bold" aria-hidden className="inline align-[-3px]" />
              </strong>
              <span className="text-muted">
                {" "}
                (sous <span aria-hidden>•••</span>
                <span className="sr-only">le bouton Plus</span> selon l’affichage)
              </span>
              .
            </Step>
            <Step n={2}>
              Choisissez{" "}
              <strong className="font-semibold">
                « Sur l’écran d’accueil »{" "}
                <PlusSquareIcon size={17} weight="bold" aria-hidden className="inline align-[-3px]" />
              </strong>
              <span className="text-muted"> (plus bas dans la liste)</span>.
            </Step>
            <Step n={3}>
              Touchez <strong className="font-semibold">Ajouter</strong>.
            </Step>
          </Card>
          <p className="mt-2 px-4 text-[13px] leading-relaxed text-muted">
            Sur iPhone et iPad, Apple ne permet pas aux sites d’installer une app directement : ce geste est
            le seul moyen.
          </p>
        </>
      )}
    </SettingsSection>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-semibold text-accent-ink"
      >
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}
