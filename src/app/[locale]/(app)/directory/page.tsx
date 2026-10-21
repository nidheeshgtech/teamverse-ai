import { getTranslations } from "next-intl/server";
import { LiveDirectory } from "@/components/office/live-directory";
import { getOfficeData } from "@/features/office/queries";
import { requireMember } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("directory") };
}

export default async function DirectoryPage() {
  const viewer = await requireMember();
  const [t, data] = await Promise.all([getTranslations(), getOfficeData(viewer.membership.orgId)]);

  return (
    <div className="flex flex-col gap-space-lg p-margin">
      <header>
        <h1 className="type-headline-lg text-on-surface">{t("nav.directory")}</h1>
        <p className="mt-space-2xs type-body-md text-on-surface-variant">{t("directory.subtitle", { org: viewer.membership.orgName })}</p>
      </header>
      {data ? <LiveDirectory orgId={viewer.membership.orgId} viewerId={viewer.user.id} availability={viewer.profile.availability} data={data} /> : null}
    </div>
  );
}
