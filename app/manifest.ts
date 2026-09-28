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
    background_color: "#08090a",
    theme_color: "#08090a",
    orientation: "portrait",
    // Appui long sur l'icône de l'app (Android) : accès direct à la recherche.
    shortcuts: [{ name: "Rechercher un arrêt", short_name: "Rechercher", url: "/search" }],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
