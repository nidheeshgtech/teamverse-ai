import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReadReceiptsToggle } from "@/components/settings/read-receipts-toggle";
import { requireMember } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { Skeleton } from "@/ui/states";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="flex max-w-4xl flex-col gap-space-lg px-margin-mobile py-space-lg lg:p-margin">
      <h1 className="type-headline-lg text-on-surface">{t("title")}</h1>
      <Panel level={2} padding="lg" aria-labelledby="privacy-settings" className="flex flex-col gap-space-md">
        <PanelEyebrow id="privacy-settings">{t("privacyTitle")}</PanelEyebrow>
        <Suspense fallback={<Skeleton className="h-16" />}>
          <PrivacySettings />
        </Suspense>
      </Panel>
      <p className="type-body-md text-on-surface-variant">{t("moreSoon")}</p>
    </div>
  );
}

async function PrivacySettings() {
  const viewer = await requireMember();
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.from("profiles").select("share_read_receipts").eq("id", viewer.user.id).single()) ?? { data: null };
  return <ReadReceiptsToggle initial={data?.share_read_receipts ?? true} />;
}
