import { notFound } from "next/navigation";
import { isDevPreviewEnabled } from "@/lib/env";
import AppLayout from "../../(app)/layout";

// Developer-only: renders the signed-out app shell for design-fidelity checks without a database.
export default async function DevShellPage(props: LayoutProps<"/[locale]">) {
  if (!isDevPreviewEnabled()) notFound();
  return <AppLayout {...props}>{null}</AppLayout>;
}
