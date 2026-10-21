import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/ui/logo";

// DESIGN GAP: Stitch has no sign-in/invite screens. This extends the level-3 glass modal over the
// canvas with the sidebar brand lockup; flagged for product-owner review.
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("brand");
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-margin py-space-2xl">
      <div aria-hidden className="pointer-events-none absolute -top-40 start-1/4 size-[37.5rem] rounded-full bg-primary/5 blur-[140px]" />
      <div className="relative w-full max-w-md">
        <div className="mb-space-lg flex items-center justify-center gap-space-sm">
          <LogoMark className="size-10" />
          <div className="flex flex-col">
            <span className="type-headline-md text-on-surface">{t("name")}</span>
            <span className="type-label-xs uppercase text-secondary">{t("tagline")}</span>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
