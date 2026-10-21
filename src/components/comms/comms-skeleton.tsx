import { MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton, StateMessage } from "@/ui/states";

export function CommsLayoutSkeleton() {
  return (
    <div className="grid h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))] grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]" aria-busy="true">
      <div className="flex flex-col gap-space-md p-space-md lg:border-e lg:border-glass-line">
        <Skeleton className="h-16" />
        <Skeleton className="h-10" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
      <div className="hidden flex-col gap-space-md p-space-lg lg:flex">
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
    <div className="flex flex-1">
      <StateMessage
        titleAs="h1"
        icon={<MessagesSquare />}
        title={t("selectConversation")}
        description={t("selectConversationHint")}
        className="mt-space-3xl"
      />
    </div>
  );
}
