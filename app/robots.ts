import type { MetadataRoute } from "next";

// Outil interne mono-utilisateur sans authentification avant Story 1.2 — jamais indexé.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
