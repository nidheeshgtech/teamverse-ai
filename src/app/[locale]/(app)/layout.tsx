import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CallRoot } from "@/components/calls/call-root";
import { MobileNavBar, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// Desktop shell from the Stitch screens: fixed sidebar (18rem) + top bar (4rem) over the canvas.
// DESIGN GAP: below xl the sidebar gives way to a compact top bar and an app-style bottom tab bar;
// pages size themselves with --chrome-top / --chrome-bottom (see globals.css).
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("nav");
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-space-sm focus:start-space-sm focus:z-[60] focus:rounded focus:bg-primary-container focus:px-space-md focus:py-space-sm focus:text-on-primary-action"
      >
        {t("skipToContent")}
      </a>
      <Sidebar />
      <Topbar />
      <main
        id="main"
        tabIndex={-1}
        className="min-h-dvh bg-surface-canvas pt-[var(--chrome-top)] pb-[var(--chrome-bottom)] outline-none xl:ps-sidebar"
      >
        {children}
      </main>
      <MobileNavBar />
      <Suspense fallback={null}>
        <CallRoot />
      </Suspense>
    </>
  );
}
