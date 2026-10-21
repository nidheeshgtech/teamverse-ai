"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signIn, type SignInState } from "@/features/auth/actions";
import { Button } from "@/ui/button";
import { FieldError, Input, Label } from "@/ui/input";

export function SignInForm() {
  const t = useTranslations("auth");
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, undefined);
  const error = state?.error === "unconfigured" ? "genericError" : state?.error;

  return (
    <form action={action} className="mt-space-lg flex flex-col gap-space-md" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(error)} aria-describedby={error ? "sign-in-error" : undefined} />
      </div>
      <div className="flex flex-col gap-space-xs">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(error)} aria-describedby={error ? "sign-in-error" : undefined} />
      </div>
      {error ? <FieldError id="sign-in-error">{t(error)}</FieldError> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
