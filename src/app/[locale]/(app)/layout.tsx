import { getTranslations } from "next-intl/server";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// Desktop shell from the Stitch screens: fixed sidebar (18rem) + top bar (4rem) over the canvas.
// DESIGN GAP: no tablet/mobile shell yet (deferred by product owner).
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
      <main id="main" tabIndex={-1} className="min-h-dvh bg-surface-canvas pt-topbar ps-sidebar outline-none">
        {children}
      </main>
    </>
  );
}
