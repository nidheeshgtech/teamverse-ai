import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

// Installable web app ("Add to Home Screen"): opens full screen without browser chrome.
// Colors are the surface-canvas token (DESIGN.md); manifests can't reference CSS variables.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "meta" });
  return {
    name: t("title"),
    short_name: t("shortName"),
    description: t("description"),
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06090F",
    theme_color: "#06090F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
