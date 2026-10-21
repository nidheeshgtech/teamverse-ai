import { notFound } from "next/navigation";
import { isDevPreviewEnabled } from "@/lib/env";
import AppLayout from "../../(app)/layout";
import { DirectoryView } from "@/components/office/directory-view";
import { demoOfficeFixture, demoPresenceFixture } from "@/features/office/fixture";

// Developer-only preview of the directory with the DEMO fixture and SIMULATED presence.
export default async function DevDirectoryPage(props: LayoutProps<"/[locale]">) {
  if (!isDevPreviewEnabled()) notFound();
  return (
    <AppLayout {...props}>
      <div className="px-margin-mobile py-space-lg lg:p-margin">
        <DirectoryView data={demoOfficeFixture} viewerId="a0000000-0000-4000-8000-000000000001" presence={demoPresenceFixture} connection="simulated" />
      </div>
    </AppLayout>
  );
}
