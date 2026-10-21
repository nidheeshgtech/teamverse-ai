"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { createInvitation, type CreateInvitationState } from "@/features/invitations/actions";
import { Button } from "@/ui/button";
import { FieldError, Input, Label } from "@/ui/input";

const selectClasses =
  "h-10 w-full rounded border border-surface-glass-border bg-input-fill px-space-md type-body-md text-on-surface focus-visible:border-primary-container focus-visible:outline-none focus-visible:shadow-focus-ring";

type Props = { canInviteOwner: boolean; departments: { id: string; label: string }[] };

export function InviteForm({ canInviteOwner, departments }: Props) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<CreateInvitationState, FormData>(createInvitation, { status: "idle" });

  return (
    <div className="mt-space-md flex flex-col gap-space-md">
      <form action={action} className="flex flex-col gap-space-md" noValidate>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="invite-email">{t("admin.inviteEmail")}</Label>
          <Input id="invite-email" name="email" type="email" required dir="ltr" aria-invalid={state.status === "error"} />
        </div>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="invite-role">{t("admin.inviteRole")}</Label>
          <select id="invite-role" name="role" defaultValue="member" className={selectClasses}>
            <option value="member">{t("roles.member")}</option>
            <option value="admin">{t("roles.admin")}</option>
            {canInviteOwner ? <option value="owner">{t("roles.owner")}</option> : null}
          </select>
        </div>
        <div className="flex flex-col gap-space-xs">
          <Label htmlFor="invite-dept">{t("admin.inviteDepartment")}</Label>
          <select id="invite-dept" name="departmentId" defaultValue="" className={selectClasses}>
            <option value="">{t("admin.noDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
        {state.status === "error" ? <FieldError>{t(`admin.${state.error}`)}</FieldError> : null}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("admin.inviteSubmitting") : t("admin.inviteSubmit")}
        </Button>
      </form>

      {state.status === "created" ? <CreatedLink email={state.email} link={state.link} /> : null}
    </div>
  );
}

function CreatedLink({ email, link }: { email: string; link: string }) {
  const t = useTranslations("admin");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div role="status" className="flex flex-col gap-space-sm rounded-md bg-primary-container/10 p-space-sm">
      <p className="type-body-sm text-on-surface">{t("inviteCreated", { email })}</p>
      <p className="type-body-sm text-on-surface-variant">{t("inviteEmailNotSent")}</p>
      <code className="break-all rounded bg-surface-container-lowest p-space-xs type-code-sm text-secondary" dir="ltr">{link}</code>
      <Button size="sm" onClick={copy}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
