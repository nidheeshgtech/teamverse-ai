import { Building } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status-page";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/ui/button";

export default async function NoOrganizationPage() {
  const t = await getTranslations();
  return (
    <StatusPage
      icon={<Building />}
      title={t("states.noOrgTitle")}
      description={t("states.noOrgBody")}
      action={
        <form action={signOut}>
          <Button type="submit">{t("topbar.signOut")}</Button>
        </form>
      }
    />
  );
}
