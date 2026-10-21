import { notFound } from "next/navigation";
import { isDevPreviewEnabled } from "@/lib/env";
import AppLayout from "../../(app)/layout";
import { DemoComms } from "@/components/comms/demo-comms";

// Developer-only preview of Communications with the DEMO fixture, an in-memory transport and
// SIMULATED presence. Nothing is sent anywhere.
export default async function DevCommsLayout(props: LayoutProps<"/[locale]/dev/comms">) {
  if (!isDevPreviewEnabled()) notFound();
  return (
    <AppLayout {...props}>
      <DemoComms>{props.children}</DemoComms>
    </AppLayout>
  );
}
