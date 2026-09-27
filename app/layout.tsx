import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./sw-register";

export const metadata: Metadata = {
  title: "TPG en direct",
  description: "Prochains passages TPG en temps réel",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TPG" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
