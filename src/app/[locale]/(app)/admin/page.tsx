import { ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { getOrgAdminData } from "@/features/admin/queries";
import { revokeInvitation } from "@/features/invitations/actions";
import { requireRole } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { Avatar } from "@/ui/avatar";
import { Badge, type BadgeTone } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Panel, PanelEyebrow } from "@/ui/panel";
import { InviteForm } from "./invite-form";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

// DESIGN GAP: Stitch has no admin screens. Built from the level-2 card, HUD eyebrow and badge patterns.
export default async function AdminPage() {
  const viewer = await requireRole(ADMIN_ROLES);
  const [t, format, data] = await Promise.all([getTranslations(), getFormatter(), getOrgAdminData(viewer.membership.orgId)]);

  return (
    <div className="flex flex-col gap-space-lg px-margin-mobile py-space-lg lg:p-margin">
      <header className="flex flex-col gap-space-sm lg:flex-row lg:items-end lg:justify-between lg:gap-space-md">
        <div>
          <PanelEyebrow>{viewer.membership.orgName}</PanelEyebrow>
          <h1 className="mt-space-2xs type-headline-lg text-on-surface">{t("admin.title")}</h1>
        </div>
        <p className="flex items-center gap-space-xs type-body-sm text-on-surface-variant">
          <ShieldCheck aria-hidden className="size-4 text-primary" />
          {t("admin.privacyNote")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
        <Panel level={2} padding="none" className="overflow-hidden lg:col-span-8" aria-labelledby="members-title">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 id="members-title" className="type-title-md">{t("admin.membersTitle")}</h2>
            <span className="type-label-md text-on-surface-variant">{t("admin.membersCount", { count: data.members.length })}</span>
          </div>
          <table className="w-full text-start">
            <thead className="border-y border-surface-glass-border bg-surface-container-low/40">
              <tr className="type-label-xs uppercase text-on-surface-variant">
                <th scope="col" className="px-5 py-2.5 text-start">{t("admin.colName")}</th>
                <th scope="col" className="px-5 py-2.5 text-start max-md:hidden">{t("admin.colEmail")}</th>
                <th scope="col" className="px-5 py-2.5 text-start max-sm:hidden">{t("admin.colDepartment")}</th>
                <th scope="col" className="px-5 py-2.5 text-start">{t("admin.colRole")}</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id} className="border-b border-surface-glass-border last:border-b-0">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-space-sm">
                      <Avatar name={member.profile.display_name} src={member.profile.avatar_url} size="sm" />
                      <span className="min-w-0">
                        <span className="block type-label-lg text-on-surface">{member.profile.display_name}</span>
                        {/* Phones: email under the name instead of its own column. */}
                        <span className="block truncate type-body-sm text-on-surface-variant md:hidden" dir="ltr">{member.profile.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 type-body-sm text-on-surface-variant max-md:hidden" dir="ltr">{member.profile.email}</td>
                  <td className="px-5 py-3 max-sm:hidden">
                    {member.department ? (
                      <Badge tone={`dept-${member.department.slug}` as BadgeTone}>{t(`departments.${member.department.slug}` as "departments.development")}</Badge>
                    ) : (
                      <span className="text-on-surface-variant">{t("admin.noDepartment")}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={member.role === "member" ? "neutral" : "primary"}>{t(`roles.${member.role}`)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Phones: inviting comes first; the member list follows. */}
        <div className="flex flex-col gap-gutter max-lg:order-first lg:col-span-4">
          <Panel level={2} padding="md" aria-labelledby="invite-title">
            <h2 id="invite-title" className="type-title-md">{t("admin.inviteTitle")}</h2>
            <InviteForm
              canInviteOwner={viewer.membership.role === "owner"}
              departments={data.departments.map((d) => ({ id: d.id, label: t(`departments.${d.slug}` as "departments.development") }))}
            />
          </Panel>

          <Panel level={2} padding="md" aria-labelledby="pending-title">
            <h2 id="pending-title" className="type-title-md">{t("admin.pendingTitle")}</h2>
            {data.invitations.length === 0 ? (
              <p className="mt-space-sm type-body-md text-on-surface-variant">{t("admin.pendingEmpty")}</p>
            ) : (
              <ul className="mt-space-sm flex flex-col gap-space-sm">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-space-sm rounded-md bg-surface-container-low p-space-sm">
                    <span className="min-w-0">
                      <span className="block truncate type-label-lg text-on-surface" dir="ltr">{inv.email}</span>
                      <span className="type-body-sm text-on-surface-variant">
                        {t(`roles.${inv.role}`)} · {t("admin.expires", { date: format.dateTime(new Date(inv.expires_at), { dateStyle: "medium" }) })}
                      </span>
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <Button type="submit" variant="destructive" size="sm">{t("admin.revoke")}</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
