/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Import par icône (évite de compiler les ~1500 icônes Phosphor en dev).
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async headers() {
    return [
      {
        // Défense en profondeur : seule l'app elle-même (jamais un contenu intégré)
        // peut demander la position ; caméra et micro ne servent pas.
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Le service worker doit pouvoir contrôler toute l'app
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
