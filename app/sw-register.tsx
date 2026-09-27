"use client";

import { useEffect } from "react";

// Enregistre le service worker une fois l'app chargée (uniquement en prod).
export default function SwRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencieux : l'app fonctionne sans SW */
      });
    }
  }, []);
  return null;
}
