import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status-page";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/button";

export default async function ForbiddenPage() {
  const t = await getTranslations("states");
  return (
    <StatusPage
      icon={<Lock />}
      title={t("forbiddenTitle")}
      description={t("forbiddenBody")}
      action={
        <Button asChild variant="primary">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      }
    />
  );
}
