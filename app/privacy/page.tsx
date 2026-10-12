import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import Card from "@/components/Card";
import DetailScreen from "@/components/DetailScreen";

export const metadata: Metadata = { title: "Confidentialité" };

// Le texte doit rester fidèle au code : à mettre à jour, avec la date, dès qu'un
// traitement change (nouvelle donnée, sous-traitant, durée de conservation…).
const UPDATED = "12 octobre 2026";
const CONTACT = "design@ludo-jdm.ch";

const SUMMARY = [
  "Tes coordonnées ne quittent jamais ton appareil.",
  "Ni compte, ni cookies, ni publicité, ni mesure d’audience.",
  "Tes favoris et arrêts récents restent sur ton appareil.",
  "Rien n’est conservé, hormis les suggestions que tu envoies et des journaux techniques effacés après environ une heure.",
];

const LINK = "font-medium text-accent-ink underline underline-offset-2";

/** Politique de confidentialité (LPD suisse et RGPD), poussée dans l'onglet d'origine. */
export default function PrivacyPage() {
  return (
    <DetailScreen title="Confidentialité">
      <p className="mb-6 px-1 text-[15px] text-muted">Politique de confidentialité · mise à jour le {UPDATED}</p>

      <Card className="mb-8 p-4">
        <p className="text-[15px] leading-relaxed">
          TPG Go est une application gratuite et sans but lucratif, faite pour la communauté des usagers des
          transports publics genevois. Elle est conçue pour traiter le moins de données possible.
        </p>
        <ul className="mt-3 space-y-2">
          {SUMMARY.map((s) => (
            <li key={s} className="flex gap-2.5 text-[15px] leading-snug">
              <CheckCircleIcon size={20} weight="fill" aria-hidden className="shrink-0 text-ontime" />
              {s}
            </li>
          ))}
        </ul>
      </Card>

      <Part id="controller" title="Responsable">
        <p>
          Ludovic Jacot-dit-Montandon, développeur de TPG Go. Pour toute question ou demande concernant tes données :{" "}
          <Mail />.
        </p>
        <p>
          Cette politique applique la loi fédérale suisse sur la protection des données (LPD) et, pour les personnes
          qui se trouvent dans l’Union européenne, le règlement général sur la protection des données (RGPD).
        </p>
      </Part>

      <Part id="position" title="Ta position">
        <p>
          TPG Go n’utilise ta position que si tu touches « Utiliser ma position » et que tu autorises la localisation
          dans ton navigateur. Une fois l’autorisation donnée, l’app te localise directement à l’ouverture des onglets
          Recherche et Itinéraire.
        </p>
        <List>
          <li>
            <strong className="font-semibold">À proximité</strong> : les arrêts les plus proches sont calculés sur ton
            appareil. Rien n’est envoyé.
          </li>
          <li>
            <strong className="font-semibold">Itinéraire depuis ou vers ta position</strong> : la marche est aussi
            estimée sur ton appareil. Seuls les arrêts TPG proches (3 au plus) et le temps de marche jusqu’à chacun
            sont envoyés au serveur de TPG Go, pour chercher les itinéraires. Ils indiquent à peu près le quartier où
            tu te trouves, jamais tes coordonnées.
          </li>
          <li>
            Ta position reste en mémoire tant que l’app est ouverte. Elle n’est jamais enregistrée, ni sur ton appareil
            ni ailleurs.
          </li>
        </List>
        <p>
          Base légale : ton consentement. Tu peux le retirer à tout moment en désactivant la localisation pour ce site
          dans les réglages de ton navigateur ou de ton téléphone.
        </p>
      </Part>

      <Part id="device" title="Sur ton appareil">
        <p>
          Tes favoris, tes arrêts récents, ton choix de thème et le rappel d’installation sont enregistrés dans le
          stockage local de ton navigateur et ne sont jamais transmis. Pour fonctionner hors ligne, l’app garde aussi
          une copie de ses propres pages, sans aucune donnée personnelle.
        </p>
        <p>
          Tu peux tout effacer : « Effacer » dans les arrêts récents, retrait des favoris, ou suppression des données
          du site dans ton navigateur. TPG Go n’utilise aucun cookie.
        </p>
      </Part>

      <Part id="suggestions" title="Suggestions">
        <p>
          Le formulaire des Réglages envoie ton message et, si tu le remplis, le nom ou pseudo de ton choix. Aucune
          adresse e-mail n’est demandée : évite d’indiquer des informations personnelles dans le message.
        </p>
        <List>
          <li>Le message est transmis au développeur dans un salon Discord, sans être publié.</li>
          <li>Il est supprimé une fois traité, et au plus tard après 12 mois.</li>
          <li>
            Pour limiter les abus, ton adresse IP est gardée en mémoire vive 10 minutes au plus. Elle n’est jamais
            enregistrée.
          </li>
        </List>
        <p>
          Base légale : ton consentement (l’envoi est volontaire) et, pour l’anti-abus, l’intérêt légitime à protéger
          le service.
        </p>
      </Part>

      <Part id="hosting" title="Hébergement et journaux">
        <p>
          L’app est hébergée par Vercel Inc. (États-Unis). Son serveur fonctionne à Francfort (Allemagne), et les
          pages passent par le réseau mondial de Vercel, qui utilise ton adresse IP pour te les acheminer.
        </p>
        <p>
          Comme sur tout site web, chaque requête peut être inscrite dans des journaux techniques : adresse IP, date et
          heure, adresse demandée (par exemple l’arrêt consulté, ou les arrêts proches pour un itinéraire depuis ta
          position) et type de navigateur. Ces journaux servent au fonctionnement et à la sécurité du service, et sont
          effacés après environ une heure.
        </p>
        <p>Base légale : l’intérêt légitime à faire fonctionner et à sécuriser le service.</p>
      </Part>

      <Part id="timetables" title="Horaires">
        <p>
          Les horaires viennent de transport.opendata.ch. Le serveur de TPG Go l’interroge avec des identifiants
          d’arrêts et des heures uniquement : ni ton adresse IP ni ta position ne lui sont transmises.
        </p>
      </Part>

      <Part id="transfers" title="Transferts à l’étranger">
        <p>
          Vercel et Discord sont des sociétés américaines : les données qu’elles traitent peuvent être transférées aux
          États-Unis. Ces transferts sont encadrés par le Data Privacy Framework UE–États-Unis et Suisse–États-Unis,
          reconnu par la Commission européenne et par le Conseil fédéral, et selon le cas par des clauses
          contractuelles types.
        </p>
      </Part>

      <Part id="never" title="Ce que TPG Go ne fait pas">
        <List>
          <li>Pas de compte ni d’inscription.</li>
          <li>Pas de cookies, de publicité ni d’outil de mesure d’audience.</li>
          <li>Pas de profilage ni de décision automatisée.</li>
          <li>Aucune donnée vendue ni partagée à des fins commerciales.</li>
        </List>
      </Part>

      <Part id="rights" title="Tes droits">
        <p>
          Tu peux demander à accéder à tes données, à les faire corriger ou effacer, à en limiter le traitement, à
          t’y opposer ou à en recevoir une copie, et retirer ton consentement à tout moment. Écris à <Mail />.
        </p>
        <p>
          TPG Go n’ayant pas de compte, il n’est généralement pas possible de t’identifier : pour une suggestion,
          indique sa date approximative et son contenu.
        </p>
        <p>
          Tu peux aussi adresser une réclamation au{" "}
          <External href="https://www.edoeb.admin.ch/fr">
            Préposé fédéral à la protection des données et à la transparence
          </External>{" "}
          (PFPDT) en Suisse, ou à l’autorité de protection des données de ton pays dans l’Union européenne (en France,
          la <External href="https://www.cnil.fr">CNIL</External>).
        </p>
      </Part>

      <Part id="links" title="Liens externes">
        <p>
          Les liens vers le code source (GitHub) et vers le site du développeur mènent à des services tiers, qui ont
          leur propre politique de confidentialité.
        </p>
      </Part>

      <Part id="changes" title="Modifications">
        <p>Cette politique peut évoluer avec l’app. La date de mise à jour figure en haut de la page.</p>
      </Part>
    </DetailScreen>
  );
}

/** Partie de la politique ; `id` sert d'ancre (p. ex. /privacy#position). */
function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mb-8 scroll-mt-16">
      <h2 id={`${id}-title`} className="mb-2 px-4 text-[13px] font-medium tracking-wide text-muted uppercase">
        {title}
      </h2>
      <Card className="space-y-3 p-4 text-[15px] leading-relaxed">{children}</Card>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT}`} className={LINK}>
      {CONTACT}
    </a>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
