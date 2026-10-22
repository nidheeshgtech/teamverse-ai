import { getViewer } from "@/lib/auth/dal";
import { getChatPeople } from "@/features/messaging/queries";
import { isLiveKitConfigured } from "@/lib/livekit";
import { CallLayer } from "./call-layer";

/** Mounts the call layer (incoming calls, call screen, minimized pill) for signed-in members. */
export async function CallRoot() {
  const viewer = await getViewer();
  if (!viewer?.membership) return null;
  const people = await getChatPeople(viewer.membership.orgId);
  return (
    <CallLayer
      orgId={viewer.membership.orgId}
      viewerId={viewer.user.id}
      available={isLiveKitConfigured()}
      people={people.map(({ userId, displayName, avatarUrl, title }) => ({ userId, displayName, avatarUrl, title }))}
    />
  );
}
