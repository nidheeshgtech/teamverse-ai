"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/ui/button";
import { Panel } from "@/ui/panel";
import { StateMessage } from "@/ui/states";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states");
  return (
    <div className="px-margin-mobile py-space-lg lg:p-margin">
      <Panel level={2} padding="lg">
        <StateMessage
          tone="error"
          icon={<TriangleAlert />}
          title={t("errorTitle")}
          description={t("errorBody")}
          action={<Button onClick={reset}>{t("retry")}</Button>}
        />
      </Panel>
    </div>
  );
}
