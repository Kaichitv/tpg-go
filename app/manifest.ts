import type { MetadataRoute } from "next";

// Next.js sert ce manifest sur /manifest.webmanifest automatiquement.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TPG Go",
    short_name: "TPG Go",
    description: "Prochains passages TPG en temps réel",
    lang: "fr-CH",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#07080b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
