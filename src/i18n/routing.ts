import { defineRouting } from "next-intl/routing";

// English only at launch. Phase 8 adds "ar"; the locale then comes from the profile
// (written to the NEXT_LOCALE cookie on sign-in), so URLs never carry a prefix.
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "never",
});

export type AppLocale = (typeof routing.locales)[number];

const rtlLocales: ReadonlySet<string> = new Set(["ar"]);

export function directionFor(locale: string): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
