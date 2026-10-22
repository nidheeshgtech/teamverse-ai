import { getTranslations } from "next-intl/server";
import { LiveCalls } from "@/components/calls/live-calls";
import { getChatPeople } from "@/features/messaging/queries";
import { requireMember } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("conferences") };
}

// Stitch has no lobby screen for calls (DESIGN GAP): a list of live calls/huddles to join.
export default async function ConferencesPage() {
  const viewer = await requireMember();
  const [t, people] = await Promise.all([getTranslations(), getChatPeople(viewer.membership.orgId)]);
  return (
    <div className="flex flex-col gap-space-lg px-margin-mobile py-space-lg lg:p-margin">
      <header>
        <h1 className="type-headline-lg text-on-surface">{t("nav.conferences")}</h1>
        <p className="mt-space-2xs type-body-md text-on-surface-variant">{t("calls.page.subtitle")}</p>
      </header>
      <LiveCalls
        orgId={viewer.membership.orgId}
        viewerId={viewer.user.id}
        people={people.map(({ userId, displayName, avatarUrl, title }) => ({ userId, displayName, avatarUrl, title }))}
      />
    </div>
  );
}
