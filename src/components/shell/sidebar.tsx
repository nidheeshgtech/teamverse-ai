import { Bot, Building2, IdCard, Mic, MessagesSquare, Settings, Shield, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/roles";
import { Badge } from "@/ui/badge";
import { LogoMark } from "@/ui/logo";
import { NavLink } from "./nav-link";

export async function Sidebar() {
  const t = await getTranslations();

  return (
    <aside className="fixed inset-y-0 start-0 z-50 flex w-sidebar flex-col justify-between bg-surface-panel/90 py-space-md shadow-level-1 backdrop-blur-2xl">
      <div className="flex flex-col gap-space-lg">
        <div className="flex items-center gap-space-sm px-space-lg">
          <LogoMark />
          <div className="flex flex-col">
            <span className="type-title-md text-on-surface">{t("brand.name")}</span>
            <span className="type-label-xs uppercase text-secondary">{t("brand.tagline")}</span>
          </div>
        </div>

        <nav aria-label={t("nav.label")} className="flex flex-col gap-space-2xs px-space-sm">
          <NavLink href="/office" icon={<Building2 />}>{t("nav.office")}</NavLink>
          <NavLink href="/comms" icon={<MessagesSquare />}>{t("nav.comms")}</NavLink>
          <NavLink href="/conferences" icon={<Users />}>{t("nav.conferences")}</NavLink>
          <NavLink href="/voice-notes" icon={<Mic />}>{t("nav.voiceNotes")}</NavLink>
          <NavLink href="/ai" icon={<Bot />}>{t("nav.ai")}</NavLink>
          <NavLink href="/directory" icon={<IdCard />}>{t("nav.directory")}</NavLink>
          <Suspense fallback={null}>
            <AdminNavLink label={t("nav.admin")} />
          </Suspense>
        </nav>
      </div>

      <div className="flex flex-col gap-space-xs px-space-sm">
        {/* DESIGN DEVIATION: Stitch shows "DUBAI NODE LIVE 24ms" telemetry with no data source.
            Replaced by an honest demo-data marker until real connection status exists (Phase 3). */}
        <Suspense fallback={null}>
          <DemoMarker label={t("topbar.demoOrg")} />
        </Suspense>
        <NavLink href="/settings" icon={<Settings />}>{t("nav.settings")}</NavLink>
      </div>
    </aside>
  );
}

async function AdminNavLink({ label }: { label: string }) {
  const viewer = await getViewer();
  if (!viewer?.membership || !isAdminRole(viewer.membership.role)) return null;
  return <NavLink href="/admin" icon={<Shield />}>{label}</NavLink>;
}

async function DemoMarker({ label }: { label: string }) {
  const viewer = await getViewer();
  if (!viewer?.membership?.orgIsDemo) return null;
  return (
    <div className="mx-space-2xs flex items-center justify-between rounded-md bg-surface-container-low/60 p-space-sm backdrop-blur-md">
      <span className="type-label-xs uppercase text-on-surface-variant">{viewer.membership.orgName}</span>
      <Badge tone="warning">{label}</Badge>
    </div>
  );
}
