/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Import par icône (évite de compiler les ~1500 icônes Phosphor en dev).
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async headers() {
    return [
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
