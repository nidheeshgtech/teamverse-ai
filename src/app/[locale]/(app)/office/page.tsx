import { getTranslations } from "next-intl/server";
import { LiveOffice } from "@/components/office/live-office";
import { getOfficeData } from "@/features/office/queries";
import { requireMember } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StateMessage } from "@/ui/states";
import { Building2 } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("office") };
}

export default async function OfficePage() {
  const viewer = await requireMember();
  const [t, data, lowBandwidth] = await Promise.all([getTranslations("office"), getOfficeData(viewer.membership.orgId), getLowBandwidth(viewer.user.id)]);

  if (!data) {
    return <StateMessage titleAs="h1" icon={<Building2 />} title={t("noLayout")} className="mt-space-2xl" />;
  }

  return (
    <LiveOffice
      orgId={viewer.membership.orgId}
      viewerId={viewer.user.id}
      availability={viewer.profile.availability}
      lowBandwidth={lowBandwidth}
      data={data}
    />
  );
}

async function getLowBandwidth(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.from("profiles").select("low_bandwidth").eq("id", userId).single()) ?? { data: null };
  return Boolean(data?.low_bandwidth);
}
