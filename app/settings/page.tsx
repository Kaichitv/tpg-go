import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import Card from "@/components/Card";
import InstallSetting from "@/components/InstallSetting";
import Screen from "@/components/Screen";
import Section from "@/components/SettingsSection";
import SuggestionForm from "@/components/SuggestionForm";
import ThemePicker from "@/components/ThemePicker";
import pkg from "@/package.json";

export const metadata: Metadata = { title: "Réglages" };

const SOURCE_URL = "https://github.com/Kaichitv/tpg-go";
const AUTHOR_URL = "https://ludo-jdm.ch";

export default function SettingsPage() {
  return (
    <Screen title="Réglages">
      <Section id="settings-appearance" title="Apparence">
        <Card className="p-3">
          <ThemePicker />
          <p className="mt-2.5 px-1 text-[13px] text-muted">« Auto » suit le réglage clair/sombre de l’appareil.</p>
        </Card>
      </Section>

      <InstallSetting />

      <Section id="settings-suggestions" title="Suggestions">
        <SuggestionForm />
      </Section>

      <Section id="settings-about" title="À propos">
        <Card as="dl" className="divide-y divide-hairline">
          <Row label="Application">TPG Go</Row>
          <Row label="Version">{pkg.version}</Row>
          <Row label="Horaires">transport.opendata.ch</Row>
          <Row label="Couleurs des lignes">GTFS opentransportdata.swiss</Row>
        </Card>
        <p className="mt-2 px-4 text-[13px] leading-relaxed text-muted">
          Temps réel quand la source le fournit, sinon horaires théoriques (signalés comme tels). Le suivi
          d’une course est estimé d’après les horaires : ce n’est pas la position GPS du véhicule.
        </p>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-accent-ink hover:bg-surface-hover"
        >
          Code source
          <ArrowSquareOutIcon size={16} weight="bold" aria-hidden />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
        <Card
          as="a"
          href={AUTHOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-11 items-center justify-between gap-4 px-4 py-3 hover:bg-surface-hover"
        >
          <span className="min-w-0">
            <span className="block text-[16px]">Conçu et développé par Ludovic Jacot-dit-Montandon</span>
            <span className="block text-[13px] text-muted">
              Applications sur mesure et sites web ·{" "}<span className="text-accent-ink">ludo-jdm.ch</span>
            </span>
          </span>
          <ArrowSquareOutIcon size={16} weight="bold" aria-hidden className="shrink-0 text-muted" />
          <span className="sr-only">(nouvel onglet)</span>
        </Card>
      </Section>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2.5 text-[16px]">
      <dt>{label}</dt>
      <dd className="min-w-0 truncate text-right text-muted">{children}</dd>
    </div>
  );
}
