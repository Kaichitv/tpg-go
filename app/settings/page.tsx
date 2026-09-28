import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import SuggestionForm from "@/components/SuggestionForm";
import ThemePicker from "@/components/ThemePicker";
import pkg from "@/package.json";

export const metadata: Metadata = { title: "Réglages" };

const SOURCE_URL = "https://github.com/Kaichitv/tpg-go";

export default function SettingsPage() {
  return (
    <Screen title="Réglages">
      <Section id="settings-appearance" title="Apparence">
        <Card className="p-3">
          <ThemePicker />
          <p className="mt-2.5 px-1 text-[13px] text-muted">« Auto » suit le réglage clair/sombre de l’appareil.</p>
        </Card>
      </Section>

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
      </Section>
    </Screen>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-2 px-4 text-[13px] font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      {children}
    </section>
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
