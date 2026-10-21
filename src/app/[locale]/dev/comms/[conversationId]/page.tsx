import { Suspense } from "react";
import { ThreadRoute } from "@/components/comms/thread-route";

export default function DevConversationPage({ params }: PageProps<"/[locale]/dev/comms/[conversationId]">) {
  return (
    <Suspense fallback={null}>
      <ThreadRoute params={params} />
    </Suspense>
  );
}
