import type { ReactNode } from "react";
import { LogoMark } from "@/ui/logo";
import { Panel } from "@/ui/panel";
import { StateMessage } from "@/ui/states";

/** Full-screen centred state (no shell): used for 404, forbidden, no-organization. */
export function StatusPage({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-space-lg px-margin">
      <LogoMark className="size-10" />
      <Panel level={3} padding="lg" className="w-full max-w-md">
        <StateMessage titleAs="h1" icon={icon} title={title} description={description} action={action} />
      </Panel>
    </main>
  );
}
