import { MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton, StateMessage } from "@/ui/states";

export function CommsLayoutSkeleton() {
  return (
    <div className="grid h-[calc(100dvh-var(--spacing-topbar))] grid-cols-[22rem_minmax(0,1fr)]" aria-busy="true">
      <div className="flex flex-col gap-space-md border-e border-glass-line p-space-md">
        <Skeleton className="h-16" />
        <Skeleton className="h-10" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <div className="flex flex-col gap-space-md p-space-lg">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-full" />
      </div>
    </div>
  );
}

// DESIGN GAP: Stitch always shows an open thread; this is the "nothing selected" state.
export function CommsEmptyState() {
  const t = useTranslations("comms");
  return (
    <StateMessage
      titleAs="h1"
      icon={<MessagesSquare />}
      title={t("selectConversation")}
      description={t("selectConversationHint")}
      className="mt-space-3xl"
    />
  );
}
