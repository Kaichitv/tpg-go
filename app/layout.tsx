import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabBar from "@/components/TabBar";
import { THEME_COLORS, themeInitScript } from "@/lib/themeInit";
import SwRegister from "./sw-register";
import ThemeSync from "./theme-sync";

export const metadata: Metadata = {
  title: { default: "TPG Go", template: "%s · TPG Go" },
  description: "Prochains passages TPG en temps réel",
  applicationName: "TPG Go",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TPG Go" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Zoom laissé actif (accessibilité) ; les champs font ≥ 16 px, donc pas de zoom auto sur iOS.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme est posé par le script inline avant l'hydratation (thème forcé).
    <html lang="fr-CH" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <TabBar />
        <ThemeSync />
        <SwRegister />
      </body>
    </html>
  );
}
