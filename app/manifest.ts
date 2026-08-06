import type { MetadataRoute } from "next";

// Placeholder d'identité — remplacé par le logo et les couleurs Strat'Edge réels en Story 1.3.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Note",
    short_name: "Project Note",
    description: "Application de gestion de projets personnelle — Strat'Edge",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FB",
    theme_color: "#0F2A44",
    icons: [
      {
        src: "/icon-placeholder.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
