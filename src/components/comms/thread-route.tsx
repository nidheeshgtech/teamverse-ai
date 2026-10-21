import { notFound } from "next/navigation";
import { z } from "zod";
import { MobileFullscreen } from "../shell/mobile-fullscreen";
import { ThreadOpenMarker } from "./comms-shell";
import { Thread } from "./thread";

/** Resolves the [conversationId] param; membership is enforced by RLS when the thread loads. */
export async function ThreadRoute({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!z.uuid().safeParse(conversationId).success) notFound();
  // On phones the open thread replaces the list and hides the app chrome, like a native messenger.
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <ThreadOpenMarker />
      <MobileFullscreen />
      <Thread key={conversationId} conversationId={conversationId} />
    </div>
  );
}
