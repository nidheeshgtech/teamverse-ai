import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("ai") };
}

export default function Page() {
  return <ComingSoon section="ai" />;
}
