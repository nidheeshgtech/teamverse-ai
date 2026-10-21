import { Suspense } from "react";
import { CommsLayoutSkeleton } from "@/components/comms/comms-skeleton";
import { LiveComms } from "@/components/comms/comms-shell";
import { getChatPeople } from "@/features/messaging/queries";
import { requireMember } from "@/lib/auth/dal";

// Stitch "Communications — chat & voice notes": conversation list + thread + details.
// The list stays mounted while moving between conversations. Request-time data (cookies) is read
// inside <Suspense>, which loading.tsx does not provide for layouts.
export default function CommsLayout({ children }: LayoutProps<"/[locale]/comms">) {
  return (
    <Suspense fallback={<CommsLayoutSkeleton />}>
      <CommsData>{children}</CommsData>
    </Suspense>
  );
}

async function CommsData({ children }: { children: React.ReactNode }) {
  const viewer = await requireMember();
  const people = await getChatPeople(viewer.membership.orgId);
  return (
    <LiveComms
      orgId={viewer.membership.orgId}
      orgName={viewer.membership.orgName}
      viewerId={viewer.user.id}
      timezone={viewer.profile.timezone}
      availability={viewer.profile.availability}
      people={people}
      basePath="/comms"
    >
      {children}
    </LiveComms>
  );
}
