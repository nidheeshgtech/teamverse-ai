"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { acceptInvitationSignedIn, acceptInvitationWithNewAccount, type AcceptState } from "@/features/invitations/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "@/ui/button";
import { FieldError, Input, Label } from "@/ui/input";

export function AcceptNewAccountForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitationWithNewAccount, undefined);
  const error = state?.error;

  return (
    <form action={action} className="mt-space-lg flex flex-col gap-space-md" noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input id="displayName" name="displayName" autoComplete="name" required maxLength={80} aria-invalid={error === "nameRequired"} />
      </div>
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="password">{t("choosePassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="password-hint"
          aria-invalid={error === "passwordTooShort"}
        />
        <p id="password-hint" className="type-body-sm text-on-surface-variant">{t("passwordHint")}</p>
      </div>
      {error ? (
        <FieldError>
          {t(error, { email: "" })}
          {error === "existingAccount" ? (
            <>
              {" "}
              <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="underline">{t("signInInstead")}</Link>
            </>
          ) : null}
        </FieldError>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t("accepting") : t("accept")}
      </Button>
    </form>
  );
}

export function AcceptSignedInForm({ token, orgName }: { token: string; orgName: string }) {
  const t = useTranslations("invite");
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitationSignedIn, undefined);

  return (
    <form action={action} className="mt-space-lg flex flex-col gap-space-md">
      <input type="hidden" name="token" value={token} />
      {state?.error ? <FieldError>{t(state.error, { email: "" })}</FieldError> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t("accepting") : t("acceptSignedIn", { org: orgName })}
      </Button>
    </form>
  );
}
