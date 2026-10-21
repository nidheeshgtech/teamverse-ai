import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ThreadRoute } from "@/components/comms/thread-route";

// Per-user, request-time data from the layout wraps this segment, so there is no static shell to
// validate for instant navigation; the layout streams its own skeleton instead.
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("comms") };
}

export default function ConversationPage({ params }: PageProps<"/[locale]/comms/[conversationId]">) {
  return (
    <Suspense fallback={null}>
      <ThreadRoute params={params} />
    </Suspense>
  );
}
