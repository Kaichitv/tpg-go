"use client";

import { useEffect } from "react";
import { watchTheme } from "@/lib/theme";

// Garde <html data-theme> et la couleur de barre d'état alignés sur le réglage.
export default function ThemeSync() {
  useEffect(() => watchTheme(), []);
  return null;
}
