"use client";

import type { ReactNode } from "react";
import { createDemoTransport } from "@/features/messaging/demo-transport";
import { DEMO_ORG_ID, DEMO_VIEWER_ID, demoPeople } from "@/features/messaging/fixture";
import type { ChatTransport } from "@/features/messaging/transport";
import { demoPresenceFixture } from "@/features/office/fixture";
import { PreviewComms } from "./comms-shell";

// One in-memory transport per tab so the demo keeps its state while navigating between threads.
let demoTransport: ChatTransport | null = null;
const getDemoTransport = () => (demoTransport ??= createDemoTransport());

export function DemoComms({ children }: { children: ReactNode }) {
  return (
    <PreviewComms
      transport={getDemoTransport()}
      presence={demoPresenceFixture}
      orgId={DEMO_ORG_ID}
      orgName="Dubai Agency (Demo)"
      viewerId={DEMO_VIEWER_ID}
      timezone="Asia/Dubai"
      people={demoPeople}
      basePath="/dev/comms"
    >
      {children}
    </PreviewComms>
  );
}
