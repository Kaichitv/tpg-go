import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: { default: "TPG Go", template: "%s · TPG Go" },
  description: "Prochains passages TPG en temps réel",
  applicationName: "TPG Go",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TPG Go" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f5" },
    { media: "(prefers-color-scheme: dark)", color: "#07080b" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Zoom laissé actif (accessibilité) ; les champs font ≥ 16 px, donc pas de zoom auto sur iOS.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CH">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
