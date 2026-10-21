import { notFound } from "next/navigation";
import { isDevPreviewEnabled } from "@/lib/env";
import AppLayout from "../../(app)/layout";
import { OfficeView } from "@/components/office/office-view";
import { demoOfficeFixture, demoPresenceFixture } from "@/features/office/fixture";

// Developer-only preview of the office with the DEMO fixture and SIMULATED presence (clearly
// badged in the UI), so the scene can be checked without a running database.
export default async function DevOfficePage(props: LayoutProps<"/[locale]">) {
  if (!isDevPreviewEnabled()) notFound();
  return (
    <AppLayout {...props}>
      <OfficeView
        data={demoOfficeFixture}
        viewerId="a0000000-0000-4000-8000-000000000001"
        presence={demoPresenceFixture}
        connection="simulated"
      />
    </AppLayout>
  );
}
