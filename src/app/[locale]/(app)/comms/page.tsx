import { getTranslations } from "next-intl/server";
import { CommsEmptyState } from "@/components/comms/comms-skeleton";

// Per-user, request-time data from the layout wraps this segment, so there is no static shell to
// validate for instant navigation; the layout streams its own skeleton instead.
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("comms") };
}

export default function CommsPage() {
  return <CommsEmptyState />;
}
