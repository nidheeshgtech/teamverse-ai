import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status-page";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/button";

export default async function NotFound() {
  const t = await getTranslations("states");
  return (
    <StatusPage
      icon={<Compass />}
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      action={
        <Button asChild variant="primary">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      }
    />
  );
}
